// src/jobs/index.js
// BullMQ-backed job scheduler — replaces setInterval cron when Redis supports it.
//
// WHY: setInterval runs on every Render instance independently. If Render scales
// to 2+ instances, cron jobs fire twice — duplicate analytics syncs, duplicate
// weekly emails, etc. BullMQ uses Redis atomic locks so only ONE worker picks up
// each job across all instances.
//
// REQUIRES: Redis that supports Lua scripts (evalsha). Upstash FREE plan blocks
// evalsha — upgrade to Upstash Pay-As-You-Go or use a dedicated Redis on Render.
// If this module throws on startup, server.js automatically falls back to the
// setInterval cron (src/jobs/cron.js) so the app keeps working either way.

const { Queue, Worker } = require('bullmq');
const IORedis = require('ioredis');
const logger = require('../config/logger');

const QUEUE_NAME = 'vezrin-scheduler';

// Cron schedule for each job (UTC). weekly-reports/monthly-reports are NOT
// here — their pattern is admin-editable (report-settings.service.js,
// stored in IST) and registered separately below, in registerReportJobs().
const JOB_SCHEDULES = [
  { id: 'reap-schedules', pattern: '* * * * *' }, // every 1 min
  { id: 'refresh-trends', pattern: '0 */12 * * *' }, // every 12h
  { id: 'sync-analytics', pattern: '0 2 * * *' }, // daily 2am
  { id: 'renew-pubsub', pattern: '0 3 */7 * *' }, // every 7 days 3am
  { id: 'chingari-nudges', pattern: '0 */6 * * *' }, // every 6h
  { id: 'purge-expired-data', pattern: '0 4 * * *' }, // daily 4am
  { id: 'downgrade-expired-subscriptions', pattern: '0 5 * * *' }, // daily 5am
];

// Registers (or re-registers) the two report-email jobs using whatever
// schedule is currently in the DB. Called once at boot alongside the static
// JOB_SCHEDULES above, and again any time an admin saves a new schedule
// (report-settings.service.js's updateSettings calls rescheduleReportJobs,
// exported below) so a change takes effect immediately, not on next deploy.
const registerReportJobs = async () => {
  if (!queue) return;
  // Lazy require — report-settings.service isn't needed until a job
  // actually registers, same reasoning as the worker's lazy `./cron`
  // require below (avoids a load-order cycle with services that may
  // themselves touch jobs/index.js).
  const { getWeeklyUtcSchedule, getMonthlyUtcSchedule } = require('../services/report-settings.service');
  const [weekly, monthly] = await Promise.all([getWeeklyUtcSchedule(), getMonthlyUtcSchedule()]);
  await queue.upsertJobScheduler('weekly-reports', { pattern: weekly.pattern }, { name: 'weekly-reports' });
  await queue.upsertJobScheduler('monthly-reports', { pattern: monthly.pattern }, { name: 'monthly-reports' });
  logger.info('[bullmq] report job schedules registered', {
    weekly: weekly.pattern,
    monthly: monthly.pattern,
  });
};

let queue = null;
let worker = null;
let connection = null;

/**
 * Start BullMQ queue + worker and register repeatable jobs.
 * Returns true on success, throws on failure (caller decides fallback).
 */
const REDIS_PROBE_TIMEOUT_MS = 5000;

