// src/routes/index.js
// Central route registry

const express = require('express');
const router = express.Router();

// ✅ Ready routes
const authRoutes    = require('./auth.routes');
const youtubeRoutes = require('./youtube.routes');

// ⏳ Ye routes baad mein uncomment karna jab files bana lo
// const videoRoutes    = require('./video.routes');
// const scheduleRoutes = require('./schedule.routes');
// const analyticsRoutes = require('./analytics.routes');
// const aiRoutes        = require('./ai.routes');

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

// Ping — Render ko awake rakhne ke liye (Uptime Robot se hit karo)
router.get('/ping', (req, res) => {
  res.status(200).send('pong 🏓');
});

// ✅ Active routes
router.use('/auth',    authRoutes);
router.use('/youtube', youtubeRoutes);

// ⏳ Baad mein uncomment karna
// router.use('/videos',    videoRoutes);
// router.use('/schedule',  scheduleRoutes);
// router.use('/analytics', analyticsRoutes);
// router.use('/ai',        aiRoutes);

module.exports = router;
