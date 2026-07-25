// src/routes/notification.routes.js
const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth.middleware');
const { getAll, markRead, markAllRead } = require('../controllers/notification.controller');

router.use(protect);

/**
 * @route   GET /api/v1/notifications
 * @desc    Get the current user's Chingari notification feed
 * @access  Private
 * @query   page?, limit?
 */
router.get('/', getAll);

/**
 * @route   PATCH /api/v1/notifications/read-all
 * @desc    Mark every unread notification as read
 * @access  Private
 */
router.patch('/read-all', markAllRead);

/**
 * @route   PATCH /api/v1/notifications/:id/read
 * @desc    Mark one notification as read
 * @access  Private
 */
router.patch('/:id/read', markRead);

module.exports = router;
