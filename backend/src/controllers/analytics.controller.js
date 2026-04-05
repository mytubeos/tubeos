// src/controllers/analytics.controller.js
// Analytics + Time Intelligence + Growth controller

const analyticsService = require('../services/analytics.service');
const heatmapService = require('../services/heatmap.service');
const growthService = require('../services/growth.service');
const { successResponse, errorResponse } = require('../utils/response.utils');

// ==================== ANALYTICS ====================

// POST /api/v1/analytics/:channelId/sync
const syncAnalytics = async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const result = await analyticsService.syncChannelAnalytics(
      req.params.channelId, req.user._id, parseInt(days)
    );
    return successResponse(res, 200, result.message, result);
  } catch (err) {
    return errorResponse(res, err.statusCode || 500, err.message);
  }
};

// GET /api/v1/analytics/:channelId/overview
const getOverview = async (req, res) => {
  try {
    const { period = '30d' } = req.query;
    const result = await analyticsService.getOverview(
      req.user._id, req.params.channelId, period
    );
    return successResponse(res, 200, 'Overview fetched', result);
  } catch (err) {
    return errorResponse(res, err.statusCode || 500, err.message);
  }
};

// GET /api/v1/analytics/:channelId/graph
const getDailyGraph = async (req, res) => {
  try {
    const { period = '30d', metric = 'views' } = req.query;
    const result = await analyticsService.getDailyGraph(
      req.user._id, req.params.channelId, period, metric
    );
    return successResponse(res, 200, 'Graph data fetched', result);
  } catch (err) {
    return errorResponse(res, err.statusCode || 500, err.message);
  }
};

// GET /api/v1/analytics/:channelId/day-wise
const getDayWise = async (req, res) => {
  try {
    const { period = '90d' } = req.query;
    const result = await analyticsService.getDayWisePerformance(
      req.user._id, req.params.channelId, period
    );
    return successResponse(res, 200, 'Day-wise performance', result);
  } catch (err) {
    return errorResponse(res, err.statusCode || 500, err.message);
  }
};

// GET /api/v1/analytics/:channelId/top-videos
const getTopVideos = async (req, res) => {
  try {
    const { limit = 10, sortBy = 'views' } = req.query;
    const result = await analyticsService.getTopVideos(
      req.user._id, req.params.channelId, parseInt(limit), sortBy
    );
    return successResponse(res, 200, 'Top videos', result);
  } catch (err) {
    return errorResponse(res, err.statusCode || 500, err.message);
  }
};

// GET /api/v1/analytics/video/:videoId
const getVideoBreakdown = async (req, res) => {
  try {
    const result = await analyticsService.getVideoBreakdown(
      req.user._id, req.params.videoId
    );
    return successResponse(res, 200, 'Video analytics', result);
  } catch (err) {
    return errorResponse(res, err.statusCode || 500, err.message);
  }
};

// GET /api/v1/analytics/:channelId/traffic-sources
const getTrafficSources = async (req, res) => {
  try {
    const { period = '30d' } = req.query;
    const result = await analyticsService.getTrafficSources(
      req.user._id, req.params.channelId, period
    );
    return successResponse(res, 200, 'Traffic sources', result);
  } catch (err) {
    return errorResponse(res, err.statusCode || 500, err.message);
  }
};

// ==================== TIME INTELLIGENCE ====================

// GET /api/v1/analytics/:channelId/heatmap
const getHeatmap = async (req, res) => {
  try {
    const result = await heatmapService.getHeatmap(
      req.user._id, req.params.channelId
    );
    return successResponse(res, 200, 'Heatmap data', result);
  } catch (err) {
    return errorResponse(res, err.statusCode || 500, err.message);
  }
};

// POST /api/v1/analytics/:channelId/heatmap/rebuild
const rebuildHeatmap = async (req, res) => {
  try {
    const result = await heatmapService.buildHeatmap(
      req.user._id, req.params.channelId
    );
    return successResponse(res, 200, result.message, result.heatmap);
  } catch (err) {
    return errorResponse(res, err.statusCode || 500, err.message);
  }
};

