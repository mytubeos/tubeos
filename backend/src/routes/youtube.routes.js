// src/routes/youtube.routes.js
// All YouTube OAuth + channel management routes

const express = require('express');
const router = express.Router();
const youtubeController = require('../controllers/youtube.controller');
const { protect } = require('../middlewares/auth.middleware');

/**
 * @route   GET /api/v1/youtube/auth
 * @desc    Get YouTube OAuth URL to connect channel
 * @access  Private
 */
router.get('/auth', protect, youtubeController.getAuthUrl);

/**
 * @route   GET /api/v1/youtube/callback
 * @desc    Handle YouTube OAuth callback
 * @access  Public (called by Google, then redirects to frontend)
 */
router.get('/callback', youtubeController.handleCallback);

/**
 * @route   GET /api/v1/youtube/channels
 * @desc    Get all connected YouTube channels
 * @access  Private
 */
router.get('/channels', protect, youtubeController.getMyChannels);

/**
 * @route   POST /api/v1/youtube/channels/:channelId/sync
 * @desc    Sync channel stats from YouTube
 * @access  Private
 */
router.post('/channels/:channelId/sync', protect, youtubeController.syncChannel);

/**
 * @route   PATCH /api/v1/youtube/channels/:channelId/primary
 * @desc    Set a channel as primary/default
 * @access  Private
 */
router.patch('/channels/:channelId/primary', protect, youtubeController.setPrimary);

/**
 * @route   DELETE /api/v1/youtube/channels/:channelId
 * @desc    Disconnect a YouTube channel
 * @access  Private
 */
router.delete('/channels/:channelId', protect, youtubeController.disconnectChannel);

/**
 * @route   GET /api/v1/youtube/channels/:channelId/quota
 * @desc    Get API quota usage for a channel
 * @access  Private
 */
router.get('/channels/:channelId/quota', protect, youtubeController.getQuota);

module.exports = router;
