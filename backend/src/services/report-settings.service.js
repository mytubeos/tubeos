// src/services/report-settings.service.js
//
// Admin-editable schedule + sender identity for the weekly/monthly report
// emails. Follows the same self-seeding, Redis-cached pattern as
// plan-limit.service.js — this file's own defaults only matter until an
// admin actually changes something.
const ReportSettings = require('../models/report-settings.model');
const { setCache, getCache, deleteCache } = require('../config/redis');
const logger = require('../config/logger');

const CACHE_KEY = 'report-settings:default';
const CACHE_TTL = 300;

const IST_OFFSET_MIN = 5 * 60 + 30; // fixed, no DST

const toPlain = (row) => ({
  weeklyDayOfWeek: row.weeklyDayOfWeek,
  weeklyHour: row.weeklyHour,
  weeklyMinute: row.weeklyMinute,
  monthlyDayOfMonth: row.monthlyDayOfMonth,
  monthlyHour: row.monthlyHour,
  monthlyMinute: row.monthlyMinute,
  senderEmail: row.senderEmail,
  senderName: row.senderName,
});

// Self-seeding, like pricing.service.js/plan-limit.service.js — works
// correctly the moment this deploys, no migration/seed script needed.
const ensureSeeded = async () => {
  const existing = await ReportSettings.findOne({ key: 'default' });
  if (existing) return existing;
  return ReportSettings.create({ key: 'default' });
};

const getSettings = async () => {
  const cached = await getCache(CACHE_KEY);
  if (cached) return cached;

  const row = await ensureSeeded();
  const plain = toPlain(row);
  await setCache(CACHE_KEY, plain, CACHE_TTL);
  return plain;
};

// Converts an IST (dayOfWeek 0-6, hour, minute) wall-clock point to the
// equivalent UTC dayOfWeek/hour/minute. Built on a real Date rather than
// hand-rolled modular arithmetic so day-of-week rollover (e.g. an early IST
// Monday morning is still Sunday night in UTC) is handled correctly by the
// platform, not reimplemented here.
const weeklyIstToUtc = (dayOfWeekIST, hourIST, minuteIST) => {
  // 2023-01-01 is a known Sunday; Date.UTC normalizes the "day" field
  // correctly even when 1 + dayOfWeekIST pushes past January's own length.
  const asIfUtc = new Date(Date.UTC(2023, 0, 1 + dayOfWeekIST, hourIST, minuteIST));
  const trueUtc = new Date(asIfUtc.getTime() - IST_OFFSET_MIN * 60 * 1000);
  return {
    dayOfWeek: trueUtc.getUTCDay(),
    hour: trueUtc.getUTCHours(),
    minute: trueUtc.getUTCMinutes(),
  };
};

// Same idea for a day-of-month. Anchored to January (31 days) so any input
// in the allowed 1-28 range can safely roll back a few hours into the
// previous month without underflowing. Admin UI restricts selectable hours
// to 6:00 AM IST and later specifically so this rollback never actually
// happens in practice (rolling into a shorter month's missing day-of-month
// would make a monthly cron pattern silently skip that month) — this
// function stays correct either way, the restriction is belt-and-suspenders.
const monthlyIstToUtc = (dayOfMonthIST, hourIST, minuteIST) => {
  const asIfUtc = new Date(Date.UTC(2023, 0, dayOfMonthIST, hourIST, minuteIST));
  const trueUtc = new Date(asIfUtc.getTime() - IST_OFFSET_MIN * 60 * 1000);
  return {
    dayOfMonth: trueUtc.getUTCDate(),
    hour: trueUtc.getUTCHours(),
    minute: trueUtc.getUTCMinutes(),
  };
};

const cronPattern = ({ minute, hour, dayOfMonth = '*', dayOfWeek = '*' }) =>
  `${minute} ${hour} ${dayOfMonth} * ${dayOfWeek}`;

// What jobs/index.js needs to register/reschedule the BullMQ repeatable job.
const getWeeklyUtcSchedule = async () => {
  const s = await getSettings();
  const utc = weeklyIstToUtc(s.weeklyDayOfWeek, s.weeklyHour, s.weeklyMinute);
  return { ...utc, pattern: cronPattern({ minute: utc.minute, hour: utc.hour, dayOfWeek: utc.dayOfWeek }) };
};

const getMonthlyUtcSchedule = async () => {
  const s = await getSettings();
  const utc = monthlyIstToUtc(s.monthlyDayOfMonth, s.monthlyHour, s.monthlyMinute);
  return {
    ...utc,
    pattern: cronPattern({ minute: utc.minute, hour: utc.hour, dayOfMonth: utc.dayOfMonth }),
  };
};

// What cron.js's setInterval-fallback gating needs — just today's UTC
// day-of-week/day-of-month to compare against, without building a full
// cron string.
const getWeeklyUtcDayOfWeek = async () => (await getWeeklyUtcSchedule()).dayOfWeek;
const getMonthlyUtcDayOfMonth = async () => (await getMonthlyUtcSchedule()).dayOfMonth;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const updateSettings = async (data, adminUserId) => {
  const update = { updatedBy: adminUserId || null };

  const intField = (name, min, max) => {
    if (!(name in data)) return;
    const num = Number(data[name]);
    if (!Number.isInteger(num) || num < min || num > max) {
      const err = new Error(`${name} must be an integer between ${min} and ${max}`);
      err.statusCode = 400;
      throw err;
    }
    update[name] = num;
  };

  intField('weeklyDayOfWeek', 0, 6);
  intField('weeklyHour', 0, 23);
  intField('weeklyMinute', 0, 59);
  intField('monthlyDayOfMonth', 1, 28);
  intField('monthlyHour', 0, 23);
  intField('monthlyMinute', 0, 59);

  if ('senderEmail' in data) {
    const email = String(data.senderEmail || '').trim();
    if (!EMAIL_RE.test(email)) {
      const err = new Error('senderEmail must be a valid email address');
      err.statusCode = 400;
      throw err;
    }
    update.senderEmail = email;
  }

  if ('senderName' in data) {
    update.senderName = String(data.senderName || '').trim() || 'Vezrin Reports';
  }

  const row = await ReportSettings.findOneAndUpdate({ key: 'default' }, update, {
    upsert: true,
    new: true,
    setDefaultsOnInsert: true,
  });

  await deleteCache(CACHE_KEY);

  // Live-reschedule the BullMQ repeatable jobs so a schedule change takes
  // effect immediately instead of waiting for the next deploy/restart.
  // Lazy require to avoid a load-order cycle (jobs/index.js doesn't need
  // this module at boot, only when an admin actually saves a change) and a
  // no-op if BullMQ isn't the active scheduler (setInterval fallback reads
  // the DB fresh on its own next tick, nothing to push there).
  try {
    const { rescheduleReportJobs } = require('../jobs');
    await rescheduleReportJobs();
  } catch (err) {
    logger.warn('[report-settings] live reschedule skipped', { error: err.message });
  }

  return toPlain(row);
};

module.exports = {
  getSettings,
  updateSettings,
  getWeeklyUtcSchedule,
  getMonthlyUtcSchedule,
  getWeeklyUtcDayOfWeek,
  getMonthlyUtcDayOfMonth,
  weeklyIstToUtc,
  monthlyIstToUtc,
};
