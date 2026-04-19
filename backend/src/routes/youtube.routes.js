// src/routes/youtube.routes.js
// YouTube OAuth + channel management routes
//
// IMPORTANT: /callback route pe 'protect' middleware NAHI lagana
// Callback Google se aata hai — uske paas JWT token nahi hota
// State verification Redis se hoti hai (youtube.service.js mein)

const express = require('express');
const router = express.Router();
const youtubeController = require('../controllers/youtube.controller');
const { protect } = require('../middlewares/auth.middleware');

/**
 * @route   GET /api/v1/youtube/auth
 * @desc    YouTube OAuth URL generate karo
 * @access  Private — logged-in user
 */
router.get('/auth', protect, youtubeController.getAuthUrl);

/**
 * @route   GET /api/v1/youtube/callback
 * @desc    Google OAuth callback — protect middleware NAHI lagana
 * @access  Public — Google redirect karta hai yahan
 */
router.get('/callback', youtubeController.handleCallback);

/**
 * @route   GET /api/v1/youtube/channels
 * @desc    Logged-in user ke connected channels
 * @access  Private
 */
router.get('/channels', protect, youtubeController.getMyChannels);

/**
 * @route   POST /api/v1/youtube/channels/:channelId/sync
 * @desc    Channel stats YouTube se sync karo
 * @access  Private
 */
router.post('/channels/:channelId/sync', protect, youtubeController.syncChannel);

/**
 * @route   DELETE /api/v1/youtube/channels/:channelId
 * @desc    Channel disconnect karo
 * @access  Private
 */
router.delete('/channels/:channelId', protect, youtubeController.disconnectChannel);

/**
 * @route   PATCH /api/v1/youtube/channels/:channelId/primary
 * @desc    Primary channel set karo
 * @access  Private
 */
router.patch('/channels/:channelId/primary', protect, youtubeController.setPrimary);

/**
 * @route   GET /api/v1/youtube/channels/:channelId/quota
 * @desc    Channel quota status
 * @access  Private
 */
router.get('/channels/:channelId/quota', protect, youtubeController.getQuota);

module.exports = router;
