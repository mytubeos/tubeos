// src/controllers/schedule.controller.js
// FIX: req.user._id → req.user.id (consistent)

const scheduleService = require('../services/schedule.service');
const {
  successResponse,
  errorResponse,
  paginatedResponse,
} = require('../utils/response.utils');

const createSchedule = async (req, res) => {
  try {
    const { videoId, scheduledAt, timezone, isAiRecommended, aiScore, aiReason } = req.body;
    if (!videoId || !scheduledAt) {
      return errorResponse(res, 400, 'videoId and scheduledAt are required');
    }
    const result = await scheduleService.createSchedule(
      req.user.id, videoId, scheduledAt,
      { timezone, isAiRecommended, aiScore, aiReason }
    );
    return successResponse(res, 201, result.message, result.schedule);
  } catch (err) {
    return errorResponse(res, err.statusCode || 500, err.message);
  }
};

const reschedule = async (req, res) => {
  try {
    const { scheduledAt } = req.body;
    if (!scheduledAt) return errorResponse(res, 400, 'New scheduledAt is required');
    const result = await scheduleService.reschedule(req.user.id, req.params.videoId, scheduledAt);
    return successResponse(res, 200, result.message, result.schedule);
  } catch (err) {
    return errorResponse(res, err.statusCode || 500, err.message);
  }
};

const cancelSchedule = async (req, res) => {
  try {
    const result = await scheduleService.cancelSchedule(req.user.id, req.params.videoId);
    return successResponse(res, 200, result.message);
  } catch (err) {
    return errorResponse(res, err.statusCode || 500, err.message);
  }
};

const getMySchedules = async (req, res) => {
  try {
    const result = await scheduleService.getMySchedules(req.user.id, req.query);
    return paginatedResponse(res, 200, 'Schedules fetched', result.schedules, result.pagination);
  } catch (err) {
    return errorResponse(res, err.statusCode || 500, err.message);
  }
};

const getCalendar = async (req, res) => {
  try {
    const { year, month } = req.query;
    const now = new Date();
    const result = await scheduleService.getCalendarView(
      req.user.id,
      parseInt(year)  || now.getFullYear(),
      parseInt(month) || now.getMonth() + 1
    );
    return successResponse(res, 200, 'Calendar fetched', result);
  } catch (err) {
    return errorResponse(res, err.statusCode || 500, err.message);
  }
};

const getJobStatus = async (req, res) => {
  try {
    const result = await scheduleService.getScheduleJobStatus(req.user.id, req.params.videoId);
    return successResponse(res, 200, 'Job status', result);
  } catch (err) {
    return errorResponse(res, err.statusCode || 500, err.message);
  }
};

const getBestTime = async (req, res) => {
  try {
    const result = await scheduleService.getBestTimeRecommendation(req.user.id, req.params.channelId);
    return successResponse(res, 200, 'Best time recommendation', result);
  } catch (err) {
    return errorResponse(res, err.statusCode || 500, err.message);
  }
};

const bulkSchedule = async (req, res) => {
  try {
    const { schedules } = req.body;
    if (!schedules) return errorResponse(res, 400, 'schedules array is required');
    const result = await scheduleService.bulkSchedule(req.user.id, schedules);
    return successResponse(res, 200, result.message, result);
  } catch (err) {
    return errorResponse(res, err.statusCode || 500, err.message);
  }
};

const getQueueStats = async (req, res) => {
  try {
    const result = await scheduleService.getQueueDashboard();
    return successResponse(res, 200, 'Queue stats', result);
  } catch (err) {
    return errorResponse(res, err.statusCode || 500, err.message);
  }
};

module.exports = {
  createSchedule,
  reschedule,
  cancelSchedule,
  getMySchedules,
  getCalendar,
  getJobStatus,
  getBestTime,
  bulkSchedule,
  getQueueStats,
};
