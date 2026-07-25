// src/controllers/notification.controller.js
const notificationService = require('../services/notification.service');
const { successResponse, errorResponse } = require('../utils/response.utils');

const getAll = async (req, res) => {
  try {
    const result = await notificationService.getNotifications(req.user.id, req.query);
    return successResponse(res, 200, 'Notifications fetched', result);
  } catch (err) {
    return errorResponse(res, err.statusCode || 500, err.message);
  }
};

const markRead = async (req, res) => {
  try {
    const notification = await notificationService.markAsRead(req.user.id, req.params.id);
    return successResponse(res, 200, 'Notification marked read', notification);
  } catch (err) {
    return errorResponse(res, err.statusCode || 500, err.message);
  }
};

const markAllRead = async (req, res) => {
  try {
    const result = await notificationService.markAllRead(req.user.id);
    return successResponse(res, 200, result.message);
  } catch (err) {
    return errorResponse(res, err.statusCode || 500, err.message);
  }
};

module.exports = { getAll, markRead, markAllRead };
