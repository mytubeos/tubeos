// src/controllers/youtube.controller.js
// YouTube OAuth + channel management controller
//
// FIXES:
// 1. getAuthUrl — req.user._id ki jagah req.user.id use karo (JWT middleware se)
// 2. handleCallback — error query param me raw message nahi, safe code bhejo
// 3. Redirect paths /dashboard → /channels (tumhari routes ke hisaab se)

const youtubeService = require('../services/youtube.service');
const { successResponse, errorResponse } = require('../utils/response.utils');
const { config } = require('../config/env');

// GET /api/v1/youtube/auth
// FIX 1: req.user.id — JWT middleware 'id' attach karta hai, '_id' nahi
const getAuthUrl = async (req, res) => {
  try {
    const result = await youtubeService.getOAuthUrl(req.user.id, req.user.plan);
    return successResponse(res, 200, 'OAuth URL generated', result);
  } catch (err) {
    return errorResponse(res, err.statusCode || 500, err.message);
  }
};

// GET /api/v1/youtube/callback
// FIX 2: Error query param mein raw message nahi — safe error codes bhejo
// FIX 3: /channels pe redirect karo
const handleCallback = async (req, res) => {
  try {
    const { code, state, error } = req.query;

    if (error) {
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

    return res.redirect(
      `${config.cors.clientUrl}/channels?youtube_connected=true&channel=${encodeURIComponent(result.channel.channelName)}`
    );
  } catch (err) {
    console.error('[youtube.controller] Callback error:', err.message, '| code:', err.code);

    // FIX: error code ke hisaab se frontend ko sahi message do
    const errorCode = err.code === 'NO_REFRESH_TOKEN'
      ? 'no_refresh_token'
      : err.code === 'RECONNECT_REQUIRED'
      ? 'reconnect_required'
      : err.statusCode === 409
      ? 'already_connected'
      : 'connect_failed';

    return res.redirect(
      `${config.cors.clientUrl}/channels?youtube_error=${errorCode}`
    );
  }
};

// GET /api/v1/youtube/channels
const getMyChannels = async (req, res) => {
  try {
    const result = await youtubeService.getMyChannels(req.user.id);
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
      req.user.id
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
      req.user.id
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
      req.user.id
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
      req.user.id
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
