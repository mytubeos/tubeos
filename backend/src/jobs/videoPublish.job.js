// src/jobs/videoPublish.job.js
// BullMQ Worker — processes video publish jobs at scheduled time

const { Worker } = require('bullmq');
const { QUEUE_NAMES, redisConnection } = require('../config/queue.config');
const Video = require('../models/video.model');
const Schedule = require('../models/schedule.model');
const YoutubeChannel = require('../models/youtube-channel.model');
const { getValidAccessToken } = require('../services/youtube.service');
const { youtubeRequest } = require('../config/youtube.config');

// ==================== WORKER ====================
const videoPublishWorker = new Worker(
  QUEUE_NAMES.VIDEO_PUBLISH,
  async (job) => {
    const { videoId, channelId, userId } = job.data;

    console.log(`\n📹 Processing video publish job: ${job.id}`);
    console.log(`   VideoId: ${videoId}`);
    console.log(`   Attempt: ${job.attemptsMade + 1}`);

    // 1. Get video from DB
    const video = await Video.findById(videoId);
    if (!video) {
      throw new Error(`Video ${videoId} not found in database`);
    }

    // Skip if already published (idempotency)
    if (video.status === 'published') {
      console.log(`✅ Video ${videoId} already published — skipping`);
      return { success: true, skipped: true };
    }

    // 2. Get schedule record
    const schedule = await Schedule.findOne({ videoId });

    // 3. Get channel with OAuth
    const channel = await YoutubeChannel.findById(channelId)
      .select('+oauth.accessToken +oauth.refreshToken +oauth.expiresAt');

    if (!channel || !channel.isActive) {
      throw new Error(`Channel ${channelId} not found or disconnected`);
    }

    // 4. Get valid access token
    const accessToken = await getValidAccessToken(channel);

    // 5. If video already on YouTube — just make it public
    if (video.youtubeVideoId) {
      await publishExistingVideo(video, accessToken);
    } else {
      // Video not yet on YouTube — this shouldn't happen in normal flow
      // (video should be uploaded first, then scheduled)
      throw new Error('Video has no YouTube ID. Upload the video first.');
    }

    // 6. Update video status
    video.status = 'published';
    video.publishedAt = new Date();
    await video.save();

    // 7. Update schedule record
    if (schedule) {
      schedule.status = 'published';
      schedule.executedAt = new Date();
      await schedule.save();
    }

    console.log(`✅ Video ${videoId} published successfully!`);
    console.log(`   YouTube URL: ${video.youtubeUrl}`);

    return {
      success: true,
      videoId,
      youtubeVideoId: video.youtubeVideoId,
      publishedAt: video.publishedAt,
    };
  },
  {
    connection: redisConnection,
    concurrency: 5, // Process 5 jobs simultaneously
    limiter: {
      max: 10,
      duration: 1000, // Max 10 jobs per second
    },
  }
);

// ==================== PUBLISH EXISTING VIDEO ====================
// Changes YouTube video privacy from 'private' to 'public'
const publishExistingVideo = async (video, accessToken) => {
  const updateData = {
    id: video.youtubeVideoId,
    status: {
      privacyStatus: video.privacy || 'public',
      publishAt: null, // Clear scheduled time
    },
  };

  await youtubeRequest('/videos?part=status', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(updateData),
  });
};

// ==================== WORKER EVENTS ====================
videoPublishWorker.on('completed', (job, result) => {
  console.log(`✅ Job ${job.id} completed`, result);
});

videoPublishWorker.on('failed', async (job, err) => {
  console.error(`❌ Job ${job.id} failed (attempt ${job.attemptsMade}):`, err.message);

  // Update schedule with failure info
  if (job?.data?.videoId) {
    try {
      await Schedule.findOneAndUpdate(
        { videoId: job.data.videoId },
        {
          failReason: err.message,
          failedAt: new Date(),
          retryCount: job.attemptsMade,
          status: job.attemptsMade >= 3 ? 'failed' : 'pending',
          nextRetryAt: job.attemptsMade < 3
            ? new Date(Date.now() + Math.pow(2, job.attemptsMade) * 5000)
            : null,
        }
      );

      // Mark video as failed if all retries exhausted
      if (job.attemptsMade >= 3) {
        await Video.findByIdAndUpdate(job.data.videoId, {
          status: 'failed',
          'lastError.message': err.message,
          'lastError.occurredAt': new Date(),
        });
      }
    } catch (dbErr) {
      console.error('Failed to update schedule on job failure:', dbErr);
    }
  }
});

videoPublishWorker.on('error', (err) => {
  console.error('Worker error:', err);
});

console.log('🔧 Video Publish Worker started');

module.exports = videoPublishWorker;
