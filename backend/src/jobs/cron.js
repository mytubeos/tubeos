// src/jobs/cron.js
// Lightweight in-process scheduler. Replaces BullMQ where Upstash free
// blocks evalsha. Uses setInterval — fine for a single Cloud Run instance.

const Schedule = require('../models/schedule.model');
const Video = require('../models/video.model');
const YoutubeChannel = require('../models/youtube-channel.model');
const { Trend } = require('../models/growth.model');

let running = false;
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

  // Every 24h: weekly report check
  timers.push(setInterval(sendWeeklyReports, 24 * 60 * 60 * 1000));

  // Fire once on boot (best-effort)
  setTimeout(reapPublishedSchedules, 5_000);
  setTimeout(refreshTrends, 10_000);
};

const stopCron = () => {
  while (timers.length) clearInterval(timers.pop());
};

module.exports = { startCron, stopCron };
