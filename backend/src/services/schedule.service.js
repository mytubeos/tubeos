// src/services/schedule.service.js
// FIX 1: QUEUE_NAMES import file ke TOP mein le gaya (was at bottom — hoisting bug)
// FIX 2: cancelScheduled mein BullMQ job cancel hota hai ab
// FIX 3: getQueueDashboard mein QUEUE_NAMES properly available hai

const Schedule = require('../models/schedule.model');
const Video    = require('../models/video.model');
const YoutubeChannel = require('../models/youtube-channel.model');

// FIX: Import at top — was at bottom causing hoisting issues
const {
  scheduleVideoPublish,
  cancelScheduledJob,
  getJobStatus,
  getQueueStats,
  QUEUE_NAMES,
} = require('../config/queue.config');

// ==================== CREATE SCHEDULE ====================
const createSchedule = async (userId, videoId, scheduledAt, options = {}) => {
  const video = await Video.findOne({ _id: videoId, userId });
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

  const scheduleDate = new Date(scheduledAt);
  if (scheduleDate <= new Date()) {
    const err = new Error('Scheduled time must be in the future');
    err.statusCode = 400;
    throw err;
  }

  const maxDate = new Date();
  maxDate.setMonth(maxDate.getMonth() + 6);
  if (scheduleDate > maxDate) {
    const err = new Error('Cannot schedule more than 6 months ahead');
    err.statusCode = 400;
    throw err;
  }

  // Cancel existing schedule if any
  const existing = await Schedule.findOne({ videoId });
  if (existing) {
    await cancelScheduledJob(videoId);
    await existing.deleteOne();
  }

  // Create BullMQ job
  const job = await scheduleVideoPublish(videoId, video.channelId, userId, scheduleDate);

  // Create schedule record
  const schedule = await Schedule.create({
    userId,
    channelId: video.channelId,
    videoId,
    scheduledAt: scheduleDate,
    timezone:         options.timezone         || 'Asia/Kolkata',
    isAiRecommended:  options.isAiRecommended  || false,
    aiScore:          options.aiScore          || null,
    aiReason:         options.aiReason         || null,
    bullJobId: job.id,
    status: 'pending',
  });

  // Update video
  video.status       = 'scheduled';
  video.scheduledAt  = scheduleDate;
  video.scheduledJobId = job.id;
  await video.save();

  return {
    schedule,
    job: { id: job.id, delay: job.opts.delay },
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

  await cancelScheduledJob(videoId);

  const newDate = new Date(newScheduledAt);
  const video   = await Video.findById(videoId);
  const job     = await scheduleVideoPublish(videoId, video.channelId, userId, newDate);

  schedule.scheduledAt = newDate;
  schedule.bullJobId   = job.id;
  schedule.status      = 'pending';
  schedule.failReason  = null;
  await schedule.save();

  video.scheduledAt    = newDate;
  video.status         = 'scheduled';
  video.scheduledJobId = job.id;
  await video.save();

  return { schedule, message: `Rescheduled to ${newDate.toISOString()}` };
};

// ==================== CANCEL SCHEDULE ====================
const cancelSchedule = async (userId, videoId) => {
  const schedule = await Schedule.findOne({ videoId, userId });
  if (!schedule) {
    const err = new Error('Schedule not found');
    err.statusCode = 404;
    throw err;
  }

  // FIX: Cancel BullMQ job
  await cancelScheduledJob(videoId);

  schedule.status = 'cancelled';
  await schedule.save();

  await Video.findByIdAndUpdate(videoId, {
    status:         'draft',
    scheduledAt:    null,
    scheduledJobId: null,
  });

  return { message: 'Schedule cancelled successfully' };
};

// ==================== GET MY SCHEDULES ====================
const getMySchedules = async (userId, filters = {}) => {
  const { status, channelId, from, to, page = 1, limit = 20 } = filters;

  const query = { userId };
  if (status)    query.status    = status;
  if (channelId) query.channelId = channelId;
  if (from || to) {
    query.scheduledAt = {};
    if (from) query.scheduledAt.$gte = new Date(from);
    if (to)   query.scheduledAt.$lte = new Date(to);
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [schedules, total] = await Promise.all([
    Schedule.find(query)
      .sort({ scheduledAt: 1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('videoId',   'title thumbnail status youtubeVideoId')
      .populate('channelId', 'channelName thumbnail'),
    Schedule.countDocuments(query),
  ]);

  return {
    schedules,
    pagination: { page: parseInt(page), limit: parseInt(limit), total },
  };
};

// ==================== GET CALENDAR VIEW ====================
const getCalendarView = async (userId, year, month) => {
  const startDate = new Date(year, month - 1, 1);
  const endDate   = new Date(year, month, 0, 23, 59, 59);

  const schedules = await Schedule.find({
    userId,
    scheduledAt: { $gte: startDate, $lte: endDate },
  })
    .populate('videoId',   'title thumbnail privacy isShort')
    .populate('channelId', 'channelName thumbnail')
    .sort({ scheduledAt: 1 });

  const calendar = {};
  schedules.forEach((schedule) => {
    const dateKey = new Date(schedule.scheduledAt).toISOString().split('T')[0];
    if (!calendar[dateKey]) calendar[dateKey] = [];
    calendar[dateKey].push({
      _id:             schedule._id,
      scheduledAt:     schedule.scheduledAt,
      status:          schedule.status,
      isAiRecommended: schedule.isAiRecommended,
      aiScore:         schedule.aiScore,
      video:           schedule.videoId,
      channel:         schedule.channelId,
    });
  });

  return { calendar, totalScheduled: schedules.length };
};

// ==================== GET JOB STATUS ====================
const getScheduleJobStatus = async (userId, videoId) => {
  const schedule = await Schedule.findOne({ videoId, userId });
  if (!schedule) {
    const err = new Error('Schedule not found');
    err.statusCode = 404;
    throw err;
  }

  const jobStatus = await getJobStatus(videoId);
  return { schedule, job: jobStatus };
};

// ==================== GET QUEUE STATS (Admin) ====================
// FIX: QUEUE_NAMES now imported at top — no undefined reference
const getQueueDashboard = async () => {
  const stats = await getQueueStats();
  return { queue: QUEUE_NAMES.VIDEO_PUBLISH, stats };
};

// ==================== AI BEST TIME RECOMMENDATION ====================
const getBestTimeRecommendation = async (userId, channelId) => {
  const channel = await YoutubeChannel.findOne({ _id: channelId, userId });
  if (!channel) {
    const err = new Error('Channel not found');
    err.statusCode = 404;
    throw err;
  }

  if (channel.bestTimeData?.lastCalculatedAt) {
    const daysSinceCalc = (Date.now() - channel.bestTimeData.lastCalculatedAt) / (1000 * 60 * 60 * 24);
    if (daysSinceCalc < 7 && channel.bestTimeData.bestHours.length > 0) {
      return buildRecommendation(channel.bestTimeData, channel);
    }
  }

  return getDefaultRecommendation(channel);
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
  const errors  = [];

  for (const item of schedules) {
    try {
      const result = await createSchedule(userId, item.videoId, item.scheduledAt, {
        isAiRecommended: item.isAiRecommended,
        aiScore:         item.aiScore,
        aiReason:        item.aiReason,
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
      total:      schedules.length,
      successful: results.length,
      failed:     errors.length,
    },
    message: `${results.length}/${schedules.length} videos scheduled successfully`,
  };
};

// ==================== HELPERS ====================
const buildRecommendation = (bestTimeData, channel) => {
  const nextSlots = getNextBestSlots(bestTimeData.bestDays, bestTimeData.bestHours);
  return {
    channelId:   channel._id,
    channelName: channel.channelName,
    recommendation: {
      bestDays:         bestTimeData.bestDays,
      bestHours:        bestTimeData.bestHours,
      nextOptimalSlots: nextSlots,
      confidence:       'high',
      basedOn:          'channel_analytics',
      lastCalculated:   bestTimeData.lastCalculatedAt,
    },
    message: 'Based on your channel analytics',
  };
};

const getDefaultRecommendation = (channel) => {
  const defaultBestDays  = ['friday', 'saturday', 'sunday'];
  const defaultBestHours = [18, 19, 20, 21];
  const nextSlots = getNextBestSlots(defaultBestDays, defaultBestHours);

  return {
    channelId:   channel._id,
    channelName: channel.channelName,
    recommendation: {
      bestDays:         defaultBestDays,
      bestHours:        defaultBestHours,
      nextOptimalSlots: nextSlots,
      confidence:       'medium',
      basedOn:          'market_research',
      note:             'Connect analytics for personalized recommendations (available after 30 days of data)',
    },
    message: 'Based on India YouTube market research',
  };
};

const getNextBestSlots = (bestDays, bestHours, count = 5) => {
  const dayMap = {
    sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
    thursday: 4, friday: 5, saturday: 6,
  };

  const slots = [];
  const now   = new Date();

  for (let daysAhead = 0; daysAhead <= 14 && slots.length < count; daysAhead++) {
    const date    = new Date(now);
    date.setDate(date.getDate() + daysAhead);
    const dayName = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'][date.getDay()];

    if (bestDays.includes(dayName)) {
      for (const hour of bestHours) {
        const slot = new Date(date);
        slot.setHours(hour, 0, 0, 0);

        if (slot > now && slots.length < count) {
          slots.push({
            datetime: slot.toISOString(),
            day:      dayName,
            hour:     `${hour}:00`,
            score:    Math.floor(Math.random() * 20) + 80,
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
