// src/routes/schedule.routes.js
// All scheduling routes

const express = require('express');
const router = express.Router();
const scheduleController = require('../controllers/schedule.controller');
const { protect, requirePlan } = require('../middlewares/auth.middleware');

/**
 * @route   GET /api/v1/schedule
 * @desc    Get all my scheduled posts
 * @access  Private
 * @query   status, channelId, from, to, page, limit
 */
router.get('/', protect, scheduleController.getMySchedules);

/**
 * @route   GET /api/v1/schedule/calendar
 * @desc    Get calendar view of schedules
 * @access  Private
 * @query   year, month
 */
router.get('/calendar', protect, scheduleController.getCalendar);

/**
 * @route   GET /api/v1/schedule/queue/stats
 * @desc    Get BullMQ queue stats (admin)
 * @access  Private
 */
router.get('/queue/stats', protect, scheduleController.getQueueStats);

/**
 * @route   GET /api/v1/schedule/best-time/:channelId
 * @desc    Get AI best time recommendation for a channel
 * @access  Private (Creator plan+)
 */
router.get(
  '/best-time/:channelId',
  protect,
  requirePlan('creator', 'pro', 'agency'),
  scheduleController.getBestTime
);

/**
 * @route   GET /api/v1/schedule/:videoId/status
 * @desc    Get BullMQ job status for a scheduled video
 * @access  Private
 */
router.get('/:videoId/status', protect, scheduleController.getJobStatus);

/**
 * @route   POST /api/v1/schedule
 * @desc    Schedule a video
 * @access  Private
 * @body    { videoId, scheduledAt, timezone?, isAiRecommended? }
 */
router.post('/', protect, scheduleController.createSchedule);

/**
 * @route   POST /api/v1/schedule/bulk
 * @desc    Bulk schedule multiple videos
 * @access  Private (Pro plan+)
 */
router.post(
  '/bulk',
  protect,
  requirePlan('pro', 'agency'),
  scheduleController.bulkSchedule
);

/**
 * @route   PATCH /api/v1/schedule/:videoId/reschedule
 * @desc    Reschedule a video to a new time
 * @access  Private
 * @body    { scheduledAt }
 */
router.patch('/:videoId/reschedule', protect, scheduleController.reschedule);

/**
 * @route   DELETE /api/v1/schedule/:videoId
 * @desc    Cancel a scheduled video
 * @access  Private
 */
router.delete('/:videoId', protect, scheduleController.cancelSchedule);

module.exports = router;
