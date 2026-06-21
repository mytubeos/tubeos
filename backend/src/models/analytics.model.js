// src/models/analytics.model.js
// Stores daily analytics snapshots per channel + per video
// Synced from YouTube Analytics API

const mongoose = require('mongoose');

// ==================== CHANNEL DAILY SNAPSHOT ====================
const channelAnalyticsSchema = new mongoose.Schema(
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

    date: {
      type: Date,
      required: true,
      index: true,
    },

    // --- Core Metrics ---
    metrics: {
      views: { type: Number, default: 0 },
      estimatedMinutesWatched: { type: Number, default: 0 },
      averageViewDuration: { type: Number, default: 0 }, // seconds
      averageViewPercentage: { type: Number, default: 0 },
      subscribersGained: { type: Number, default: 0 },
      subscribersLost: { type: Number, default: 0 },
      likes: { type: Number, default: 0 },
      comments: { type: Number, default: 0 },
      shares: { type: Number, default: 0 },
      impressions: { type: Number, default: 0 },
      impressionsCtr: { type: Number, default: 0 }, // %
      estimatedRevenue: { type: Number, default: 0 }, // USD
    },

    // --- Traffic Sources ---
    trafficSources: {
      browseFeatures: { type: Number, default: 0 },
      ytSearch: { type: Number, default: 0 },
      suggested: { type: Number, default: 0 },
      external: { type: Number, default: 0 },
      notification: { type: Number, default: 0 },
      playlist: { type: Number, default: 0 },
      other: { type: Number, default: 0 },
    },

    // --- Device Types ---
    deviceTypes: {
      mobile: { type: Number, default: 0 },
      desktop: { type: Number, default: 0 },
      tablet: { type: Number, default: 0 },
      tv: { type: Number, default: 0 },
    },

    // --- Top Countries ---
    topCountries: [
      {
        country: String,
        views: Number,
        watchTime: Number,
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Unique per channel per day
channelAnalyticsSchema.index(
  { channelId: 1, date: 1 },
  { unique: true }
);
channelAnalyticsSchema.index({ channelId: 1, date: -1 });

// ==================== VIDEO DAILY SNAPSHOT ====================
const videoAnalyticsSchema = new mongoose.Schema(
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

    videoId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Video',
      required: true,
      index: true,
    },

    youtubeVideoId: {
      type: String,
      required: true,
      index: true,
    },

    date: {
      type: Date,
      required: true,
    },

    metrics: {
      views: { type: Number, default: 0 },
      estimatedMinutesWatched: { type: Number, default: 0 },
      averageViewDuration: { type: Number, default: 0 },
      averageViewPercentage: { type: Number, default: 0 },
      likes: { type: Number, default: 0 },
      comments: { type: Number, default: 0 },
      shares: { type: Number, default: 0 },
      impressions: { type: Number, default: 0 },
      impressionsCtr: { type: Number, default: 0 },
      estimatedRevenue: { type: Number, default: 0 },
    },
  },
  {
    timestamps: true,
  }
);

videoAnalyticsSchema.index({ videoId: 1, date: -1 });
videoAnalyticsSchema.index({ channelId: 1, date: -1 });
videoAnalyticsSchema.index(
  { youtubeVideoId: 1, date: 1 },
  { unique: true }
);

// ==================== HEATMAP MODEL ====================
// 7x24 audience activity grid — cached, recalculated weekly
const heatmapSchema = new mongoose.Schema(
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

    // 7 days x 24 hours grid
    // grid[day][hour] = activity score (0-100)
    // day: 0=Sun, 1=Mon, ..., 6=Sat
    grid: {
      type: [[Number]], // 7x24 2D array
      default: () => Array(7).fill(null).map(() => Array(24).fill(0)),
    },

    // Best slots ranked
    bestSlots: [
      {
        day: Number,      // 0-6
        dayName: String,  // 'friday'
        hour: Number,     // 0-23
        score: Number,    // 0-100
        label: String,    // '7:00 PM'
      },
    ],

    // Worst slots (avoid these)
    worstSlots: [
      {
        day: Number,
        dayName: String,
        hour: Number,
        score: Number,
        label: String,
      },
    ],

    // Meta
    dataPoints: { type: Number, default: 0 }, // How many videos analyzed
    confidence: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'low',
    },
    basedOnDays: { type: Number, default: 0 }, // Days of data used
    calculatedAt: { type: Date, default: Date.now },
    nextRecalcAt: { type: Date, default: null },
  },
  {
    timestamps: true,
  }
);

heatmapSchema.index({ channelId: 1 }, { unique: true });

const ChannelAnalytics = mongoose.model('ChannelAnalytics', channelAnalyticsSchema);
const VideoAnalytics = mongoose.model('VideoAnalytics', videoAnalyticsSchema);
const Heatmap = mongoose.model('Heatmap', heatmapSchema);

module.exports = { ChannelAnalytics, VideoAnalytics, Heatmap };
