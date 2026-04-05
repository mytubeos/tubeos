// src/controllers/youtube.controller.js
// YouTube OAuth + channel management controller

const youtubeService = require('../services/youtube.service');
const { successResponse, errorResponse } = require('../utils/response.utils');
const { config } = require('../config/env');

// GET /api/v1/youtube/auth
const getAuthUrl = async (req, res) => {
  try {
    const result = await youtubeService.getOAuthUrl(req.user._id, req.user.plan);
    return successResponse(res, 200, 'OAuth URL generated', result);
  } catch (err) {
    return errorResponse(res, err.statusCode || 500, err.message);
  }
};

// GET /api/v1/youtube/callback
const handleCallback = async (req, res) => {
  try {
    const { code, state, error } = req.query;

    // User denied access
    if (error) {
      // Fix 3: /dashboard ki jagah /channels par bhejo
      return res.redirect(
        `${config.cors.clientUrl}/channels?youtube_error=access_denied`
      );
    }

    if (!code || !state) {
      return res.redirect(
        `${config.cors.clientUrl}/channels?youtube_error=missing_params`
      );
    }

    const result = await youtubeService.handleOAuthCallback(code, state);

    // Fix 3: Success — /channels par redirect karo
    return res.redirect(
      `${config.cors.clientUrl}/channels?youtube_connected=true&channel=${encodeURIComponent(result.channel.channelName)}`
    );
  } catch (err) {
    console.error('YouTube callback error:', err);
    // Fix 3: Raw error message query param me mat bhejo
    return res.redirect(
      `${config.cors.clientUrl}/channels?youtube_error=connect_failed`
    );
  }
};

// GET /api/v1/youtube/channels
const getMyChannels = async (req, res) => {
  try {
    const result = await youtubeService.getMyChannels(req.user._id);
    // Fix 4: result.channels already [] hoga agar koi channel nahi — 500 nahi aayega
    return successResponse(res, 200, 'Channels fetched', result.channels);
  } catch (err) {
    return errorResponse(res, err.statusCode || 500, err.message);
  }
};

// POST /api/v1/youtube/channels/:channelId/sync
const syncChannel = async (req, res) => {
  try {
    const result = await youtubeService.syncChannelStats(
      req.params.channelId,
      req.user._id
    );
    return successResponse(res, 200, 'Channel synced', result.channel);
  } catch (err) {
    return errorResponse(res, err.statusCode || 500, err.message);
  }
};

// DELETE /api/v1/youtube/channels/:channelId
const disconnectChannel = async (req, res) => {
  try {
    const result = await youtubeService.disconnectChannel(
      req.params.channelId,
      req.user._id
    );
    return successResponse(res, 200, result.message);
  } catch (err) {
    return errorResponse(res, err.statusCode || 500, err.message);
  }
};

// PATCH /api/v1/youtube/channels/:channelId/primary
const setPrimary = async (req, res) => {
  try {
    const result = await youtubeService.setPrimaryChannel(
      req.params.channelId,
      req.user._id
    );
    return successResponse(res, 200, result.message, result.channel);
  } catch (err) {
    return errorResponse(res, err.statusCode || 500, err.message);
  }
};

// GET /api/v1/youtube/channels/:channelId/quota
const getQuota = async (req, res) => {
  try {
    const result = await youtubeService.getQuotaStatus(
      req.params.channelId,
      req.user._id
    );
    return successResponse(res, 200, 'Quota status', result.quota);
  } catch (err) {
    return errorResponse(res, err.statusCode || 500, err.message);
  }
};

module.exports = {
  getAuthUrl,
  handleCallback,
  getMyChannels,
  syncChannel,
  disconnectChannel,
  setPrimary,
  getQuota,
};
