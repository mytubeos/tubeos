// src/models/user.model.js
// Complete User model with all TubeOS fields

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const validator = require('validator');

const userSchema = new mongoose.Schema(
  {
    // --- Basic Info ---
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [50, 'Name cannot exceed 50 characters'],
    },

    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      validate: [validator.isEmail, 'Please provide a valid email'],
    },

    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      select: false, // Never return password in queries
    },

    avatar: {
      type: String,
      default: null,
    },

    // --- Plan & Subscription ---
    plan: {
      type: String,
      enum: ['free', 'creator', 'pro', 'agency'],
      default: 'free',
    },

    planStatus: {
      type: String,
      enum: ['active', 'expired', 'cancelled', 'trial'],
      default: 'active',
    },

    // Founders pricing lock
    priceTier: {
      type: String,
      enum: ['founders', 'earlybird', 'growth', 'regular'],
      default: 'regular',
    },

    lockedPrice: {
      type: Number,
      default: 0,
    },

    isFounder: {
      type: Boolean,
      default: false,
    },

    founderNumber: {
      type: Number,
      default: null, // e.g. Founder #247
    },

    planStartDate: {
      type: Date,
      default: null,
    },

    planEndDate: {
      type: Date,
      default: null,
    },

    autoRenew: {
      type: Boolean,
      default: true,
    },

    // --- Usage Limits (resets monthly) ---
    usage: {
      aiRepliesUsed: { type: Number, default: 0 },
      uploadsUsed: { type: Number, default: 0 },
      usageResetDate: { type: Date, default: () => new Date() },
    },

    // --- Referral System ---
    referral: {
      myCode: { type: String, unique: true, sparse: true },
      referredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      totalReferrals: { type: Number, default: 0 },
      totalEarned: { type: Number, default: 0 },
      tier: {
        type: String,
        enum: ['starter', 'grower', 'champion', 'legend'],
        default: 'starter',
      },
    },

    // --- Wallet (Referral earnings) ---
    wallet: {
      balance: { type: Number, default: 0 },
      totalEarned: { type: Number, default: 0 },
      totalWithdrawn: { type: Number, default: 0 },
    },

    // --- Auth & Security ---
    isEmailVerified: {
      type: Boolean,
      default: false,
    },

    emailVerificationToken: {
      type: String,
      default: null,
      select: false,
    },

    emailVerificationExpires: {
      type: Date,
      default: null,
      select: false,
    },

    passwordResetToken: {
      type: String,
      default: null,
      select: false,
    },

    passwordResetExpires: {
      type: Date,
      default: null,
      select: false,
    },

    passwordChangedAt: {
      type: Date,
      default: null,
    },

    refreshTokens: {
      type: [String],
      default: [],
      select: false,
    },

    // --- Account Status ---
    isActive: {
      type: Boolean,
      default: true,
    },

    isBanned: {
      type: Boolean,
      default: false,
    },

    banReason: {
      type: String,
      default: null,
    },

    lastLoginAt: {
      type: Date,
      default: null,
    },

    lastLoginIp: {
      type: String,
      default: null,
    },

    // --- Preferences ---
    preferences: {
      timezone: { type: String, default: 'Asia/Kolkata' },
      language: { type: String, default: 'en' },
      emailNotifications: { type: Boolean, default: true },
      weeklyReport: { type: Boolean, default: true },
      spikeAlerts: { type: Boolean, default: true },
    },

    // --- Connected YouTube Channels (added in Part 2) ---
    youtubeChannels: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'YoutubeChannel',
      },
    ],
  },
  {
    timestamps: true, // createdAt, updatedAt auto added
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// --- Indexes ---
userSchema.index({ email: 1 });
userSchema.index({ 'referral.myCode': 1 });
userSchema.index({ plan: 1 });
userSchema.index({ createdAt: -1 });

// --- Virtual: Plan display name ---
userSchema.virtual('planDisplayName').get(function () {
  const plans = {
    free: 'Free',
    creator: 'Creator',
    pro: 'Pro',
    agency: 'Agency',
  };
  return plans[this.plan] || 'Free';
});

// --- Virtual: Usage limits based on plan ---
userSchema.virtual('planLimits').get(function () {
  const limits = {
    free:    { aiReplies: 10,   uploads: 0,  channels: 1 },
    creator: { aiReplies: 500,  uploads: 5,  channels: 1 },
    pro:     { aiReplies: 1200, uploads: 20, channels: 3 },
    agency:  { aiReplies: -1,   uploads: -1, channels: 25 }, // -1 = unlimited
  };
  return limits[this.plan] || limits.free;
});

// --- Pre-save: Hash password ---
userSchema.pre('save', async function (next) {
  // Only hash if password was modified
  if (!this.isModified('password')) return next();

  const saltRounds = 12;
  this.password = await bcrypt.hash(this.password, saltRounds);

  // Update passwordChangedAt when password changes (not on creation)
  if (!this.isNew) {
    this.passwordChangedAt = new Date() - 1000;
  }

  next();
});

// --- Method: Compare password ---
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// --- Method: Check if password changed after JWT issued ---
userSchema.methods.passwordChangedAfter = function (jwtTimestamp) {
  if (this.passwordChangedAt) {
    const changedAt = parseInt(this.passwordChangedAt.getTime() / 1000, 10);
    return jwtTimestamp < changedAt;
  }
  return false;
};

// --- Method: Check if plan is active ---
userSchema.methods.isPlanActive = function () {
  if (this.plan === 'free') return true;
  if (!this.planEndDate) return false;
  return new Date() < this.planEndDate && this.planStatus === 'active';
};

// --- Method: Check usage limit ---
userSchema.methods.hasUsageLeft = function (type) {
  const limits = this.planLimits;
  if (type === 'aiReplies') {
    if (limits.aiReplies === -1) return true; // unlimited
    return this.usage.aiRepliesUsed < limits.aiReplies;
  }
  if (type === 'uploads') {
    if (limits.uploads === -1) return true;
    return this.usage.uploadsUsed < limits.uploads;
  }
  return false;
};

// --- Method: Get referral tier based on count ---
userSchema.methods.getReferralTier = function () {
  const count = this.referral.totalReferrals;
  if (count >= 50) return 'legend';
  if (count >= 21) return 'champion';
  if (count >= 6) return 'grower';
  return 'starter';
};

// --- Method: Get commission rate ---
userSchema.methods.getCommissionRate = function () {
  const rates = {
    starter: 0.10,
    grower: 0.12,
    champion: 0.15,
    legend: 0.20,
  };
  return rates[this.referral.tier] || 0.10;
};

// --- Static: Get plan spot counts (for founders pricing) ---
userSchema.statics.getPlanSpotCount = async function (plan, priceTier) {
  return this.countDocuments({ plan, priceTier });
};

const User = mongoose.model('User', userSchema);

module.exports = User;
