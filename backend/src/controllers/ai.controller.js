// src/controllers/ai.controller.js
// FIX: req.user._id → req.user.id (all functions)

const aiCommentService  = require('../services/ai-comment.service');
const aiContentService  = require('../services/ai-content.service');
const { successResponse, errorResponse, paginatedResponse } = require('../utils/response.utils');

// ==================== COMMENTS ====================

const syncComments = async (req, res) => {
  try {
    const { youtubeVideoId } = req.query;
    const result = await aiCommentService.syncComments(req.user.id, req.params.channelId, youtubeVideoId);
    return successResponse(res, 200, result.message, result);
  } catch (err) {
    return errorResponse(res, err.statusCode || 500, err.message);
  }
};

const getInbox = async (req, res) => {
  try {
    const result = await aiCommentService.getCommentInbox(req.user.id, req.params.channelId, req.query);
    // FIX: paginatedResponse 6th param (meta) — stats pass karo
    return paginatedResponse(res, 200, 'Comments fetched',
      result.comments, result.pagination, { stats: result.stats }
    );
  } catch (err) {
    return errorResponse(res, err.statusCode || 500, err.message);
  }
};

const generateReply = async (req, res) => {
  try {
    const { tone = 'friendly' } = req.body;
    const result = await aiCommentService.generateReply(req.user.id, req.params.commentId, tone);
    return successResponse(res, 200, result.message, result.comment);
  } catch (err) {
    return errorResponse(res, err.statusCode || 500, err.message);
  }
};

const postReply = async (req, res) => {
  try {
    const { replyText } = req.body;
    const result = await aiCommentService.postReply(req.user.id, req.params.commentId, replyText);
    return successResponse(res, 200, result.message, result.comment);
  } catch (err) {
    return errorResponse(res, err.statusCode || 500, err.message);
  }
};

const bulkGenerateReplies = async (req, res) => {
  try {
    const { channelId, commentIds, tone = 'friendly' } = req.body;
    if (!channelId || !commentIds?.length) {
      return errorResponse(res, 400, 'channelId and commentIds required');
    }
    const result = await aiCommentService.bulkGenerateReplies(req.user.id, channelId, commentIds, tone);
    return successResponse(res, 200, 'Bulk replies generated', result);
  } catch (err) {
    return errorResponse(res, err.statusCode || 500, err.message);
  }
};

const updateStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['unread', 'pending_reply', 'replied', 'ignored', 'flagged'];
    if (!validStatuses.includes(status)) {
      return errorResponse(res, 400, `Status must be one of: ${validStatuses.join(', ')}`);
    }
    const result = await aiCommentService.updateCommentStatus(req.user.id, req.params.commentId, status);
    return successResponse(res, 200, 'Status updated', result.comment);
  } catch (err) {
    return errorResponse(res, err.statusCode || 500, err.message);
  }
};

// ==================== CONTENT ENGINE ====================

const generateTitles = async (req, res) => {
  try {
    const { topic, description, tags, channelNiche, count } = req.body;
    if (!topic) return errorResponse(res, 400, 'topic is required');
    const result = await aiContentService.generateTitles(req.user.id, { topic, description, tags, channelNiche, count });
    return successResponse(res, 200, 'Titles generated', result);
  } catch (err) {
    return errorResponse(res, err.statusCode || 500, err.message);
  }
};

const generateTags = async (req, res) => {
  try {
    const { title, description, category } = req.body;
    if (!title) return errorResponse(res, 400, 'title is required');
    const result = await aiContentService.generateTags(req.user.id, { title, description, category });
    return successResponse(res, 200, 'Tags generated', result);
  } catch (err) {
    return errorResponse(res, err.statusCode || 500, err.message);
  }
};

const generateDescription = async (req, res) => {
  try {
    const { title, tags, channelName, addTimestamps } = req.body;
    if (!title) return errorResponse(res, 400, 'title is required');
    const result = await aiContentService.generateDescription(req.user.id, { title, tags, channelName, addTimestamps });
    return successResponse(res, 200, 'Description generated', result);
  } catch (err) {
    return errorResponse(res, err.statusCode || 500, err.message);
  }
};

const getContentIdeas = async (req, res) => {
  try {
    const { channelId, niche, count } = req.query;
    const result = await aiContentService.generateContentIdeas(req.user.id, { channelId, niche, count: parseInt(count) || 10 });
    return successResponse(res, 200, 'Content ideas', result);
  } catch (err) {
    return errorResponse(res, err.statusCode || 500, err.message);
  }
};

// ==================== SHORTS ====================

const generateShortsScript = async (req, res) => {
  try {
    const { topic, style, duration } = req.body;
    if (!topic) return errorResponse(res, 400, 'topic is required');
    const result = await aiContentService.generateShortsScript(req.user.id, { topic, style, duration });
    return successResponse(res, 200, 'Shorts script generated', result);
  } catch (err) {
    return errorResponse(res, err.statusCode || 500, err.message);
  }
};

const repurposeToShorts = async (req, res) => {
  try {
    const result = await aiContentService.repurposeToShorts(req.user.id, req.params.videoId);
    return successResponse(res, 200, 'Repurpose ideas generated', result);
  } catch (err) {
    return errorResponse(res, err.statusCode || 500, err.message);
  }
};

// ==================== TOOLS ====================

const scoreThumbnail = async (req, res) => {
  try {
    const { thumbnailUrl, title, niche } = req.body;
    if (!title) return errorResponse(res, 400, 'title is required');
    const result = await aiContentService.scoreThumbnail(req.user.id, { thumbnailUrl, title, niche });
    return successResponse(res, 200, 'Thumbnail scored', result);
  } catch (err) {
    return errorResponse(res, err.statusCode || 500, err.message);
  }
};

const getMonetizationTips = async (req, res) => {
  try {
    const result = await aiContentService.getMonetizationTips(req.user.id, req.params.channelId);
    return successResponse(res, 200, 'Monetization tips', result);
  } catch (err) {
    return errorResponse(res, err.statusCode || 500, err.message);
  }
};

module.exports = {
  syncComments, getInbox, generateReply, postReply, bulkGenerateReplies, updateStatus,
  generateTitles, generateTags, generateDescription, getContentIdeas,
  generateShortsScript, repurposeToShorts, scoreThumbnail, getMonetizationTips,
};
