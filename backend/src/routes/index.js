// src/routes/index.js
// Central route registry
// FIX: Sabhi routes uncomment kar diye — video, schedule, analytics, ai

const express = require('express');
const router = express.Router();

const authRoutes      = require('./auth.routes');
const youtubeRoutes   = require('./youtube.routes');
const videoRoutes     = require('./video.routes');
const scheduleRoutes  = require('./schedule.routes');
const analyticsRoutes = require('./analytics.routes');
const aiRoutes        = require('./ai.routes');

// Health check
router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: '🚀 TubeOS API is running!',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  });
});

// Ping — keep-alive for Render
router.get('/ping', (req, res) => {
  res.status(200).send('pong 🏓');
});

// All routes
router.use('/auth',      authRoutes);
router.use('/youtube',   youtubeRoutes);
router.use('/videos',    videoRoutes);
router.use('/schedule',  scheduleRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/ai',        aiRoutes);

module.exports = router;
