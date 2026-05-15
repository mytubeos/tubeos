// src/models/user.model.js
// FIXED: User model with proper password hashing, validation, and security
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    // ==================== BASIC INFO ====================
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [50, 'Name must not exceed 50 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Invalid email format'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      select: false, // Don't return password by default
    },
    avatar: {
      type: String,
      default: null,
    },
    bio: {
      type: String,
      default: '',
      maxlength: [500, 'Bio must not exceed 500 characters'],
    },

    // ==================== EMAIL VERIFICATION ====================
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    emailVerifiedAt: {
      type: Date,
      default: null,
    },

    // ==================== SECURITY ====================
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
      select: false,
    },

    // ==================== ACCOUNT STATUS ====================
    isActive: {
      type: Boolean,
      default: true,
    },
    isBanned: {
      type: Boolean,
      default: false,
    },
    bannedReason: {
      type: String,
      default: null,
    },
    bannedAt: {
      type: Date,
      default: null,
    },

    // ==================== SUBSCRIPTION ====================
    plan: {
      type: String,
      enum: ['free', 'creator', 'pro', 'agency'],
      default: 'free',
    },
    subscriptionStartedAt: {
      type: Date,
      default: null,
    },
    subscriptionExpiresAt: {
      type: Date,
      default: null,
    },
    razorpaySubscriptionId: {
      type: String,
      default: null,
    },

    // ==================== OAUTH ====================
    oauth: {
      googleId: String,
      youtubeRefreshToken: String,
      lastTokenRefresh: Date,
    },

    // ==================== REFERRAL ====================
    referral: {
      myCode: {
        type: String,
        unique: true,
        sparse: true,
      },
      referredBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
      },
      totalReferrals: {
        type: Number,
        default: 0,
      },
      tier: {
        type: String,
        enum: ['bronze', 'silver', 'gold', 'platinum', 'diamond'],
        default: 'bronze',
      },
      totalEarnings: {
        type: Number,
        default: 0,
      },
    },

    // ==================== ACTIVITY ====================
    lastLoginAt: {
      type: Date,
      default: null,
    },
    lastLoginIp: {
      type: String,
      default: null,
    },
    loginCount: {
      type: Number,
      default: 0,
    },

    // ==================== PREFERENCES ====================
    preferences: {
      emailNotifications: {
        type: Boolean,
        default: true,
      },
      marketingEmails: {
        type: Boolean,
        default: false,
      },
      timezone: {
        type: String,
        default: 'UTC',
      },
      language: {
        type: String,
        default: 'en',
      },
    },

    // ==================== METADATA ====================
    metadata: {
      totalChannels: {
        type: Number,
        default: 0,
      },
      totalVideos: {
        type: Number,
        default: 0,
      },
      totalSchedules: {
        type: Number,
        default: 0,
      },
    },
  },
  {
    timestamps: true,
  }
);

// ==================== INDEXES ====================
userSchema.index({ email: 1 });
userSchema.index({ 'referral.myCode': 1 });
userSchema.index({ createdAt: -1 });

// ==================== HOOKS ====================

// Hash password before saving (only if modified)
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);

    // Update passwordChangedAt if not a new document
    if (!this.isNew) {
      this.passwordChangedAt = new Date(Date.now() - 1000);
    }

    next();
  } catch (error) {
    next(error);
  }
});

// ==================== METHODS ====================

// Compare password with hashed password
userSchema.methods.comparePassword = async function (enteredPassword) {
  if (!this.password) {
    throw new Error('Password not available for comparison');
  }
  return await bcrypt.compare(enteredPassword, this.password);
};

// Check if password changed after JWT was issued
userSchema.methods.changedPasswordAfter = function (jwtTimestamp) {
  if (!this.passwordChangedAt) return false;
  const changedTimestamp = Math.floor(this.passwordChangedAt.getTime() / 1000);
  return jwtTimestamp < changedTimestamp;
};

// Generate password reset token
userSchema.methods.generatePasswordResetToken = function () {
  const resetToken = crypto.randomBytes(32).toString('hex');
  this.passwordResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');
  this.passwordResetExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
  return resetToken;
};

// Increment login count
userSchema.methods.incrementLoginCount = async function () {
  this.loginCount = (this.loginCount || 0) + 1;
  await this.save();
};

// Get public user info
userSchema.methods.getPublicProfile = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.passwordResetToken;
  delete obj.passwordResetExpires;
  delete obj.passwordChangedAt;
  delete obj.oauth.youtubeRefreshToken;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
