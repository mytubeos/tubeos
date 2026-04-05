// src/routes/index.js
// Central route registry — all routes registered here

const express = require('express');
const router = express.Router();

// Import all route modules
const authRoutes = require('./auth.routes');
const youtubeRoutes = require('./youtube.routes');   // Part 2
const videoRoutes = require('./video.routes');        // Part 2
const scheduleRoutes = require('./schedule.routes');       // Part 3
const analyticsRoutes = require('./analytics.routes');     // Part 4
const aiRoutes = require('./ai.routes');                   // Part 5
// Future routes
// const analyticsRoutes = require('./analytics.routes');
// const aiRoutes = require('./ai.routes');
// const heatmapRoutes = require('./heatmap.routes');
// const monetizationRoutes = require('./monetization.routes');
// const livestreamRoutes = require('./livestream.routes');
// const shortsRoutes = require('./shorts.routes');
// const competitorRoutes = require('./competitor.routes');
// const trendRoutes = require('./trend.routes');
// const reportRoutes = require('./report.routes');
// const referralRoutes = require('./referral.routes');
// const paymentRoutes = require('./payment.routes');

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

// Ping (for Uptime Robot to keep Render awake)
router.get('/ping', (req, res) => {
  res.status(200).send('pong 🏓');
});

// Mount routes
router.use('/auth', authRoutes);
router.use('/youtube', youtubeRoutes);    // Part 2
router.use('/videos', videoRoutes);        // Part 2
router.use('/schedule', scheduleRoutes);   // Part 3
router.use('/analytics', analyticsRoutes);   // Part 4
router.use('/ai', aiRoutes);                  // Part 5
// router.use('/heatmap', heatmapRoutes);
// router.use('/monetization', monetizationRoutes);
// router.use('/livestream', livestreamRoutes);
// router.use('/shorts', shortsRoutes);
// router.use('/competitors', competitorRoutes);
// router.use('/trends', trendRoutes);
// router.use('/reports', reportRoutes);
// router.use('/referral', referralRoutes);
// router.use('/payments', paymentRoutes);

module.exports = router;
