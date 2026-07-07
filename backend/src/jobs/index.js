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

const QUEUE_NAME = 'tubeos-scheduler';

// Cron schedule for each job (UTC)
const JOB_SCHEDULES = [
  { id: 'reap-schedules', pattern: '* * * * *' }, // every 1 min
  { id: 'refresh-trends', pattern: '0 */12 * * *' }, // every 12h
  { id: 'sync-analytics', pattern: '0 2 * * *' }, // daily 2am
  { id: 'weekly-reports', pattern: '0 8 * * 1' }, // Monday 8am
  { id: 'monthly-reports', pattern: '0 9 1 * *' }, // 1st of month 9am
  { id: 'renew-pubsub', pattern: '0 3 */7 * *' }, // every 7 days 3am
];

let queue = null;
let worker = null;
let connection = null;

/**
 * Start BullMQ queue + worker and register repeatable jobs.
 * Returns true on success, throws on failure (caller decides fallback).
 */
const startWorkers = async () => {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) throw new Error('REDIS_URL not set');

  // BullMQ requires maxRetriesPerRequest: null (blocking commands must not have retry cap)
  connection = new IORedis(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    tls: redisUrl.startsWith('rediss://') ? {} : undefined,
    retryStrategy: (times) => Math.min(times * 500, 3000),
  });

  // Test connection and evalsha support before committing
  await connection.ping();

  queue = new Queue(QUEUE_NAME, { connection });

  // upsertJobScheduler is idempotent — safe to call on every boot
  for (const job of JOB_SCHEDULES) {
    await queue.upsertJobScheduler(job.id, { pattern: job.pattern }, { name: job.id });
  }

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

  logger.info(`[bullmq] started — ${JOB_SCHEDULES.length} job schedules registered`);
  return true;
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

module.exports = { startWorkers, stopWorkers };
