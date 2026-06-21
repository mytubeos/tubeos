// src/models/growth.model.js
// Growth predictions + competitor tracking data

const mongoose = require('mongoose');

// ==================== GROWTH PREDICTION ====================
const growthPredictionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    channelId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'YoutubeChannel',
      required: true,
    },

    calculatedAt: { type: Date, default: Date.now },

    current: {
      subscribers: { type: Number, default: 0 },
      totalViews: { type: Number, default: 0 },
      avgViewsPerVideo: { type: Number, default: 0 },
      uploadFrequency: { type: Number, default: 0 }, // videos/week
    },

    predictions: {
      thirtyDays: {
        subscribers: Number,
        views: Number,
        growthRate: Number, // %
        confidence: Number, // 0-100
      },
      ninetyDays: {
        subscribers: Number,
        views: Number,
        growthRate: Number,
        confidence: Number,
      },
      oneYear: {
        subscribers: Number,
        views: Number,
        growthRate: Number,
        confidence: Number,
      },
    },

    // Milestones predictions
    milestones: [
      {
        target: Number,      // e.g. 10000 subscribers
        label: String,       // "10K subscribers"
        estimatedDate: Date,
        daysAway: Number,
        probability: Number, // 0-100
      },
    ],

    // Performance suggestions
    suggestions: [
      {
        type: String,        // 'upload_frequency', 'best_time', 'content_type'
        title: String,
        description: String,
        impact: String,      // 'high', 'medium', 'low'
        metric: String,      // 'views', 'subscribers', 'ctr'
      },
    ],

    trendDirection: {
      type: String,
      enum: ['growing', 'stable', 'declining'],
      default: 'stable',
    },
  },
  { timestamps: true }
);

growthPredictionSchema.index({ channelId: 1 }, { unique: true });

// ==================== COMPETITOR TRACKING ====================
const competitorSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    trackingChannelId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'YoutubeChannel',
      required: true,
    },

    // Competitor's YouTube channel
    youtubeChannelId: { type: String, required: true },
    channelName: { type: String, required: true },
    channelHandle: { type: String, default: null },
    thumbnail: { type: String, default: null },

    // Latest stats
    stats: {
      subscribers: { type: Number, default: 0 },
      totalViews: { type: Number, default: 0 },
      videoCount: { type: Number, default: 0 },
      avgViewsPerVideo: { type: Number, default: 0 },
      uploadFrequency: { type: Number, default: 0 },
      lastSyncedAt: { type: Date, default: null },
    },

    // Historical snapshots for growth tracking
    history: [
      {
        date: Date,
        subscribers: Number,
        totalViews: Number,
        videoCount: Number,
      },
    ],

    // Top performing videos
    topVideos: [
      {
        youtubeVideoId: String,
        title: String,
        views: Number,
        publishedAt: Date,
        thumbnail: String,
        tags: [String],
      },
    ],

    // Insights
    insights: {
      bestUploadDays: [String],
      avgVideoLength: Number,
      topCategories: [String],
      estimatedMonthlyViews: Number,
    },

    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

competitorSchema.index({ userId: 1, youtubeChannelId: 1 }, { unique: true });

// ==================== TREND MODEL ====================
const trendSchema = new mongoose.Schema(
  {
    // Global trends — not user specific
    keyword: { type: String, required: true },
    category: { type: String, default: null },
    region: { type: String, default: 'IN' },

    // Trend metrics
    searchVolume: { type: Number, default: 0 },
    growthRate: { type: Number, default: 0 }, // % change
    peakEstimate: { type: Date, default: null },
    opportunityScore: { type: Number, default: 0 }, // 0-100

    status: {
      type: String,
      enum: ['rising', 'peaking', 'declining', 'stable'],
      default: 'rising',
    },

    relatedKeywords: [String],
    detectedAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, default: null },
  },
  { timestamps: true }
);

trendSchema.index({ keyword: 1, region: 1 });
trendSchema.index({ opportunityScore: -1 });
trendSchema.index({ status: 1, detectedAt: -1 });

const GrowthPrediction = mongoose.model('GrowthPrediction', growthPredictionSchema);
const Competitor = mongoose.model('Competitor', competitorSchema);
const Trend = mongoose.model('Trend', trendSchema);

module.exports = { GrowthPrediction, Competitor, Trend };
