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
// Videos are uploaded to YouTube as private with `publishAt`. YouTube
// publishes them automatically. This job just updates our DB status.
const reapPublishedSchedules = async () => {
  if (running) return;
  running = true;
  try {
    const now = new Date();
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

        // YouTube handles the privacy flip; mark our records as published.
        video.status = 'published';
        video.publishedAt = video.publishedAt || s.scheduledAt;
        await video.save();

        s.status = 'published';
        s.executedAt = new Date();
        await s.save();

        logger.info(`[cron] schedule ${s._id} marked published`, { videoId: video._id });
      } catch (err) {
        s.status = 'failed';
        s.failReason = err.message;
        s.failedAt = new Date();
        await s.save();
        logger.error(`[cron] schedule ${s._id} failed`, { error: err.message });
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
    .select('name email preferences youtubeChannels')
    .lean();

  logger.info(`[cron] weekly-report: sending to ${users.length} user(s)`);
  let sent = 0;

  for (const user of users) {
    const channelId = user.youtubeChannels?.[0];
    if (!channelId) continue;

    try {
      const reportData = await gatherReportData(user._id.toString(), channelId.toString(), 7);
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
    .select('name email preferences youtubeChannels')
    .lean();

  logger.info(`[cron] monthly-report: sending to ${users.length} user(s)`);
  let sent = 0;

  for (const user of users) {
    const channelId = user.youtubeChannels?.[0];
    if (!channelId) continue;

    try {
      const reportData = await gatherMonthlyReportData(user._id.toString(), channelId.toString());
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
};
