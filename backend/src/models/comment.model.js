// src/models/comment.model.js
// Stores YouTube comments + AI reply suggestions

const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    channelId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'YoutubeChannel',
      required: true,
      index: true,
    },

    videoId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Video',
      index: true,
    },

    // --- YouTube Data ---
    youtubeCommentId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    youtubeVideoId: {
      type: String,
      required: true,
      index: true,
    },

    videoTitle: { type: String, default: null },
    videoThumbnail: { type: String, default: null },

    // --- Comment Content ---
    authorName: { type: String, required: true },
    authorChannelId: { type: String, default: null },
    authorProfileImage: { type: String, default: null },

    text: {
      type: String,
      required: true,
      maxlength: 10000,
    },

    likeCount: { type: Number, default: 0 },
    publishedAt: { type: Date, required: true },
    updatedAt: { type: Date, default: null },

    isReply: { type: Boolean, default: false },
    parentCommentId: { type: String, default: null },

    // --- Sentiment Analysis ---
    sentiment: {
      label: {
        type: String,
        enum: ['positive', 'neutral', 'negative', 'question', 'spam'],
        default: 'neutral',
      },
      score: { type: Number, default: 0 }, // -1 to 1
      confidence: { type: Number, default: 0 }, // 0-100
    },

    // --- AI Reply ---
    aiReply: {
      text: { type: String, default: null },
      generatedAt: { type: Date, default: null },
      model: { type: String, default: null },
      tone: {
        type: String,
        enum: ['friendly', 'professional', 'funny', 'grateful'],
        default: 'friendly',
      },
      isApproved: { type: Boolean, default: false },
      isEdited: { type: Boolean, default: false },
    },

    // --- Reply Status ---
    status: {
      type: String,
      enum: ['unread', 'pending_reply', 'replied', 'ignored', 'flagged'],
      default: 'unread',
      index: true,
    },

    repliedAt: { type: Date, default: null },
    youtubeReplyId: { type: String, default: null },

    // --- Flags ---
    isSpam: { type: Boolean, default: false },
    isHidden: { type: Boolean, default: false },
    isFlagged: { type: Boolean, default: false },
    flagReason: { type: String, default: null },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// --- Indexes ---
commentSchema.index({ channelId: 1, status: 1 });
commentSchema.index({ channelId: 1, publishedAt: -1 });
commentSchema.index({ channelId: 1, 'sentiment.label': 1 });
commentSchema.index({ youtubeVideoId: 1, publishedAt: -1 });

const Comment = mongoose.model('Comment', commentSchema);
module.exports = Comment;
