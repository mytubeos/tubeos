// src/controllers/analytics.controller.js
// FIX: req.user._id → req.user.id (all functions)

const analyticsService = require('../services/analytics.service');
const heatmapService   = require('../services/heatmap.service');
const growthService    = require('../services/growth.service');
const { successResponse, errorResponse } = require('../utils/response.utils');

// ==================== ANALYTICS ====================

const syncAnalytics = async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const result = await analyticsService.syncChannelAnalytics(
      req.params.channelId, req.user.id, parseInt(days)
    );
    return successResponse(res, 200, result.message, result);
  } catch (err) {
    return errorResponse(res, err.statusCode || 500, err.message);
  }
};

const getOverview = async (req, res) => {
  try {
    const { period = '30d' } = req.query;
    const result = await analyticsService.getOverview(req.user.id, req.params.channelId, period);
    return successResponse(res, 200, 'Overview fetched', result);
  } catch (err) {
    return errorResponse(res, err.statusCode || 500, err.message);
  }
};

const getDailyGraph = async (req, res) => {
  try {
    const { period = '30d', metric = 'views' } = req.query;
    const result = await analyticsService.getDailyGraph(req.user.id, req.params.channelId, period, metric);
    return successResponse(res, 200, 'Graph data fetched', result);
  } catch (err) {
    return errorResponse(res, err.statusCode || 500, err.message);
  }
};

const getDayWise = async (req, res) => {
  try {
    const { period = '90d' } = req.query;
    const result = await analyticsService.getDayWisePerformance(req.user.id, req.params.channelId, period);
    return successResponse(res, 200, 'Day-wise performance', result);
  } catch (err) {
    return errorResponse(res, err.statusCode || 500, err.message);
  }
};

const getTopVideos = async (req, res) => {
  try {
    const { limit = 10, sortBy = 'views' } = req.query;
    const result = await analyticsService.getTopVideos(req.user.id, req.params.channelId, parseInt(limit), sortBy);
    return successResponse(res, 200, 'Top videos', result);
  } catch (err) {
    return errorResponse(res, err.statusCode || 500, err.message);
  }
};

const getVideoBreakdown = async (req, res) => {
  try {
    const result = await analyticsService.getVideoBreakdown(req.user.id, req.params.videoId);
    return successResponse(res, 200, 'Video analytics', result);
  } catch (err) {
    return errorResponse(res, err.statusCode || 500, err.message);
  }
};

const getTrafficSources = async (req, res) => {
  try {
    const { period = '30d' } = req.query;
    const result = await analyticsService.getTrafficSources(req.user.id, req.params.channelId, period);
    return successResponse(res, 200, 'Traffic sources', result);
  } catch (err) {
    return errorResponse(res, err.statusCode || 500, err.message);
  }
};

// ==================== TIME INTELLIGENCE ====================

const getHeatmap = async (req, res) => {
  try {
    const result = await heatmapService.getHeatmap(req.user.id, req.params.channelId);
    return successResponse(res, 200, 'Heatmap data', result);
  } catch (err) {
    return errorResponse(res, err.statusCode || 500, err.message);
  }
};

const rebuildHeatmap = async (req, res) => {
  try {
    const result = await heatmapService.buildHeatmap(req.user.id, req.params.channelId);
    return successResponse(res, 200, result.message, result.heatmap);
  } catch (err) {
    return errorResponse(res, err.statusCode || 500, err.message);
  }
};

const getBestTime = async (req, res) => {
  try {
    const { count = 5 } = req.query;
    const result = await heatmapService.getBestTimeSlots(req.user.id, req.params.channelId, parseInt(count));
    return successResponse(res, 200, 'Best posting times', result);
  } catch (err) {
    return errorResponse(res, err.statusCode || 500, err.message);
  }
};

const getLowTraffic = async (req, res) => {
  try {
    const result = await heatmapService.getLowTrafficHours(req.user.id, req.params.channelId);
    return successResponse(res, 200, 'Low traffic hours', result);
  } catch (err) {
    return errorResponse(res, err.statusCode || 500, err.message);
  }
};

// ==================== GROWTH INTELLIGENCE ====================

const getGrowth = async (req, res) => {
  try {
    const result = await growthService.getGrowthPrediction(req.user.id, req.params.channelId);
    return successResponse(res, 200, 'Growth prediction', result);
  } catch (err) {
    return errorResponse(res, err.statusCode || 500, err.message);
  }
};

const getSuggestions = async (req, res) => {
  try {
    const result = await growthService.getPerformanceSuggestions(req.user.id, req.params.channelId);
    return successResponse(res, 200, 'Performance suggestions', result);
  } catch (err) {
    return errorResponse(res, err.statusCode || 500, err.message);
  }
};

const getTrends = async (req, res) => {
  try {
    const { category } = req.query;
    const result = await growthService.getTrends(req.user.id, req.params.channelId, category);
    return successResponse(res, 200, 'Trends', result);
  } catch (err) {
    return errorResponse(res, err.statusCode || 500, err.message);
  }
};

const addCompetitor = async (req, res) => {
  try {
    const { youtubeChannelId } = req.body;
    if (!youtubeChannelId) return errorResponse(res, 400, 'youtubeChannelId is required');
    const result = await growthService.addCompetitor(req.user.id, req.params.channelId, youtubeChannelId);
    return successResponse(res, 201, result.message, result.competitor);
  } catch (err) {
    return errorResponse(res, err.statusCode || 500, err.message);
  }
};

const getCompetitors = async (req, res) => {
  try {
    const result = await growthService.getCompetitors(req.user.id, req.params.channelId);
    return successResponse(res, 200, 'Competitors', result.competitors);
  } catch (err) {
    return errorResponse(res, err.statusCode || 500, err.message);
  }
};

const syncCompetitor = async (req, res) => {
  try {
    const result = await growthService.syncCompetitor(req.user.id, req.params.competitorId);
    return successResponse(res, 200, result.message, result.competitor);
  } catch (err) {
    return errorResponse(res, err.statusCode || 500, err.message);
  }
};

const removeCompetitor = async (req, res) => {
  try {
    const result = await growthService.removeCompetitor(req.user.id, req.params.competitorId);
    return successResponse(res, 200, result.message);
  } catch (err) {
    return errorResponse(res, err.statusCode || 500, err.message);
  }
};

module.exports = {
  syncAnalytics, getOverview, getDailyGraph, getDayWise, getTopVideos,
  getVideoBreakdown, getTrafficSources, getHeatmap, rebuildHeatmap,
  getBestTime, getLowTraffic, getGrowth, getSuggestions, getTrends,
  addCompetitor, getCompetitors, syncCompetitor, removeCompetitor,
};
