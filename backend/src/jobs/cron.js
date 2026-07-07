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
// Sends to every active user who has preferences.weeklyReport === true.
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
      const reportData = await gatherReportData(user._id.toString(), channelId.toString());
      if (!reportData) continue;

      await sendWeeklyReportEmail(user, reportData);
      sent++;

      // Brevo free tier rate limit: 300 emails/day — small gap between sends
      await new Promise((r) => setTimeout(r, 2000));
    } catch (err) {
      logger.error(`[cron] weekly-report failed for ${user.email}`, { error: err.message });
    }
  }

  logger.info(`[cron] weekly-report done: ${sent}/${users.length} emails sent`);
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

const startCron = () => {
  logger.info('In-process cron started');

  // Every 60s: publish reaper
  timers.push(setInterval(reapPublishedSchedules, 60 * 1000));

  // Every 12h: refresh trends
  timers.push(setInterval(refreshTrends, 12 * 60 * 60 * 1000));

  // Every 24h: daily analytics snapshot sync (dashboard/analytics/growth foundation)
  timers.push(setInterval(syncAllChannelsAnalytics, 24 * 60 * 60 * 1000));

  // Every 24h: weekly report check
  timers.push(setInterval(sendWeeklyReports, 24 * 60 * 60 * 1000));

  // Every 7 days: renew PubSubHubbub subscriptions (9-day lease, renew before expiry)
  timers.push(setInterval(renewPubSubSubscriptions, 7 * 24 * 60 * 60 * 1000));

  // Fire once on boot (best-effort)
  setTimeout(reapPublishedSchedules, 5_000);
  setTimeout(refreshTrends, 10_000);
  // Delay the first analytics sync so boot isn't slowed and quota isn't hit at startup
  setTimeout(syncAllChannelsAnalytics, 30_000);
  // Subscribe all channels on boot (picks up any that missed their renewal window)
  setTimeout(renewPubSubSubscriptions, 15_000);
};

const stopCron = () => {
  while (timers.length) clearInterval(timers.pop());
};

module.exports = { startCron, stopCron, reapPublishedSchedules };
