// src/services/plan-limit.service.js
//
// Single source of truth for how many of each metered action every plan
// gets per month. Admin-editable (see admin.controller.js's limits
// endpoints) — nothing in this file's own logic is a business decision, the
// numbers below are only a starting point so usage checks behave exactly
// like the old hardcoded PLAN_LIMITS until an admin actually changes
// something.
const PlanLimit = require('../models/plan-limit.model');
const { setCache, getCache, deleteCache } = require('../config/redis');

const PLANS = ['free', 'creator', 'pro', 'agency'];
const LIMIT_TYPES = ['uploads', 'aiReplies', 'aiContent', 'bulkReplies', 'thumbnailGen'];

// Matches the values every plan had before this became admin-editable.
// null = unlimited (was `Infinity` in the old hardcoded object).
const DEFAULT_LIMITS = {
  free: { uploads: 0, aiReplies: 10, aiContent: 20, bulkReplies: 0, thumbnailGen: 5 },
  creator: { uploads: 5, aiReplies: 500, aiContent: 500, bulkReplies: 0, thumbnailGen: 5 },
  pro: { uploads: 20, aiReplies: 1200, aiContent: 2000, bulkReplies: 100, thumbnailGen: 15 },
  agency: {
    uploads: null,
    aiReplies: null,
    aiContent: null,
    bulkReplies: null,
    thumbnailGen: 50,
  },
};

// This is read on every single metered request (checkUsageLimit runs on
// every AI/upload call), not just admin-panel page loads like pricing is —
// cached so an admin edit doesn't add a DB round-trip to every request.
// getCache/setCache/deleteCache swallow their own errors and degrade to a
// cache miss rather than throwing, so a flaky Redis just means "read from
// Mongo this time," never a crash.
const CACHE_KEY = 'plan-limits:all';
const CACHE_TTL = 300;

const assertKnownPlan = (plan) => {
  if (!PLANS.includes(plan)) {
    const err = new Error('Invalid plan');
    err.statusCode = 400;
    throw err;
  }
};

// Self-seeding, like pricing.service.js's getPrice — works correctly the
// moment this deploys, without depending on a migration/seed script running
// first.
const ensureSeeded = async (plan) => {
  const existing = await PlanLimit.findOne({ plan });
  if (existing) return existing;
  return PlanLimit.create({ plan, ...DEFAULT_LIMITS[plan] });
};

const toPlain = (row) => ({
  uploads: row.uploads,
  aiReplies: row.aiReplies,
  aiContent: row.aiContent,
  bulkReplies: row.bulkReplies,
  thumbnailGen: row.thumbnailGen,
});

// All 4 plans, keyed by plan.
const getAllLimits = async () => {
  const cached = await getCache(CACHE_KEY);
  if (cached) return cached;

  const rows = await Promise.all(PLANS.map(ensureSeeded));
  const byPlan = {};
  for (const row of rows) byPlan[row.plan] = toPlain(row);

  await setCache(CACHE_KEY, byPlan, CACHE_TTL);
  return byPlan;
};

// What the live usage-check code (User.hasUsageLeft/getUsageStats) wants —
// one plan's limits, falling back to Free's if the plan is somehow unknown
// (matches the old hardcoded object's `PLAN_LIMITS[this.plan] || PLAN_LIMITS.free`).
const getLimitsForPlan = async (plan) => {
  const all = await getAllLimits();
  return all[plan] || all.free;
};

// Admin write path — upserts one plan's full limit set in one call (matches
// how the admin UI edits "this plan's limits" as one unit).
const setLimits = async (plan, limits, adminUserId) => {
  assertKnownPlan(plan);

  const update = { updatedBy: adminUserId || null };
  for (const type of LIMIT_TYPES) {
    if (!(type in limits)) continue;
    const value = limits[type];

    if (value === null) {
      update[type] = null; // unlimited
      continue;
    }
    const num = Number(value);
    if (!Number.isFinite(num) || num < 0) {
      const err = new Error(`Invalid ${type} value`);
      err.statusCode = 400;
      throw err;
    }
    update[type] = num;
  }

  const row = await PlanLimit.findOneAndUpdate({ plan }, update, {
    upsert: true,
    new: true,
    setDefaultsOnInsert: true,
  });

  // Next read re-seeds from Mongo instead of serving the now-stale cache.
  await deleteCache(CACHE_KEY);

  return { plan, ...toPlain(row) };
};

module.exports = {
  PLANS,
  LIMIT_TYPES,
  DEFAULT_LIMITS,
  getAllLimits,
  getLimitsForPlan,
  setLimits,
};
