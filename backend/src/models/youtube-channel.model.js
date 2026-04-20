// src/models/youtube-channel.model.js
// Stores connected YouTube channel data + OAuth tokens

const mongoose = require('mongoose');

const youtubeChannelSchema = new mongoose.Schema(
  {
    // --- Owner ---
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    // --- YouTube Channel Info ---
    channelId: {
      type: String,
      required: true,
      unique: true,
      // FIX 1: index:true HATA DIYA — unique:true already index banata hai
      // Pehle dono the, isliye "Duplicate schema index" warning aa raha tha
    },

    channelName: {
      type: String,
      required: true,
    },

    channelHandle: {
      type: String,
      default: null,
    },

    description: {
      type: String,
      default: '',
    },

    thumbnail: {
      type: String,
      default: null,
    },

    bannerImage: {
      type: String,
      default: null,
    },

    country: {
      type: String,
      default: null,
    },

    publishedAt: {
      type: Date,
      default: null,
    },

    // --- Channel Stats ---
    stats: {
      subscriberCount: { type: Number, default: 0 },
      videoCount: { type: Number, default: 0 },
      viewCount: { type: Number, default: 0 },
      hiddenSubscriberCount: { type: Boolean, default: false },
      lastSyncedAt: { type: Date, default: null },
    },

    // --- OAuth Tokens ---
    // FIX 2: select:false BILKUL HATA DIYA dono fields se
    // Reason: select:false ke saath dot-notation ($set: {'oauth.accessToken': ...})
    // Mongoose mein "Path collision" error deta hai — yahi tumhara main bug tha
    // Security: sanitizeChannel() function already oauth object delete karta hai
    // response se pehle, toh frontend pe kabhi nahi jayega
    oauth: {
      accessToken: {
        type: String,
        required: true,
      },
      refreshToken: {
        type: String,
        required: true,
      },
      tokenType: {
        type: String,
        default: 'Bearer',
      },
      expiresAt: {
        type: Date,
        required: true,
      },
      scope: {
        type: String,
        default: '',
      },
    },

    // --- API Quota Tracking ---
    quota: {
      dailyUsed: { type: Number, default: 0 },
      dailyLimit: { type: Number, default: 10000 },
      lastResetDate: { type: Date, default: Date.now },
      uploadCount: { type: Number, default: 0 },
      uploadDailyLimit: { type: Number, default: 6 },
    },

    // --- Status ---
    isActive: {
      type: Boolean,
      default: true,
    },

    isDefault: {
      type: Boolean,
      default: false,
    },

    isPrimary: {
      type: Boolean,
      default: false,
    },

    connectionStatus: {
      type: String,
      enum: ['connected', 'disconnected', 'error', 'token_expired'],
      default: 'connected',
    },

    lastError: {
      type: String,
      default: null,
    },

    // --- Monetization ---
    monetization: {
      isMonetized: { type: Boolean, default: false },
      membershipEnabled: { type: Boolean, default: false },
    },

    // --- Best Time Data ---
    bestTimeData: {
      lastCalculatedAt: { type: Date, default: null },
      bestDays: [{ type: String }],
      bestHours: [{ type: Number }],
      heatmapData: { type: mongoose.Schema.Types.Mixed, default: null },
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// --- Indexes ---
// FIX 3: userId:1 + channelId:1 compound index enough hai
// Pehle userId pe alag bhi tha + yahaan bhi — duplicate tha
youtubeChannelSchema.index({ userId: 1, channelId: 1 });
youtubeChannelSchema.index({ userId: 1, isActive: 1 });

// --- Virtual: Is token expired ---
youtubeChannelSchema.virtual('isTokenExpired').get(function () {
  return this.oauth?.expiresAt ? new Date() >= this.oauth.expiresAt : false;
});

// --- Virtual: Upload slots remaining today ---
youtubeChannelSchema.virtual('uploadsRemainingToday').get(function () {
  const today = new Date().toDateString();
  const lastReset = new Date(this.quota.lastResetDate).toDateString();
  if (today !== lastReset) return this.quota.uploadDailyLimit;
  return Math.max(0, this.quota.uploadDailyLimit - this.quota.uploadCount);
});

// --- Method: Check if quota available ---
youtubeChannelSchema.methods.hasQuota = function (units = 1) {
  return this.quota.dailyUsed + units <= this.quota.dailyLimit;
};

// --- Method: Reset daily quota if needed ---
youtubeChannelSchema.methods.resetDailyQuotaIfNeeded = async function () {
  const today = new Date().toDateString();
  const lastReset = new Date(this.quota.lastResetDate).toDateString();

  if (today !== lastReset) {
    this.quota.dailyUsed = 0;
    this.quota.uploadCount = 0;
    this.quota.lastResetDate = new Date();
    await this.save();
  }
};

const YoutubeChannel = mongoose.model('YoutubeChannel', youtubeChannelSchema);

module.exports = YoutubeChannel;
