// src/services/ai-comment.service.js
// AI Comment Reply System
// Sync comments → Sentiment analysis → AI reply generation → Post to YouTube

const Comment = require('../models/comment.model');
const YoutubeChannel = require('../models/youtube-channel.model');
const User = require('../models/user.model');
const { getValidAccessToken } = require('./youtube.service');
const { youtubeRequest } = require('../config/youtube.config');
const { callAI } = require('../config/ai.config');
const { setCache, getCache } = require('../config/redis');

// ==================== SYNC COMMENTS ====================
const syncComments = async (userId, channelId, youtubeVideoId = null) => {
  const channel = await YoutubeChannel.findOne({ _id: channelId, userId, isActive: true })
    .select('+oauth.accessToken +oauth.refreshToken +oauth.expiresAt');

  if (!channel) {
    const err = new Error('Channel not found');
    err.statusCode = 404;
    throw err;
  }

  const accessToken = await getValidAccessToken(channel);
  let totalSynced = 0;
  let pageToken = null;

  // Build URL params
  const params = new URLSearchParams({
    part: 'snippet',
    maxResults: '100',
    order: 'time',
    ...(youtubeVideoId
      ? { videoId: youtubeVideoId }
      : { allThreadsRelatedToChannelId: channel.channelId }
    ),
  });

  // Paginate through comments
  do {
    if (pageToken) params.set('pageToken', pageToken);

    const data = await youtubeRequest(
      `/commentThreads?${params.toString()}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    const items = data.items || [];
    pageToken = data.nextPageToken || null;

    // Process in batch
    const bulkOps = items.map(item => {
      const top = item.snippet.topLevelComment.snippet;
      return {
        updateOne: {
          filter: { youtubeCommentId: item.id },
          update: {
            $setOnInsert: {
              userId,
              channelId,
              youtubeCommentId: item.id,
              youtubeVideoId: top.videoId,
              authorName: top.authorDisplayName,
              authorChannelId: top.authorChannelId?.value || null,
              authorProfileImage: top.authorProfileImageUrl || null,
              text: top.textOriginal || top.textDisplay,
              likeCount: top.likeCount || 0,
              publishedAt: new Date(top.publishedAt),
              status: 'unread',
            },
            $set: {
              likeCount: top.likeCount || 0,
            },
          },
          upsert: true,
        },
      };
    });

    if (bulkOps.length > 0) {
      await Comment.bulkWrite(bulkOps, { ordered: false });
      totalSynced += bulkOps.length;
    }

    // Stop after 5 pages (500 comments) to respect quota
    if (totalSynced >= 500) break;
  } while (pageToken);

  // Run sentiment analysis on new unanalyzed comments
  await analyzeSentimentBatch(userId, channelId);

  return {
    synced: totalSynced,
    message: `Synced ${totalSynced} comments`,
  };
};

// ==================== SENTIMENT ANALYSIS ====================
const analyzeSentimentBatch = async (userId, channelId, limit = 50) => {
  // Get comments without sentiment analysis
  const comments = await Comment.find({
    channelId,
    'sentiment.confidence': 0,
    isSpam: false,
  }).limit(limit);

  if (comments.length === 0) return;

  const user = await User.findById(userId);

  // Process in batches of 10
  const batchSize = 10;
  for (let i = 0; i < comments.length; i += batchSize) {
    const batch = comments.slice(i, i + batchSize);
    await Promise.allSettled(
      batch.map(comment => analyzeSentiment(comment, user.plan))
    );
  }
};

const analyzeSentiment = async (comment, plan) => {
  try {
    const systemPrompt = `You are a sentiment analyzer for YouTube comments.
Analyze the comment and respond ONLY with valid JSON in this exact format:
{"label":"positive|negative|neutral|question|spam","score":0.8,"confidence":90}
label: positive/negative/neutral/question/spam
score: -1.0 to 1.0 (negative to positive)
confidence: 0-100`;

    const result = await callAI(
      plan,
      'bulk',
      [{ role: 'user', content: `Analyze: "${comment.text.substring(0, 500)}"` }],
      systemPrompt
    );

    const clean = result.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);

    await Comment.findByIdAndUpdate(comment._id, {
      'sentiment.label': parsed.label || 'neutral',
      'sentiment.score': parsed.score || 0,
      'sentiment.confidence': parsed.confidence || 50,
    });
  } catch (err) {
    // Fallback: simple keyword-based sentiment
    const text = comment.text.toLowerCase();
    const label = text.includes('?') ? 'question'
      : ['great', 'amazing', 'love', 'best', 'awesome', 'nice', 'good', 'thanks'].some(w => text.includes(w)) ? 'positive'
      : ['bad', 'hate', 'worst', 'terrible', 'awful', 'dislike', 'stop'].some(w => text.includes(w)) ? 'negative'
      : 'neutral';

    await Comment.findByIdAndUpdate(comment._id, {
      'sentiment.label': label,
      'sentiment.score': label === 'positive' ? 0.7 : label === 'negative' ? -0.7 : 0,
      'sentiment.confidence': 40,
    });
  }
};

// ==================== GENERATE AI REPLY ====================
const generateReply = async (userId, commentId, tone = 'friendly') => {
  const comment = await Comment.findOne({ _id: commentId, userId });
  if (!comment) {
    const err = new Error('Comment not found');
    err.statusCode = 404;
    throw err;
  }

  const user = await User.findById(userId);

  // Check usage limit
  if (!user.hasUsageLeft('aiReplies')) {
    const err = new Error('Monthly AI reply limit reached. Please upgrade your plan.');
    err.statusCode = 429;
    throw err;
  }

  const channel = await YoutubeChannel.findById(comment.channelId);

  const toneInstructions = {
    friendly: 'Be warm, casual, and approachable like a real YouTube creator',
    professional: 'Be professional, informative, and respectful',
    funny: 'Be witty, light-hearted, and humorous while still being genuine',
    grateful: 'Be thankful and appreciative of their engagement',
  };

  const systemPrompt = `You are ${channel?.channelName || 'a YouTube creator'}.
Write a genuine reply to this YouTube comment.
Tone: ${toneInstructions[tone] || toneInstructions.friendly}
Rules:
- Keep it under 200 characters
- Sound human, not AI-generated
- Match the comment's language (Hindi/English/Hinglish)
- Don't start with "I" or be overly formal
- No hashtags or emojis unless the comment has them
- If it's a question, answer it briefly
Reply with ONLY the reply text, nothing else.`;

  const reply = await callAI(
    user.plan,
    'default',
    [{ role: 'user', content: `Comment from ${comment.authorName}: "${comment.text}"` }],
    systemPrompt
  );

  // Update comment with AI reply
  comment.aiReply = {
    text: reply.trim(),
    generatedAt: new Date(),
    model: user.plan,
    tone,
    isApproved: false,
    isEdited: false,
  };
  comment.status = 'pending_reply';
  await comment.save();

  // Increment usage
  await User.findByIdAndUpdate(userId, {
    $inc: { 'usage.aiRepliesUsed': 1 },
  });

  return { comment, message: 'AI reply generated' };
};

// ==================== APPROVE + POST REPLY TO YOUTUBE ====================
const postReply = async (userId, commentId, replyText = null) => {
  const comment = await Comment.findOne({ _id: commentId, userId });
  if (!comment) {
    const err = new Error('Comment not found');
    err.statusCode = 404;
    throw err;
  }

  const finalReply = replyText || comment.aiReply?.text;
  if (!finalReply) {
    const err = new Error('No reply text. Generate AI reply first or provide custom reply.');
    err.statusCode = 400;
    throw err;
  }

  const channel = await YoutubeChannel.findById(comment.channelId)
    .select('+oauth.accessToken +oauth.refreshToken +oauth.expiresAt');
  const accessToken = await getValidAccessToken(channel);

  // Post to YouTube
  const response = await youtubeRequest('/comments?part=snippet', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({
      snippet: {
        parentId: comment.youtubeCommentId,
        textOriginal: finalReply,
      },
    }),
  });

  // Mark as replied
  comment.status = 'replied';
  comment.repliedAt = new Date();
  comment.youtubeReplyId = response.id;
  if (replyText && replyText !== comment.aiReply?.text) {
    comment.aiReply.isEdited = true;
  }
  comment.aiReply.isApproved = true;
  await comment.save();

  return { comment, message: 'Reply posted to YouTube!' };
};

// ==================== GET COMMENT INBOX ====================
const getCommentInbox = async (userId, channelId, filters = {}) => {
  const {
    status, sentiment, videoId, page = 1, limit = 20, search,
  } = filters;

  const query = { userId, channelId: require('mongoose').Types.ObjectId.createFromHexString(channelId) };
  if (status) query.status = status;
  if (sentiment) query['sentiment.label'] = sentiment;
  if (videoId) query.youtubeVideoId = videoId;
  if (search) query.text = { $regex: search, $options: 'i' };

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [comments, total] = await Promise.all([
    Comment.find(query)
      .sort({ publishedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean(),
    Comment.countDocuments(query),
  ]);

  // Summary stats
  const stats = await Comment.aggregate([
    { $match: { userId: require('mongoose').Types.ObjectId.createFromHexString(userId.toString()), channelId: require('mongoose').Types.ObjectId.createFromHexString(channelId) } },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        unread: { $sum: { $cond: [{ $eq: ['$status', 'unread'] }, 1, 0] } },
        pendingReply: { $sum: { $cond: [{ $eq: ['$status', 'pending_reply'] }, 1, 0] } },
        positive: { $sum: { $cond: [{ $eq: ['$sentiment.label', 'positive'] }, 1, 0] } },
        negative: { $sum: { $cond: [{ $eq: ['$sentiment.label', 'negative'] }, 1, 0] } },
        questions: { $sum: { $cond: [{ $eq: ['$sentiment.label', 'question'] }, 1, 0] } },
      },
    },
  ]);

  return {
    comments,
    pagination: { page: parseInt(page), limit: parseInt(limit), total },
    stats: stats[0] || { total: 0, unread: 0, pendingReply: 0, positive: 0, negative: 0, questions: 0 },
  };
};

// ==================== BULK GENERATE REPLIES ====================
const bulkGenerateReplies = async (userId, channelId, commentIds, tone = 'friendly') => {
  const user = await User.findById(userId);

  if (!user.hasUsageLeft('aiReplies')) {
    const err = new Error('Monthly AI reply limit reached');
    err.statusCode = 429;
    throw err;
  }

  const results = [];
  for (const id of commentIds.slice(0, 10)) { // Max 10 at once
    try {
      const result = await generateReply(userId, id, tone);
      results.push({ commentId: id, success: true });
    } catch (err) {
      results.push({ commentId: id, success: false, error: err.message });
    }
  }

  return {
    results,
    summary: {
      total: results.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
    },
  };
};

// ==================== MARK STATUS ====================
const updateCommentStatus = async (userId, commentId, status) => {
  const comment = await Comment.findOneAndUpdate(
    { _id: commentId, userId },
    { status },
    { new: true }
  );
  if (!comment) {
    const err = new Error('Comment not found');
    err.statusCode = 404;
    throw err;
  }
  return { comment };
};

module.exports = {
  syncComments,
  generateReply,
  postReply,
  getCommentInbox,
  bulkGenerateReplies,
  updateCommentStatus,
  analyzeSentimentBatch,
};
