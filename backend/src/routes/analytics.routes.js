// src/routes/analytics.routes.js
// Analytics + Time Intelligence + Growth routes

const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analytics.controller');
const { protect, requirePlan } = require('../middlewares/auth.middleware');

// ==================== ANALYTICS ENGINE ====================

// POST /api/v1/analytics/:channelId/sync
router.post('/:channelId/sync', protect, analyticsController.syncAnalytics);

// GET /api/v1/analytics/:channelId/overview?period=30d
router.get('/:channelId/overview', protect, analyticsController.getOverview);

// GET /api/v1/analytics/:channelId/graph?period=30d&metric=views
router.get('/:channelId/graph', protect, analyticsController.getDailyGraph);

// GET /api/v1/analytics/:channelId/day-wise?period=90d
router.get('/:channelId/day-wise', protect, analyticsController.getDayWise);

// GET /api/v1/analytics/:channelId/top-videos?limit=10&sortBy=views
router.get('/:channelId/top-videos', protect, analyticsController.getTopVideos);

// GET /api/v1/analytics/:channelId/traffic-sources?period=30d
router.get('/:channelId/traffic-sources', protect, analyticsController.getTrafficSources);

// GET /api/v1/analytics/video/:videoId
router.get('/video/:videoId', protect, analyticsController.getVideoBreakdown);

// ==================== TIME INTELLIGENCE ====================

// GET /api/v1/analytics/:channelId/heatmap
router.get(
  '/:channelId/heatmap',
  protect,
  requirePlan('creator', 'pro', 'agency'),
  analyticsController.getHeatmap
);

// POST /api/v1/analytics/:channelId/heatmap/rebuild
router.post(
  '/:channelId/heatmap/rebuild',
  protect,
  requirePlan('creator', 'pro', 'agency'),
  analyticsController.rebuildHeatmap
);

// GET /api/v1/analytics/:channelId/best-time?count=5
router.get(
  '/:channelId/best-time',
  protect,
  requirePlan('creator', 'pro', 'agency'),
  analyticsController.getBestTime
);

// GET /api/v1/analytics/:channelId/low-traffic
router.get(
  '/:channelId/low-traffic',
  protect,
  requirePlan('creator', 'pro', 'agency'),
  analyticsController.getLowTraffic
);

// ==================== GROWTH INTELLIGENCE ====================

// GET /api/v1/analytics/:channelId/growth
router.get(
  '/:channelId/growth',
  protect,
  requirePlan('creator', 'pro', 'agency'),
  analyticsController.getGrowth
);

// GET /api/v1/analytics/:channelId/suggestions
router.get('/:channelId/suggestions', protect, analyticsController.getSuggestions);

// GET /api/v1/analytics/:channelId/trends?category=Technology
router.get(
  '/:channelId/trends',
  protect,
  requirePlan('pro', 'agency'),
  analyticsController.getTrends
);

// ==================== COMPETITOR TRACKING ====================

// GET /api/v1/analytics/:channelId/competitors
router.get(
  '/:channelId/competitors',
  protect,
  requirePlan('pro', 'agency'),
  analyticsController.getCompetitors
);

// POST /api/v1/analytics/:channelId/competitors
router.post(
  '/:channelId/competitors',
  protect,
  requirePlan('pro', 'agency'),
  analyticsController.addCompetitor
);

// POST /api/v1/analytics/competitors/:competitorId/sync
router.post(
  '/competitors/:competitorId/sync',
  protect,
  requirePlan('pro', 'agency'),
  analyticsController.syncCompetitor
);

// DELETE /api/v1/analytics/competitors/:competitorId
router.delete(
  '/competitors/:competitorId',
  protect,
  requirePlan('pro', 'agency'),
  analyticsController.removeCompetitor
);

module.exports = router;