// GET /api/v1/analytics/:channelId/best-time
const getBestTime = async (req, res) => {
  try {
    const { count = 5 } = req.query;
    const result = await heatmapService.getBestTimeSlots(
      req.user._id, req.params.channelId, parseInt(count)
    );
    return successResponse(res, 200, 'Best posting times', result);
  } catch (err) {
    return errorResponse(res, err.statusCode || 500, err.message);
  }
};

// GET /api/v1/analytics/:channelId/low-traffic
const getLowTraffic = async (req, res) => {
  try {
    const result = await heatmapService.getLowTrafficHours(
      req.user._id, req.params.channelId
    );
    return successResponse(res, 200, 'Low traffic hours', result);
  } catch (err) {
    return errorResponse(res, err.statusCode || 500, err.message);
  }
};

// ==================== GROWTH INTELLIGENCE ====================

// GET /api/v1/analytics/:channelId/growth
const getGrowth = async (req, res) => {
  try {
    const result = await growthService.getGrowthPrediction(
      req.user._id, req.params.channelId
    );
    return successResponse(res, 200, 'Growth prediction', result);
  } catch (err) {
    return errorResponse(res, err.statusCode || 500, err.message);
  }
};

// GET /api/v1/analytics/:channelId/suggestions
const getSuggestions = async (req, res) => {
  try {
    const result = await growthService.getPerformanceSuggestions(
      req.user._id, req.params.channelId
    );
    return successResponse(res, 200, 'Performance suggestions', result);
  } catch (err) {
    return errorResponse(res, err.statusCode || 500, err.message);
  }
};

// GET /api/v1/analytics/:channelId/trends
const getTrends = async (req, res) => {
  try {
    const { category } = req.query;
    const result = await growthService.getTrends(
      req.user._id, req.params.channelId, category
    );
    return successResponse(res, 200, 'Trends', result);
  } catch (err) {
    return errorResponse(res, err.statusCode || 500, err.message);
  }
};

// POST /api/v1/analytics/:channelId/competitors
const addCompetitor = async (req, res) => {
  try {
    const { youtubeChannelId } = req.body;
    if (!youtubeChannelId) return errorResponse(res, 400, 'youtubeChannelId is required');

    const result = await growthService.addCompetitor(
      req.user._id, req.params.channelId, youtubeChannelId
    );
    return successResponse(res, 201, result.message, result.competitor);
  } catch (err) {
    return errorResponse(res, err.statusCode || 500, err.message);
  }
};

// GET /api/v1/analytics/:channelId/competitors
const getCompetitors = async (req, res) => {
  try {
    const result = await growthService.getCompetitors(
      req.user._id, req.params.channelId
    );
    return successResponse(res, 200, 'Competitors', result.competitors);
  } catch (err) {
    return errorResponse(res, err.statusCode || 500, err.message);
  }
};

// POST /api/v1/analytics/competitors/:competitorId/sync
const syncCompetitor = async (req, res) => {
  try {
    const result = await growthService.syncCompetitor(
      req.user._id, req.params.competitorId
    );
    return successResponse(res, 200, result.message, result.competitor);
  } catch (err) {
    return errorResponse(res, err.statusCode || 500, err.message);
  }
};

// DELETE /api/v1/analytics/competitors/:competitorId
const removeCompetitor = async (req, res) => {
  try {
    const result = await growthService.removeCompetitor(
      req.user._id, req.params.competitorId
    );
    return successResponse(res, 200, result.message);
  } catch (err) {
    return errorResponse(res, err.statusCode || 500, err.message);
  }
};

module.exports = {
  syncAnalytics,
  getOverview,
  getDailyGraph,
  getDayWise,
  getTopVideos,
  getVideoBreakdown,
  getTrafficSources,
  getHeatmap,
  rebuildHeatmap,
  getBestTime,
  getLowTraffic,
  getGrowth,
  getSuggestions,
  getTrends,
  addCompetitor,
  getCompetitors,
  syncCompetitor,
  removeCompetitor,
};
