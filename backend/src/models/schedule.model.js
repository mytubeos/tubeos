// src/models/schedule.model.js
// Tracks all scheduled posts — source of truth for scheduling

const mongoose = require('mongoose');

const scheduleSchema = new mongoose.Schema(
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
    },

    videoId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Video',
      required: true,
      unique: true, // One schedule per video
    },

    // --- Schedule Time ---
    scheduledAt: {
      type: Date,
      required: true,
      index: true,
    },

    timezone: {
      type: String,
      default: 'Asia/Kolkata',
    },

    // --- AI Recommendation ---
    isAiRecommended: {
      type: Boolean,
      default: false,
    },

    aiScore: {
      type: Number,
      default: null, // 0-100 confidence score
    },

    aiReason: {
      type: String,
      default: null, // "Friday 7PM gets 3.2x more views for your channel"
    },

    // --- BullMQ Job ---
    bullJobId: {
      type: String,
      default: null,
    },

    // --- Status ---
    status: {
      type: String,
      enum: ['pending', 'processing', 'published', 'failed', 'cancelled'],
      default: 'pending',
      index: true,
    },

    // --- Execution ---
    executedAt: {
      type: Date,
      default: null,
    },

    failedAt: {
      type: Date,
      default: null,
    },

    failReason: {
      type: String,
      default: null,
    },

    retryCount: {
      type: Number,
      default: 0,
    },

    nextRetryAt: {
      type: Date,
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
scheduleSchema.index({ userId: 1, scheduledAt: 1 });
scheduleSchema.index({ scheduledAt: 1, status: 1 });
scheduleSchema.index({ bullJobId: 1 });

// --- Virtual: Minutes until publish ---
scheduleSchema.virtual('minutesUntilPublish').get(function () {
  if (this.status !== 'pending') return null;
  const diff = new Date(this.scheduledAt) - new Date();
  return Math.max(0, Math.round(diff / 1000 / 60));
});

const Schedule = mongoose.model('Schedule', scheduleSchema);

module.exports = Schedule;
