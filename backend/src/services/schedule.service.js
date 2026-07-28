// src/services/schedule.service.js
// Smart scheduling — create, update, cancel schedules.
// Actual publishing is done by the reaper cron (src/jobs/cron.js), which
// polls for due Schedule documents and calls video.service's uploadVideo()
// directly — there is no BullMQ/Redis job queue in the loop (see
// config/queue.config.js's header comment for why).

const Schedule = require('../models/schedule.model');
const Video = require('../models/video.model');
const YoutubeChannel = require('../models/youtube-channel.model');
const { getDefaultGrid } = require('./heatmap.service');

// ==================== CREATE SCHEDULE ====================
const createSchedule = async (userId, videoId, scheduledAt, options = {}) => {
  // 1. Validate video
  const video = await Video.findOne({ _id: { $eq: videoId }, userId: { $eq: userId } });
  if (!video) {
    const err = new Error('Video not found');
    err.statusCode = 404;
    throw err;
  }

  if (!['draft', 'failed', 'cancelled'].includes(video.status)) {
    const err = new Error(`Cannot schedule video with status: ${video.status}`);
    err.statusCode = 400;
    throw err;
  }

  // A schedule with nothing to upload later is pointless — "Save as Draft"
  // must have staged a file first (see video.service.js's stageFile()).
  if (!video.stagedFile?.gcsPath) {
    const err = new Error('Attach a video file to this draft before scheduling it');
    err.statusCode = 400;
    throw err;
  }

  // 2. Validate scheduled time
  const scheduleDate = new Date(scheduledAt);
  if (scheduleDate <= new Date()) {
    const err = new Error('Scheduled time must be in the future');
    err.statusCode = 400;
    throw err;
  }

  // Max 6 months ahead
  const maxDate = new Date();
  maxDate.setMonth(maxDate.getMonth() + 6);
  if (scheduleDate > maxDate) {
    const err = new Error('Cannot schedule more than 6 months ahead');
    err.statusCode = 400;
    throw err;
  }

  // 3. Cancel existing schedule if any
  const existing = await Schedule.findOne({ videoId: { $eq: videoId } });
  if (existing) {
    await existing.deleteOne();
  }

  // 4. Create schedule record — the reaper cron picks this up once due
  const schedule = await Schedule.create({
    userId,
    channelId: video.channelId,
    videoId,
    scheduledAt: scheduleDate,
    // Purely informational (the actual instant is already the correct UTC
    // value in scheduledAt) — don't assume every user is in India; fall
    // back to UTC when the frontend genuinely didn't send one.
    timezone: options.timezone || 'UTC',
    isAiRecommended: options.isAiRecommended || false,
    aiScore: options.aiScore || null,
    aiReason: options.aiReason || null,
    status: 'pending',
  });

  // 5. Update video
  video.status = 'scheduled';
  video.scheduledAt = scheduleDate;
  await video.save();

  return {
    schedule,
    message: `Video scheduled for ${scheduleDate.toISOString()}`,
  };
};

// ==================== RESCHEDULE ====================
const reschedule = async (userId, videoId, newScheduledAt) => {
  const schedule = await Schedule.findOne({ videoId, userId });
  if (!schedule) {
    const err = new Error('Schedule not found');
    err.statusCode = 404;
    throw err;
  }

  if (schedule.status === 'published') {
    const err = new Error('Cannot reschedule an already published video');
    err.statusCode = 400;
    throw err;
  }

  const newDate = new Date(newScheduledAt);
  if (newDate <= new Date()) {
    const err = new Error('Scheduled time must be in the future');
    err.statusCode = 400;
    throw err;
  }
  const video = await Video.findById(videoId);

  // Update schedule — the reaper cron just re-reads scheduledAt each poll
  schedule.scheduledAt = newDate;
  schedule.status = 'pending';
  schedule.failReason = null;
  await schedule.save();

  // Update video
  video.scheduledAt = newDate;
  video.status = 'scheduled';
  await video.save();

  return {
    schedule,
    message: `Rescheduled to ${newDate.toISOString()}`,
  };
};

