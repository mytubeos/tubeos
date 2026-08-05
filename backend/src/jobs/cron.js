// src/jobs/cron.js
// Lightweight in-process scheduler. Replaces BullMQ where Upstash free
// blocks evalsha. Uses setInterval — fine for a single instance, but would
// duplicate work (double emails/syncs) across multiple instances.

const Schedule = require('../models/schedule.model');
const Video = require('../models/video.model');
const YoutubeChannel = require('../models/youtube-channel.model');
const logger = require('../config/logger');

let running = false;
let analyticsSyncRunning = false;
const timers = [];

// ---------- Scheduled video publish reaper ----------
// Two independent sources of "scheduled" videos, both handled here:
//
// 1. Schedule documents (created via the Scheduler page's "+ Schedule
//    Video", picking an existing draft that has a file staged via
//    POST /:videoId/stage). The file was never sent to YouTube — this is
//    the moment it actually happens, reusing video.service's uploadVideo()
//    (the same, already-hardened upload path a direct "Upload Now" uses).
// 2. Plain Video records scheduled directly from the Upload page's own
//    "Schedule for later" field — these were uploaded to YouTube
//    immediately as private with a native `publishAt`; YouTube makes them
//    public automatically. This just refreshes our own DB status once that
//    time has passed, so the Videos list doesn't keep showing "Scheduled"
//    long after it's actually gone live.
const reapPublishedSchedules = async () => {
  if (running) return;
  running = true;
  try {
    const now = new Date();
    const videoService = require('../services/video.service');

    // ---- 1. Schedule-backed drafts: perform the real upload now ----
    const due = await Schedule.find({
      status: 'pending',
      scheduledAt: { $lte: now },
    }).limit(50);

    for (const s of due) {
      try {
        const video = await Video.findById(s.videoId);
        if (!video) {
          s.status = 'failed';
          s.failReason = 'Video record missing';
          s.failedAt = new Date();
          await s.save();
          continue;
        }

        if (!video.stagedFile?.gcsPath) {
          s.status = 'failed';
          s.failReason = 'No video file was attached to this draft';
          s.failedAt = new Date();
          await s.save();
          continue;
        }

        // uploadVideo() treats a truthy scheduledAt as "still in the
        // future, ask YouTube to hold it private via publishAt" — clear it
        // first since that future has already arrived; it should publish
        // per the video's own privacy setting right now.
        video.scheduledAt = null;
        await video.save();

        const fileRef = {
          gcsPath: video.stagedFile.gcsPath,
          bucket: video.stagedFile.bucket,
          size: video.stagedFile.size,
        };

        try {
          await videoService.uploadVideo(
            s.userId.toString(),
            s.videoId.toString(),
            fileRef,
            video.stagedFile.mimeType
          );
          s.status = 'published';
          s.executedAt = new Date();
          logger.info(`[cron] schedule ${s._id} uploaded + published`, { videoId: video._id });
        } catch (uploadErr) {
          s.status = 'failed';
          s.failReason = uploadErr.message;
          s.failedAt = new Date();
          logger.error(`[cron] schedule ${s._id} upload failed`, { error: uploadErr.message });
        }

        // uploadVideo()'s own finally block already deleted the GCS
        // staging object on both success and failure — clear the now-
        // dangling reference so a later re-schedule attempt doesn't think
        // a file is still attached.
        await Video.findByIdAndUpdate(s.videoId, { $unset: { stagedFile: 1 } });
        await s.save();
      } catch (err) {
        s.status = 'failed';
        s.failReason = err.message;
        s.failedAt = new Date();
        await s.save();
        logger.error(`[cron] schedule ${s._id} failed`, { error: err.message });
      }
    }

    // ---- 2. Direct (Upload-page) schedules: just refresh the DB status ----
    const dueDirect = await Video.find({
      status: 'scheduled',
      scheduledAt: { $lte: now },
      youtubeVideoId: { $exists: true, $ne: null },
    }).limit(50);

    for (const video of dueDirect) {
      video.status = 'published';
      video.publishedAt = video.publishedAt || video.scheduledAt;
      await video.save();
      logger.info(`[cron] direct-scheduled video ${video._id} marked published`);
    }

    // ---- 3. Videos still "processing": check if YouTube has finished ----
    // uploadVideo() sets status:'processing' the instant the YouTube API
    // call returns — long before YouTube's own transcoding actually
    // finishes. Nothing else ever checked back, so a small/short video
    // could sit showing "Processing" indefinitely even once it's genuinely
    // live. This refreshes any that have actually finished (or failed) on
    // YouTube's side.
    const stillProcessing = await Video.find({
      status: 'processing',
      youtubeVideoId: { $exists: true, $ne: null },
    }).limit(50);

    if (stillProcessing.length > 0) {
      const { getValidAccessToken } = require('../services/youtube.service');
      const { youtubeRequest } = require('../config/youtube.config');

      const byChannel = new Map();
      for (const video of stillProcessing) {
        const key = video.channelId.toString();
        if (!byChannel.has(key)) byChannel.set(key, []);
        byChannel.get(key).push(video);
      }

      for (const [channelId, videos] of byChannel) {
        try {
          const channel = await YoutubeChannel.findById(channelId).select(
            '+oauth.accessToken +oauth.refreshToken +oauth.expiresAt'
          );
          if (!channel) continue;
          const accessToken = await getValidAccessToken(channel);

          const ids = videos.map((v) => v.youtubeVideoId).join(',');
          const data = await youtubeRequest(`/videos?part=status&id=${ids}`, {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          const statusById = new Map(
            (data.items || []).map((item) => [item.id, item.status?.uploadStatus])
          );

          for (const video of videos) {
            const uploadStatus = statusById.get(video.youtubeVideoId);
            if (uploadStatus === 'processed') {
              video.status = 'published';
              video.publishedAt = video.publishedAt || new Date();
              await video.save();
              logger.info(`[cron] video ${video._id} finished processing, marked published`);
            } else if (uploadStatus === 'failed' || uploadStatus === 'rejected') {
              video.status = 'failed';
              video.lastError = {
                message: `YouTube ${uploadStatus} this video after upload`,
                code: 'YOUTUBE_PROCESSING_FAILED',
                occurredAt: new Date(),
              };
              await video.save();
              logger.error(`[cron] video ${video._id} ${uploadStatus} on YouTube`);
            }
            // 'uploaded' (still processing) or missing from the response —
            // leave alone, the next tick will check again.
          }
        } catch (err) {
          logger.error(`[cron] processing-status check failed for channel ${channelId}`, {
            error: err.message,
          });
        }
      }
    }
  } catch (err) {
    logger.error('[cron] reapPublishedSchedules error', { error: err.message });
  } finally {
    running = false;
  }
};

// ---------- Daily analytics snapshot sync ----------
// THE foundation job. syncChannelAnalytics() pulls per-DAY rows from the YouTube
// Analytics API (which backfills history in a single call) and upserts them into
// ChannelAnalytics + VideoAnalytics. Without this running on a schedule the tables
// stay empty, so getOverview() falls back to lifetime video totals — which is why
// the dashboard boxes showed "total" instead of "gained in this period".
//
// Runs once/day. 180-day window keeps every tab correct: the 90d tab compares
// against the previous 90 days, so it needs 180 days present. An Analytics API
// report call costs the same quota regardless of date range (a wider range just
// returns more rows), so 180 is effectively free vs 90. Channels are synced one
// at a time with a small gap to spread quota. Errors are isolated per channel so
// one bad token never stops the rest.
const syncAllChannelsAnalytics = async () => {
  if (analyticsSyncRunning) return;
  analyticsSyncRunning = true;
  try {
    const { syncChannelAnalytics } = require('../services/analytics.service');
    const { syncComments } = require('../services/ai-comment.service');
    const channels = await YoutubeChannel.find({ isActive: true }).select('_id userId').lean();

    logger.info(`[cron] daily analytics sync starting for ${channels.length} channel(s)`);
    let ok = 0;
    for (const ch of channels) {
      try {
        await syncChannelAnalytics(ch._id.toString(), ch.userId.toString(), 180);
        ok++;
      } catch (err) {
        logger.error(`[cron] analytics sync failed for channel ${ch._id}`, { error: err.message });
      }
      // Refresh comments (timestamps only, no sentiment LLM) so the Audience
      // Activity heatmap always has fresh data and the inbox stays current.
      // Isolated so a comment failure never blocks the analytics sync.
      try {
        await syncComments(ch.userId.toString(), ch._id.toString(), null, { analyze: false });
      } catch (err) {
        logger.error(`[cron] comment sync failed for channel ${ch._id}`, { error: err.message });
      }
      // Spread quota — small pause between channels
      await new Promise((r) => setTimeout(r, 3000));
    }
    logger.info(`[cron] daily analytics sync done: ${ok}/${channels.length} channels synced`);
  } catch (err) {
    logger.error('[cron] syncAllChannelsAnalytics error', { error: err.message });
  } finally {
    analyticsSyncRunning = false;
  }
};

// ---------- Trend refresh ----------
const refreshTrends = async () => {
  try {
    if (!process.env.YOUTUBE_API_KEY) return;
    const { refreshTrendsFromYouTube } = require('../services/growth.service');
    await refreshTrendsFromYouTube('IN');
  } catch (err) {
    logger.warn('[cron] refreshTrends error', { error: err.message });
  }
};

// ---------- Weekly report ----------
// Runs every 24h; fires real emails only on Monday (UTC).
// Sends to users with weeklyReport=true AND reportFrequency='weekly' (or unset).
const sendWeeklyReports = async () => {
  const day = new Date().getUTCDay(); // 0=Sun 1=Mon
  if (day !== 1) return;

  logger.info('[cron] weekly-report: starting Monday send');

  const User = require('../models/user.model');
  const { gatherReportData } = require('../services/report.service');
  const { sendWeeklyReportEmail } = require('../utils/email.utils');

  const users = await User.find({
    isActive: true,
    isBanned: false,
    isEmailVerified: true,
    'preferences.weeklyReport': { $ne: false },
    // Only send weekly to users who want weekly (or haven't set a preference — default weekly)
    'preferences.reportFrequency': { $in: ['weekly', null, undefined] },
    youtubeChannels: { $exists: true, $not: { $size: 0 } },
  })
    .select('name email plan branding preferences youtubeChannels')
    .lean();

  logger.info(`[cron] weekly-report: sending to ${users.length} user(s)`);
  let sent = 0;

  for (const user of users) {
    const channelId = user.youtubeChannels?.[0];
    if (!channelId) continue;

    try {
      const reportData = await gatherReportData(
        user._id.toString(),
        channelId.toString(),
        7,
        user.plan
      );
      if (!reportData) continue;

      await sendWeeklyReportEmail(user, reportData);
      sent++;

      // Brevo free tier: 300 emails/day — small gap between sends
      await new Promise((r) => setTimeout(r, 2000));
    } catch (err) {
      logger.error(`[cron] weekly-report failed for ${user.email}`, { error: err.message });
    }
  }

  logger.info(`[cron] weekly-report done: ${sent}/${users.length} emails sent`);
};

// ---------- Monthly report ----------
// Runs every 24h; fires real emails only on the 1st of each month (UTC).
// Sends to users with weeklyReport=true AND reportFrequency='monthly'.
const sendMonthlyReports = async () => {
  const date = new Date().getUTCDate(); // 1–31
  if (date !== 1) return;

  logger.info('[cron] monthly-report: starting 1st-of-month send');

  const User = require('../models/user.model');
  const { gatherMonthlyReportData } = require('../services/report.service');
  const { sendMonthlyReportEmail } = require('../utils/email.utils');

  const users = await User.find({
    isActive: true,
    isBanned: false,
    isEmailVerified: true,
    'preferences.weeklyReport': { $ne: false },
    'preferences.reportFrequency': 'monthly',
    youtubeChannels: { $exists: true, $not: { $size: 0 } },
  })
    .select('name email plan branding preferences youtubeChannels')
    .lean();

  logger.info(`[cron] monthly-report: sending to ${users.length} user(s)`);
  let sent = 0;

  for (const user of users) {
    const channelId = user.youtubeChannels?.[0];
    if (!channelId) continue;

    try {
      const reportData = await gatherMonthlyReportData(
        user._id.toString(),
        channelId.toString(),
        user.plan
      );
      if (!reportData) continue;

      await sendMonthlyReportEmail(user, reportData);
      sent++;

      await new Promise((r) => setTimeout(r, 2000));
    } catch (err) {
      logger.error(`[cron] monthly-report failed for ${user.email}`, { error: err.message });
    }
  }

  logger.info(`[cron] monthly-report done: ${sent}/${users.length} emails sent`);
};

// ---------- PubSubHubbub subscription renewal ----------
// Renews YouTube webhook subscriptions (9-day lease) for all active channels.
// Runs every 7 days. Channels expiring within 3 days are re-subscribed.
// No-ops silently if BACKEND_URL is not set (local dev without ngrok).
const renewPubSubSubscriptions = async () => {
  try {
    const { renewExpiringSubscriptions } = require('../services/pubsub.service');
    await renewExpiringSubscriptions();
  } catch (err) {
    logger.warn('[cron] pubsub renewal error', { error: err.message });
  }
};

// ---------- Chingari nudges ----------
// Periodic "has this user gone quiet" checks only. Event-driven moments
// (streak milestones, first-ever publish) fire immediately from their own
// call sites instead of waiting for this poll — see
// notification.service.js's touchActivity and video.service.js.
const generateNudges = async () => {
  try {
    const User = require('../models/user.model');
    const Video = require('../models/video.model');
    const Comment = require('../models/comment.model');
    const { createNotification } = require('../services/notification.service');

    const users = await User.find({
      isActive: true,
      isBanned: false,
      'preferences.chingariEnabled': { $ne: false },
    })
      .select('_id')
      .lean();

    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

    for (const { _id: userId } of users) {
      try {
        const recentVideo = await Video.findOne({
          userId,
          status: { $in: ['published', 'processing', 'scheduled'] },
        })
          .sort({ createdAt: -1 })
          .select('createdAt')
          .lean();

        if (!recentVideo || recentVideo.createdAt < threeDaysAgo) {
          await createNotification(
            userId,
            'upload_reminder',
            'Aaj kuch upload nahi hua abhi tak — Content Ideas tool se 2 min mein topic nikaal lo 👀',
            'nudge'
          );
        }

        const backlogCount = await Comment.countDocuments({
          userId,
          status: { $in: ['unread', 'pending_reply'] },
        });
        if (backlogCount >= 5) {
          await createNotification(
            userId,
            'comment_backlog',
            `${backlogCount} comments reply ka wait kar rahe hain — AI se 2 min mein nipta do 💬`,
            'nudge'
          );
        }
      } catch (err) {
        logger.error(`[cron] chingari-nudges failed for user ${userId}`, { error: err.message });
      }
    }
  } catch (err) {
    logger.error('[cron] generateNudges error', { error: err.message });
  }
};

// ---------- Expired subscription downgrade ----------
// Billing here is a manual monthly top-up, not an auto-charge subscription
// (see payment.service.js -- verifyPayment/the webhook only ever set
// subscriptionExpiresAt once, at payment time). Nothing else anywhere in
// the codebase ever checked that date against "now", so a paid plan stayed
// active forever after a single payment regardless of whether the user
// ever paid again -- this is the only enforcement point. Immediate
// downgrade, no grace period: "pay for a month, get a month" is the deal
// subscriptionExpiresAt = paidAt + 1 month already implies.
const downgradeExpiredSubscriptions = async () => {
  try {
    const User = require('../models/user.model');
    const { createNotification } = require('../services/notification.service');

    const expiredUsers = await User.find({
      plan: { $ne: 'free' },
      subscriptionExpiresAt: { $ne: null, $lte: new Date() },
    })
      .select('_id plan')
      .lean();

    if (expiredUsers.length === 0) return;

    logger.info(`[cron] downgrading ${expiredUsers.length} expired subscription(s)`);
    let downgraded = 0;

    for (const user of expiredUsers) {
      try {
        await User.findByIdAndUpdate(user._id, { plan: 'free', subscriptionExpiresAt: null });
        await createNotification(
          user._id,
          'subscription_expired',
          `Your ${user.plan} plan has expired — upgrade again anytime to get ${user.plan} features back.`,
          'nudge'
        );
        downgraded++;
      } catch (err) {
        logger.error(`[cron] failed to downgrade expired subscription for user ${user._id}`, {
          error: err.message,
        });
      }
    }

    logger.info(`[cron] expired-subscription downgrade done: ${downgraded}/${expiredUsers.length}`);
  } catch (err) {
    logger.error('[cron] downgradeExpiredSubscriptions error', { error: err.message });
  }
};

// ---------- Data retention purge ----------
// Enforces the specific windows promised in the Privacy Policy (section 4):
// YouTube channel data 30 days after disconnect, account data 90 days after
// deletion. Both fields already exist independent of this job (disconnect
// already soft-deletes a channel; admin delete already sets User.deletedAt) —
// this job's only role is the final hard-delete once the window has passed.
const purgeExpiredData = async () => {
  try {
    const User = require('../models/user.model');

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const channelResult = await YoutubeChannel.deleteMany({
      connectionStatus: 'disconnected',
      updatedAt: { $lte: thirtyDaysAgo },
    });

    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const userResult = await User.deleteMany({
      deletedAt: { $ne: null, $lte: ninetyDaysAgo },
    });

    if (channelResult.deletedCount || userResult.deletedCount) {
      logger.info('[cron] data-retention purge', {
        channelsPurged: channelResult.deletedCount,
        usersPurged: userResult.deletedCount,
      });
    }
  } catch (err) {
    logger.error('[cron] purgeExpiredData error', { error: err.message });
  }
};

const startCron = () => {
  logger.info('In-process cron started');

  // Every 60s: publish reaper
  timers.push(setInterval(reapPublishedSchedules, 60 * 1000));

  // Every 12h: refresh trends
  timers.push(setInterval(refreshTrends, 12 * 60 * 60 * 1000));

  // Every 24h: daily analytics snapshot sync (dashboard/analytics/growth foundation)
  timers.push(setInterval(syncAllChannelsAnalytics, 24 * 60 * 60 * 1000));

  // Every 24h: weekly report check (fires Monday only)
  timers.push(setInterval(sendWeeklyReports, 24 * 60 * 60 * 1000));

  // Every 24h: monthly report check (fires on 1st of month only)
  timers.push(setInterval(sendMonthlyReports, 24 * 60 * 60 * 1000));

  // Every 7 days: renew PubSubHubbub subscriptions (9-day lease, renew before expiry)
  timers.push(setInterval(renewPubSubSubscriptions, 7 * 24 * 60 * 60 * 1000));

  // Every 6h: Chingari nudge rules (stagnation checks only, see generateNudges)
  timers.push(setInterval(generateNudges, 6 * 60 * 60 * 1000));

  // Every 24h: purge data past its Privacy Policy retention window
  timers.push(setInterval(purgeExpiredData, 24 * 60 * 60 * 1000));

  // Every 24h: downgrade any subscription whose paid-for month has ended
  timers.push(setInterval(downgradeExpiredSubscriptions, 24 * 60 * 60 * 1000));

  // Fire once on boot (best-effort)
  setTimeout(reapPublishedSchedules, 5_000);
  setTimeout(refreshTrends, 10_000);
  // Delay the first analytics sync so boot isn't slowed and quota isn't hit at startup
  setTimeout(syncAllChannelsAnalytics, 30_000);
  // Subscribe all channels on boot (picks up any that missed their renewal window)
  setTimeout(renewPubSubSubscriptions, 15_000);
  // Free-tier instances can restart more often than once a day, which would
  // otherwise mean this setInterval never actually fires — boot-fire too.
  setTimeout(purgeExpiredData, 20_000);
  setTimeout(downgradeExpiredSubscriptions, 25_000);
};

const stopCron = () => {
  while (timers.length) clearInterval(timers.pop());
};

module.exports = {
  startCron,
  stopCron,
  // Individual job functions — also called by BullMQ worker (src/jobs/index.js)
  reapPublishedSchedules,
  syncAllChannelsAnalytics,
  refreshTrends,
  sendWeeklyReports,
  sendMonthlyReports,
  renewPubSubSubscriptions,
  generateNudges,
  purgeExpiredData,
  downgradeExpiredSubscriptions,
};
