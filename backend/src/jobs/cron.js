// src/jobs/cron.js
// Lightweight in-process scheduler. Replaces BullMQ where Upstash free
// blocks evalsha. Uses setInterval — fine for a single Cloud Run instance.

const Schedule = require('../models/schedule.model');
const Video = require('../models/video.model');
const YoutubeChannel = require('../models/youtube-channel.model');
const { Trend } = require('../models/growth.model');

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

        console.log(`[cron] schedule ${s._id} marked published (video ${video._id})`);
      } catch (err) {
        s.status = 'failed';
        s.failReason = err.message;
        s.failedAt = new Date();
        await s.save();
        console.error(`[cron] schedule ${s._id} failed:`, err.message);
      }
    }
  } catch (err) {
    console.error('[cron] reapPublishedSchedules error:', err.message);
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
    const channels = await YoutubeChannel.find({ isActive: true })
      .select('_id userId')
      .lean();

    console.log(`[cron] daily analytics sync starting for ${channels.length} channel(s)`);
    let ok = 0;
    for (const ch of channels) {
      try {
        await syncChannelAnalytics(ch._id.toString(), ch.userId.toString(), 180);
        ok++;
      } catch (err) {
        console.error(`[cron] analytics sync failed for channel ${ch._id}:`, err.message);
      }
      // Spread quota — small pause between channels
      await new Promise((r) => setTimeout(r, 3000));
    }
    console.log(`[cron] daily analytics sync done: ${ok}/${channels.length} channels synced`);
  } catch (err) {
    console.error('[cron] syncAllChannelsAnalytics error:', err.message);
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
    console.warn('[cron] refreshTrends error:', err.message);
  }
};

// ---------- Weekly report ----------
const sendWeeklyReports = async () => {
  // Stubbed for MVP — sends nothing unless a creator opts in.
  // Hook for future implementation. Runs once/day, body checks day == Monday.
  const day = new Date().getUTCDay(); // 0 = Sun
  if (day !== 1) return;
  console.log('[cron] weekly-report hook fired (no-op MVP)');
};

const startCron = () => {
  console.log('🕒 In-process cron started');

  // Every 60s: publish reaper
  timers.push(setInterval(reapPublishedSchedules, 60 * 1000));

  // Every 12h: refresh trends
  timers.push(setInterval(refreshTrends, 12 * 60 * 60 * 1000));

  // Every 24h: daily analytics snapshot sync (dashboard/analytics/growth foundation)
  timers.push(setInterval(syncAllChannelsAnalytics, 24 * 60 * 60 * 1000));

  // Every 24h: weekly report check
  timers.push(setInterval(sendWeeklyReports, 24 * 60 * 60 * 1000));

  // Fire once on boot (best-effort)
  setTimeout(reapPublishedSchedules, 5_000);
  setTimeout(refreshTrends, 10_000);
  // Delay the first analytics sync so boot isn't slowed and quota isn't hit at startup
  setTimeout(syncAllChannelsAnalytics, 30_000);
};

const stopCron = () => {
  while (timers.length) clearInterval(timers.pop());
};

module.exports = { startCron, stopCron };