// ==================== CANCEL SCHEDULE ====================
const cancelSchedule = async (userId, videoId) => {
  const schedule = await Schedule.findOne({ videoId, userId });
  if (!schedule) {
    const err = new Error('Schedule not found');
    err.statusCode = 404;
    throw err;
  }

  // Update schedule
  schedule.status = 'cancelled';
  await schedule.save();

  // Update video back to draft — its staged file stays attached, so it can
  // be rescheduled again without re-uploading.
  await Video.findOneAndUpdate(
    { _id: { $eq: videoId } },
    {
      status: 'draft',
      scheduledAt: null,
    }
  );

  return { message: 'Schedule cancelled successfully' };
};

// ==================== GET MY SCHEDULES ====================
const getMySchedules = async (userId, filters = {}) => {
  const { status, channelId, from, to, page = 1, limit = 20 } = filters;

  const query = { userId };
  if (status) query.status = status;
  if (channelId) query.channelId = channelId;
  if (from || to) {
    query.scheduledAt = {};
    if (from) query.scheduledAt.$gte = new Date(from);
    if (to) query.scheduledAt.$lte = new Date(to);
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [schedules, total] = await Promise.all([
    Schedule.find(query)
      .sort({ scheduledAt: 1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('videoId', 'title thumbnail status youtubeVideoId')
      .populate('channelId', 'channelName thumbnail'),
    Schedule.countDocuments(query),
  ]);

  return {
    schedules,
    pagination: { page: parseInt(page), limit: parseInt(limit), total },
  };
};

// ==================== GET CALENDAR VIEW ====================
// Returns schedules grouped by date for calendar UI
const getCalendarView = async (userId, year, month) => {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59);

  const schedules = await Schedule.find({
    userId,
    scheduledAt: { $gte: startDate, $lte: endDate },
  })
    .populate('videoId', 'title thumbnail privacy isShort')
    .populate('channelId', 'channelName thumbnail')
    .sort({ scheduledAt: 1 });

  // Group by date
  const calendar = {};
  schedules.forEach((schedule) => {
    const dateKey = new Date(schedule.scheduledAt).toISOString().split('T')[0];
    if (!calendar[dateKey]) calendar[dateKey] = [];
    calendar[dateKey].push({
      _id: schedule._id,
      scheduledAt: schedule.scheduledAt,
      status: schedule.status,
      isAiRecommended: schedule.isAiRecommended,
      aiScore: schedule.aiScore,
      video: schedule.videoId,
      channel: schedule.channelId,
    });
  });

  return { calendar, totalScheduled: schedules.length };
};

// ==================== GET JOB STATUS ====================
const getScheduleJobStatus = async (userId, videoId) => {
  const schedule = await Schedule.findOne({ videoId: { $eq: videoId }, userId: { $eq: userId } });
  if (!schedule) {
    const err = new Error('Schedule not found');
    err.statusCode = 404;
    throw err;
  }

  return {
    schedule,
    job: {
      status: schedule.status,
      scheduledAt: schedule.scheduledAt,
      executedAt: schedule.executedAt,
      failReason: schedule.failReason,
    },
  };
};

// ==================== GET QUEUE STATS ====================
// Real counts from the Schedule collection — there's no BullMQ/Redis queue
// behind this (see this file's header comment), so these numbers come
// straight from what the reaper cron actually tracks.
const getQueueDashboard = async (userId) => {
  const now = new Date();
  const [duePending, notYetDue, published, failed] = await Promise.all([
    Schedule.countDocuments({ userId, status: 'pending', scheduledAt: { $lte: now } }),
    Schedule.countDocuments({ userId, status: 'pending', scheduledAt: { $gt: now } }),
    Schedule.countDocuments({ userId, status: 'published' }),
    Schedule.countDocuments({ userId, status: 'failed' }),
  ]);

  return {
    stats: {
      // Waiting: scheduled for later, not due yet
      delayed: notYetDue,
      // Active: due now, will be picked up by the next reaper tick (runs every 60s)
      active: duePending,
      completed: published,
      failed,
    },
  };
};

// ==================== AI BEST TIME RECOMMENDATION ====================
// Analyzes channel data to suggest best posting time
// Full implementation in Part 4 (Time Intelligence System)
// This is a placeholder that returns smart defaults
const getBestTimeRecommendation = async (userId, channelId) => {
  const channel = await YoutubeChannel.findOne({
    _id: { $eq: channelId },
    userId: { $eq: userId },
  });
  if (!channel) {
    const err = new Error('Channel not found');
    err.statusCode = 404;
    throw err;
  }

  // Check if we have calculated data
  if (channel.bestTimeData?.lastCalculatedAt) {
    const daysSinceCalc =
      (Date.now() - channel.bestTimeData.lastCalculatedAt) / (1000 * 60 * 60 * 24);

    // Return cached if calculated within 7 days
    if (daysSinceCalc < 7 && channel.bestTimeData.bestHours.length > 0) {
      return buildRecommendation(channel.bestTimeData, channel);
    }
  }

  // Default smart recommendation based on India market data
  // (Will be replaced with real analytics in Part 4)
  const defaultRecommendation = getDefaultRecommendation(channel);
  return defaultRecommendation;
};

// ==================== BULK SCHEDULE ====================
const bulkSchedule = async (userId, schedules) => {
  if (!Array.isArray(schedules) || schedules.length === 0) {
    const err = new Error('Schedules array is required');
    err.statusCode = 400;
    throw err;
  }

  if (schedules.length > 20) {
    const err = new Error('Cannot bulk schedule more than 20 videos at once');
    err.statusCode = 400;
    throw err;
  }

  const results = [];
  const errors = [];

  for (const item of schedules) {
    try {
      const result = await createSchedule(userId, item.videoId, item.scheduledAt, {
        isAiRecommended: item.isAiRecommended,
        aiScore: item.aiScore,
        aiReason: item.aiReason,
      });
      results.push({ videoId: item.videoId, success: true, schedule: result.schedule });
    } catch (err) {
      errors.push({ videoId: item.videoId, success: false, error: err.message });
    }
  }

  return {
    results,
    errors,
    summary: {
      total: schedules.length,
      successful: results.length,
      failed: errors.length,
    },
    message: `${results.length}/${schedules.length} videos scheduled successfully`,
  };
};

// ==================== HELPERS ====================
const buildRecommendation = (bestTimeData, channel) => {
  const grid = bestTimeData.heatmapData?.grid || null;
  const nextSlots = getNextBestSlots(bestTimeData.bestDays, bestTimeData.bestHours, 5, grid);

  return {
    channelId: channel._id,
    channelName: channel.channelName,
    recommendation: {
      bestDays: bestTimeData.bestDays,
      bestHours: bestTimeData.bestHours,
      nextOptimalSlots: nextSlots,
      confidence: 'high',
      basedOn: 'channel_analytics',
      lastCalculated: bestTimeData.lastCalculatedAt,
    },
    message: 'Based on your channel analytics',
  };
};

const getDefaultRecommendation = (channel) => {
  // India market defaults — research-backed
  const defaultBestDays = ['friday', 'saturday', 'sunday'];
  const defaultBestHours = [18, 19, 20, 21]; // 6PM - 9PM IST

  const nextSlots = getNextBestSlots(defaultBestDays, defaultBestHours, 5, getDefaultGrid());

  return {
    channelId: channel._id,
    channelName: channel.channelName,
    recommendation: {
      bestDays: defaultBestDays,
      bestHours: defaultBestHours,
      nextOptimalSlots: nextSlots,
      confidence: 'medium',
      basedOn: 'market_research',
      note: 'Connect analytics for personalized recommendations (available after 30 days of data)',
    },
    message: 'Based on India YouTube market research',
  };
};

const getNextBestSlots = (bestDays, bestHours, count = 5, grid = null) => {
  const slots = [];
  const now = new Date();

  for (let daysAhead = 0; daysAhead <= 14 && slots.length < count; daysAhead++) {
    const date = new Date(now);
    date.setDate(date.getDate() + daysAhead);
    const dayIndex = date.getDay();
    const dayName = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][
      dayIndex
    ];

    if (bestDays.includes(dayName)) {
      for (const hour of bestHours) {
        const slot = new Date(date);
        slot.setHours(hour, 0, 0, 0);

        if (slot > now && slots.length < count) {
          slots.push({
            datetime: slot.toISOString(),
            day: dayName,
            hour: `${hour}:00`,
            // Real activity score from this channel's heatmap grid when available,
            // otherwise a flat estimate — never a random number.
            score: grid ? Math.round(grid[dayIndex][hour]) : 80,
          });
        }
      }
    }
  }

  return slots;
};

module.exports = {
  createSchedule,
  reschedule,
  cancelSchedule,
  getMySchedules,
  getCalendarView,
  getScheduleJobStatus,
  getQueueDashboard,
  getBestTimeRecommendation,
  bulkSchedule,
};