const startWorkers = async () => {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) throw new Error('REDIS_URL not set');

  // Probe with a short-lived, fast-failing client BEFORE touching the real
  // BullMQ connection below. The real connection needs maxRetriesPerRequest:
  // null (required for BullMQ's blocking commands) and a retryStrategy that
  // always returns a delay (never gives up) -- which also means a command on
  // that client can never reject on its own if Redis is unreachable, only
  // hang forever (confirmed: a dead/unresolvable REDIS_URL host hung this
  // function, and therefore the whole server boot, indefinitely instead of
  // throwing so server.js's try/catch could fall back to the cron scheduler
  // like it's designed to). This probe uses the opposite settings --
  // capped retries, a retryStrategy that gives up, and a hard timeout --
  // specifically so a dead Redis fails fast here instead.
  const probe = new IORedis(redisUrl, {
    maxRetriesPerRequest: 1,
    enableReadyCheck: false,
    tls: redisUrl.startsWith('rediss://') ? {} : undefined,
    retryStrategy: () => null,
    lazyConnect: true,
  });
  try {
    await Promise.race([
      probe.connect().then(() => probe.ping()),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error(`Redis probe timed out after ${REDIS_PROBE_TIMEOUT_MS}ms`)),
          REDIS_PROBE_TIMEOUT_MS
        )
      ),
    ]);
  } finally {
    probe.disconnect();
  }

  // BullMQ requires maxRetriesPerRequest: null (blocking commands must not have retry cap)
  connection = new IORedis(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    tls: redisUrl.startsWith('rediss://') ? {} : undefined,
    retryStrategy: (times) => Math.min(times * 500, 3000),
  });

  // Redis is confirmed reachable via the probe above -- this ping just
  // confirms the long-lived connection itself came up cleanly.
  await connection.ping();

  queue = new Queue(QUEUE_NAME, { connection });

  // upsertJobScheduler is idempotent — safe to call on every boot
  for (const job of JOB_SCHEDULES) {
    await queue.upsertJobScheduler(job.id, { pattern: job.pattern }, { name: job.id });
  }
  await registerReportJobs();

  worker = new Worker(
    QUEUE_NAME,
    async (job) => {
      // Lazy-require cron functions to avoid circular deps at module load time
      const cron = require('./cron');
      switch (job.name) {
        case 'reap-schedules':
          return cron.reapPublishedSchedules();
        case 'refresh-trends':
          return cron.refreshTrends();
        case 'sync-analytics':
          return cron.syncAllChannelsAnalytics();
        case 'weekly-reports':
          return cron.sendWeeklyReports();
        case 'monthly-reports':
          return cron.sendMonthlyReports();
        case 'renew-pubsub':
          return cron.renewPubSubSubscriptions();
        case 'chingari-nudges':
          return cron.generateNudges();
        case 'purge-expired-data':
          return cron.purgeExpiredData();
        case 'downgrade-expired-subscriptions':
          return cron.downgradeExpiredSubscriptions();
        default:
          logger.warn(`[bullmq] unknown job name: ${job.name}`);
      }
    },
    {
      connection,
      concurrency: 1, // process one job at a time per instance
      removeOnComplete: { count: 20 },
      removeOnFail: { count: 50 },
    }
  );

  worker.on('completed', (job) => {
    logger.info(`[bullmq] ${job.name} completed`, { jobId: job.id });
  });
  worker.on('failed', (job, err) => {
    logger.error(`[bullmq] ${job?.name} failed`, { error: err.message });
  });
  worker.on('error', (err) => {
    logger.error('[bullmq] worker error', { error: err.message });
  });

  logger.info(`[bullmq] started — ${JOB_SCHEDULES.length + 2} job schedules registered`);
  return true;
};

/**
 * Re-registers the weekly/monthly report jobs from whatever schedule is
 * currently in the DB. Safe to call whether or not BullMQ is the active
 * scheduler — a no-op (via registerReportJobs' own `if (!queue) return`)
 * when it isn't, since the setInterval fallback in jobs/cron.js reads the
 * schedule fresh from the DB on its own next tick regardless.
 */
const rescheduleReportJobs = async () => {
  await registerReportJobs();
};

/**
 * Gracefully close BullMQ worker and queue (called on SIGTERM/SIGINT).
 */
const stopWorkers = async () => {
  try {
    if (worker) await worker.close();
    if (queue) await queue.close();
    if (connection) await connection.quit();
    logger.info('[bullmq] workers stopped');
  } catch (err) {
    logger.warn('[bullmq] error during shutdown', { error: err.message });
  }
};

module.exports = { startWorkers, stopWorkers, rescheduleReportJobs };
