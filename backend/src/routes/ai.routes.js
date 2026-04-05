// src/routes/ai.routes.js
// All AI system routes — Comments + Content + Shorts

const express = require('express');
const router = express.Router();
const aiController = require('../controllers/ai.controller');
const { protect, requirePlan, checkUsageLimit } = require('../middlewares/auth.middleware');
const { aiLimiter } = require('../middlewares/rateLimiter.middleware');

// Apply AI rate limiter to all routes
router.use(aiLimiter);

// ==================== COMMENT SYSTEM ====================

/**
 * @route   POST /api/v1/ai/comments/:channelId/sync
 * @desc    Sync comments from YouTube
 * @access  Private
 */
router.post('/comments/:channelId/sync', protect, aiController.syncComments);

/**
 * @route   GET /api/v1/ai/comments/:channelId
 * @desc    Get comment inbox with filters
 * @access  Private
 * @query   status, sentiment, videoId, page, limit, search
 */
router.get('/comments/:channelId', protect, aiController.getInbox);

/**
 * @route   POST /api/v1/ai/comments/:commentId/generate-reply
 * @desc    Generate AI reply for a comment
 * @access  Private
 * @body    { tone: 'friendly|professional|funny|grateful' }
 */
router.post(
  '/comments/:commentId/generate-reply',
  protect,
  checkUsageLimit('aiReply'),
  aiController.generateReply
);

/**
 * @route   POST /api/v1/ai/comments/:commentId/post-reply
 * @desc    Post reply to YouTube (AI or custom)
 * @access  Private
 * @body    { replyText?: string }
 */
router.post('/comments/:commentId/post-reply', protect, aiController.postReply);

/**
 * @route   POST /api/v1/ai/comments/bulk-generate
 * @desc    Bulk generate AI replies (max 10)
 * @access  Private (Creator+)
 * @body    { channelId, commentIds[], tone? }
 */
router.post(
  '/comments/bulk-generate',
  protect,
  requirePlan('creator', 'pro', 'agency'),
  aiController.bulkGenerateReplies
);

/**
 * @route   PATCH /api/v1/ai/comments/:commentId/status
 * @desc    Update comment status
 * @access  Private
 * @body    { status: 'unread|pending_reply|replied|ignored|flagged' }
 */
router.patch('/comments/:commentId/status', protect, aiController.updateStatus);

// ==================== CONTENT ENGINE ====================

/**
 * @route   POST /api/v1/ai/content/titles
 * @desc    Generate SEO-optimized titles
 * @access  Private
 * @body    { topic, description?, tags?, channelNiche?, count? }
 */
router.post('/content/titles', protect, aiController.generateTitles);

/**
 * @route   POST /api/v1/ai/content/tags
 * @desc    Generate SEO tags
 * @access  Private
 * @body    { title, description?, category? }
 */
router.post('/content/tags', protect, aiController.generateTags);

/**
 * @route   POST /api/v1/ai/content/description
 * @desc    Generate video description
 * @access  Private
 * @body    { title, tags?, channelName?, addTimestamps? }
 */
router.post('/content/description', protect, aiController.generateDescription);

/**
 * @route   GET /api/v1/ai/content/ideas
 * @desc    Get AI content ideas for your niche
 * @access  Private
 * @query   channelId?, niche?, count?
 */
router.get('/content/ideas', protect, aiController.getContentIdeas);

// ==================== SHORTS INTELLIGENCE ====================

/**
 * @route   POST /api/v1/ai/shorts/script
 * @desc    Generate Shorts script
 * @access  Private
 * @body    { topic, style?, duration? }
 */
router.post('/shorts/script', protect, aiController.generateShortsScript);

/**
 * @route   POST /api/v1/ai/shorts/repurpose/:videoId
 * @desc    Get Shorts ideas from existing long video
 * @access  Private (Pro+)
 */
router.post(
  '/shorts/repurpose/:videoId',
  protect,
  requirePlan('pro', 'agency'),
  aiController.repurposeToShorts
);

// ==================== ADDITIONAL AI TOOLS ====================

/**
 * @route   POST /api/v1/ai/thumbnail/score
 * @desc    AI thumbnail CTR score + feedback
 * @access  Private (Creator+)
 * @body    { thumbnailUrl?, title, niche? }
 */
router.post(
  '/thumbnail/score',
  protect,
  requirePlan('creator', 'pro', 'agency'),
  aiController.scoreThumbnail
);

/**
 * @route   GET /api/v1/ai/monetization/:channelId
 * @desc    Get AI monetization tips for channel
 * @access  Private (Pro+)
 */
router.get(
  '/monetization/:channelId',
  protect,
  requirePlan('pro', 'agency'),
  aiController.getMonetizationTips
);

module.exports = router;
