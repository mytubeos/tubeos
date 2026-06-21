// src/config/queue.config.js
// FIX: Redis URL parse for rediss:// (SSL) — safe port extraction

const { Queue, Worker, QueueEvents } = require('bullmq');
const { config } = require('./env');

// FIX: Safe Redis URL parsing for both redis:// and rediss:// (SSL)
const buildRedisConnection = (redisUrl) => {
  try {
    const parsed = new URL(redisUrl);
    return {
      host:     parsed.hostname,
      port:     parseInt(parsed.port) || (redisUrl.startsWith('rediss://') ? 6380 : 6379),
      username: parsed.username || 'default',
      password: parsed.password || undefined,
      tls:      redisUrl.startsWith('rediss://') ? {} : undefined,
      maxRetriesPerRequest: null, // Required for BullMQ
    };
  } catch (err) {
    console.error('Invalid REDIS_URL for BullMQ:', err.message);
    throw new Error('Cannot parse REDIS_URL for BullMQ connection');
  }
};

const redisConnection = buildRedisConnection(config.redis.url);

// Queue Names
const QUEUE_NAMES = {
  VIDEO_PUBLISH:  'video-publish',
  VIDEO_PROCESS:  'video-process',
  ANALYTICS_SYNC: 'analytics-sync',
  AI_COMMENT:     'ai-comment',
  EMAIL:          'email',
  REPORT:         'weekly-report',
};

// Default job options
const DEFAULT_JOB_OPTIONS = {
  attempts: 3,
  backoff: {
    type:  'exponential',
    delay: 5000,
  },
  removeOnComplete: { count: 100 },
  removeOnFail:     { count: 200 },
};

// Queues
const videoPublishQueue = new Queue(QUEUE_NAMES.VIDEO_PUBLISH, {
  connection:         redisConnection,
  defaultJobOptions:  DEFAULT_JOB_OPTIONS,
});

const analyticsQueue = new Queue(QUEUE_NAMES.ANALYTICS_SYNC, {
  connection:        redisConnection,
  defaultJobOptions: { ...DEFAULT_JOB_OPTIONS, attempts: 5 },
});

const emailQueue = new Queue(QUEUE_NAMES.EMAIL, {
  connection:        redisConnection,
  defaultJobOptions: { ...DEFAULT_JOB_OPTIONS, attempts: 3 },
});

const reportQueue = new Queue(QUEUE_NAMES.REPORT, {
  connection:        redisConnection,
  defaultJobOptions: DEFAULT_JOB_OPTIONS,
});

// Queue Events
const videoPublishEvents = new QueueEvents(QUEUE_NAMES.VIDEO_PUBLISH, { connection: redisConnection });

videoPublishEvents.on('completed', ({ jobId }) => {
  console.log(`✅ Video publish job ${jobId} completed`);
});

videoPublishEvents.on('failed', ({ jobId, failedReason }) => {
  console.error(`❌ Video publish job ${jobId} failed: ${failedReason}`);
});

// ==================== HELPERS ====================

const scheduleVideoPublish = async (videoId, channelId, userId, scheduledAt) => {
  const delay = new Date(scheduledAt).getTime() - Date.now();

  if (delay < 0) {
    throw new Error('Scheduled time must be in the future');
  }

  const job = await videoPublishQueue.add(
    'publish-video',
    { videoId, channelId, userId },
    {
      ...DEFAULT_JOB_OPTIONS,
      delay,
      jobId: `publish-${videoId}`, // Unique jobId prevents duplicates
    }
  );

  console.log(`📅 Video ${videoId} scheduled for ${scheduledAt} (delay: ${Math.round(delay/1000/60)} min)`);
  return job;
};

const cancelScheduledJob = async (videoId) => {
  const jobId = `publish-${videoId}`;
  const job   = await videoPublishQueue.getJob(jobId);

  if (job) {
    await job.remove();
    console.log(`🗑️  Cancelled scheduled job for video ${videoId}`);
    return true;
  }
  return false;
};

const getJobStatus = async (videoId) => {
  const jobId = `publish-${videoId}`;
  const job   = await videoPublishQueue.getJob(jobId);
  if (!job) return null;

  const state = await job.getState();
  return {
    jobId,
    state,
    delay:        job.opts.delay,
    attempts:     job.attemptsMade,
    data:         job.data,
    processedOn:  job.processedOn,
    finishedOn:   job.finishedOn,
    failedReason: job.failedReason,
  };
};

const getQueueStats = async () => {
  const [waiting, active, completed, failed, delayed] = await Promise.all([
    videoPublishQueue.getWaitingCount(),
    videoPublishQueue.getActiveCount(),
    videoPublishQueue.getCompletedCount(),
    videoPublishQueue.getFailedCount(),
    videoPublishQueue.getDelayedCount(),
  ]);

  return { waiting, active, completed, failed, delayed };
};

module.exports = {
  redisConnection,
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
