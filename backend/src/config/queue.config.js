// BullMQ DISABLED — Upstash free plan does not support evalsha (Lua scripts)
// All queue operations are stubbed to no-ops so the rest of the app works fine.

const logger = require('./logger');

const QUEUE_NAMES = {
  VIDEO_PUBLISH:  'video-publish',
  VIDEO_PROCESS:  'video-process',
  ANALYTICS_SYNC: 'analytics-sync',
  AI_COMMENT:     'ai-comment',
  EMAIL:          'email',
  REPORT:         'weekly-report',
};

const DEFAULT_JOB_OPTIONS = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 5000 },
  removeOnComplete: { count: 100 },
  removeOnFail:     { count: 200 },
};

// Stub queue — no Redis connections, no commands
const makeStubQueue = (name) => ({
  name,
  add:               async () => ({ id: 'stub', name }),
  getJob:            async () => null,
  getWaitingCount:   async () => 0,
  getActiveCount:    async () => 0,
  getCompletedCount: async () => 0,
  getFailedCount:    async () => 0,
  getDelayedCount:   async () => 0,
  close:             async () => {},
  on:                () => {},
});

const videoPublishQueue = makeStubQueue(QUEUE_NAMES.VIDEO_PUBLISH);
const analyticsQueue    = makeStubQueue(QUEUE_NAMES.ANALYTICS_SYNC);
const emailQueue        = makeStubQueue(QUEUE_NAMES.EMAIL);
const reportQueue       = makeStubQueue(QUEUE_NAMES.REPORT);

const scheduleVideoPublish = async (videoId, channelId, userId, scheduledAt) => {
  logger.warn('scheduleVideoPublish stubbed — video will not be auto-published', { videoId });
  return { id: `stub-${videoId}` };
};

const cancelScheduledJob = async (videoId) => {
  logger.warn('cancelScheduledJob stubbed', { videoId });
  return false;
};

const getJobStatus = async (videoId) => null;

const getQueueStats = async () => ({
  waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0,
});

module.exports = {
  QUEUE_NAMES,
  DEFAULT_JOB_OPTIONS,
  videoPublishQueue,
  analyticsQueue,
  emailQueue,
  reportQueue,
  scheduleVideoPublish,
  cancelScheduledJob,
  getJobStatus,
  getQueueStats,
};
