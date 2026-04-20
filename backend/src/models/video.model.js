// src/models/video.model.js
// Stores video metadata — NOT the actual video file
// Videos are stored on YouTube, we only store metadata

const mongoose = require('mongoose');

const videoSchema = new mongoose.Schema(
  {
    // --- Ownership ---
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

    // --- YouTube Data (filled after upload) ---
    youtubeVideoId: {
      type: String,
      default: null,
      // index removed — duplicate tha, schema.index() se defined hai neeche
      sparse: true,
    },

    youtubeUrl: {
      type: String,
      default: null,
    },

    // --- Video Metadata ---
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: [100, 'Title cannot exceed 100 characters'],
    },

    description: {
      type: String,
      default: '',
      maxlength: [5000, 'Description cannot exceed 5000 characters'],
    },

    tags: {
      type: [String],
      default: [],
      validate: {
        validator: function (tags) {
          return tags.length <= 30;
        },
        message: 'Cannot have more than 30 tags',
      },
    },

    category: {
      type: String,
      default: '22', // YouTube category ID: 22 = People & Blogs
    },

    language: {
      type: String,
      default: 'en',
    },

    // --- Privacy ---
    privacy: {
      type: String,
      enum: ['public', 'private', 'unlisted'],
      default: 'private',
    },

    // --- Thumbnail ---
    thumbnail: {
      url: { type: String, default: null },
      cloudinaryId: { type: String, default: null },
      isCustom: { type: Boolean, default: false },
    },

    // --- Video Status ---
    status: {
      type: String,
      enum: [
        'draft',         // Saved, not scheduled
        'scheduled',     // Waiting to publish
        'uploading',     // Currently uploading to YouTube
        'processing',    // YouTube processing the video
        'published',     // Live on YouTube
        'failed',        // Upload/publish failed
        'cancelled',     // Cancelled by user
      ],
      default: 'draft',
      index: true,
    },

    // --- Scheduling ---
    scheduledAt: {
      type: Date,
      default: null,
      index: true,
    },

    publishedAt: {
      type: Date,
      default: null,
    },

    // --- AI Suggestions (stored for reference) ---
    aiSuggestions: {
      titles: [{ type: String }],
      tags: [{ type: String }],
      description: { type: String, default: null },
      bestTimeScore: { type: Number, default: null }, // 0-100
      usedAiTitle: { type: Boolean, default: false },
      usedAiTags: { type: Boolean, default: false },
      usedAiDescription: { type: Boolean, default: false },
    },

    // --- Upload Info ---
    uploadInfo: {
      fileSize: { type: Number, default: null }, // bytes
      duration: { type: Number, default: null }, // seconds
      format: { type: String, default: null },
      resolution: { type: String, default: null },
      uploadStartedAt: { type: Date, default: null },
      uploadCompletedAt: { type: Date, default: null },
    },

    // --- Performance (synced from YouTube Analytics) ---
    performance: {
      views: { type: Number, default: 0 },
      likes: { type: Number, default: 0 },
      comments: { type: Number, default: 0 },
      shares: { type: Number, default: 0 },
      impressions: { type: Number, default: 0 },
      ctr: { type: Number, default: 0 }, // Click through rate %
      avgViewDuration: { type: Number, default: 0 }, // seconds
      avgViewPercentage: { type: Number, default: 0 },
      revenue: { type: Number, default: 0 }, // USD
      lastSyncedAt: { type: Date, default: null },
    },

    // --- Thumbnail A/B Testing ---
    abTesting: {
      isActive: { type: Boolean, default: false },
      variants: [
        {
          thumbnailUrl: String,
          cloudinaryId: String,
          impressions: { type: Number, default: 0 },
          ctr: { type: Number, default: 0 },
          isWinner: { type: Boolean, default: false },
        },
      ],
      winnerSelectedAt: { type: Date, default: null },
    },

    // --- BullMQ Job Reference ---
    scheduledJobId: {
      type: String,
      default: null,
    },

    // --- Error Tracking ---
    lastError: {
      message: { type: String, default: null },
      code: { type: String, default: null },
      occurredAt: { type: Date, default: null },
    },

    retryCount: {
      type: Number,
      default: 0,
    },

    // --- Shorts specific ---
    isShort: {
      type: Boolean,
      default: false,
    },

    // --- Notes (internal, not shown on YouTube) ---
    notes: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// --- Indexes ---
videoSchema.index({ userId: 1, status: 1 });
videoSchema.index({ userId: 1, scheduledAt: 1 });
videoSchema.index({ channelId: 1, status: 1 });
videoSchema.index({ youtubeVideoId: 1 });
videoSchema.index({ scheduledAt: 1, status: 1 }); // For BullMQ queries

// --- Virtual: YouTube watch URL ---
videoSchema.virtual('watchUrl').get(function () {
  if (!this.youtubeVideoId) return null;
  return `https://www.youtube.com/watch?v=${this.youtubeVideoId}`;
});

// --- Virtual: Is scheduled in future ---
videoSchema.virtual('isUpcoming').get(function () {
  return this.status === 'scheduled' && this.scheduledAt > new Date();
});

// --- Virtual: Can be edited ---
videoSchema.virtual('isEditable').get(function () {
  return ['draft', 'scheduled', 'failed'].includes(this.status);
});

const Video = mongoose.model('Video', videoSchema);

module.exports = Video;
