// src/services/auth.service.js
// FIXED: Full OTP verification via Brevo, forgot password, reset password, no bugs
const crypto = require('crypto');
const User = require('../models/user.model');
const { generateTokenPair, verifyRefreshToken } = require('../utils/jwt.utils');
const { setCache, getCache, deleteCache, getRedisClient } = require('../config/redis');
const { sendOTPEmail, sendPasswordResetEmail, sendWelcomeEmail } = require('../utils/email.utils');
const logger = require('../config/logger');

// ==================== HELPER FUNCTIONS ====================
const sanitizeUser = (user) => {
  const obj = user.toObject ? user.toObject() : user;
  delete obj.password;
  delete obj.passwordResetToken;
  delete obj.passwordResetExpires;
  delete obj.oauth;
  return obj;
};

const generateUniqueReferralCode = async (name) => {
  const base = name.slice(0, 3).toUpperCase() + Math.random().toString(36).substring(2, 8);
  const exists = await User.findOne({ 'referral.myCode': base });
  return exists ? generateUniqueReferralCode(name) : base;
};

const calculateReferralTierFromCount = (count) => {
  if (count >= 50) return 'diamond';
  if (count >= 20) return 'platinum';
  if (count >= 10) return 'gold';
  if (count >= 5) return 'silver';
  return 'bronze';
};

// ==================== REGISTER (OTP FLOW) ====================
const register = async ({ name, email, password, referralCode }) => {
  // Check if email already exists
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    const error = new Error('Email already registered');
    error.statusCode = 409;
    throw error;
  }

  // Validate password strength
  if (password.length < 8) {
    const error = new Error('Password must be at least 8 characters');
    error.statusCode = 400;
    throw error;
  }

  // Handle referral
  let referredBy = null;
  if (referralCode) {
    const referrer = await User.findOne({ 'referral.myCode': referralCode.toUpperCase() });
    if (referrer) {
      referredBy = referrer._id;
    }
  }

  // Generate unique referral code
  const myReferralCode = await generateUniqueReferralCode(name);

  // Create user (NOT verified yet - waiting for OTP)
  const user = await User.create({
    name,
    email,
    password, // Will be hashed by model
    isEmailVerified: false, // Wait for OTP verification
    referral: { myCode: myReferralCode, referredBy },
  });

  // Generate 6-digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  // Store OTP in Redis for 10 minutes with direct client for reliability
  const otpKey = `email_otp:${user._id.toString()}`;
  try {
    const { getRedisClient } = require('../config/redis');
    const redisClient = getRedisClient();
    await redisClient.set(otpKey, otp, 'EX', 600);
    const stored = await redisClient.get(otpKey);
    logger.debug(`[register] OTP stored in Redis: ${stored ? 'YES' : 'FAILED'}`, { key: otpKey });
  } catch (redisErr) {
    logger.error('[register] Redis SET failed', { error: redisErr.message });
    const err = new Error('Server error: Could not save OTP. Please try again.');
    err.statusCode = 500;
    throw err;
  }

  // Send OTP email via Brevo
  try {
    await sendOTPEmail(user.email, user.name, otp);
    logger.info(`[register] OTP email sent`, { email: user.email });
  } catch (emailError) {
    logger.error('[register] Failed to send OTP email', {
      error: emailError.message,
      brevoError: emailError.response?.data,
    });
    // Log OTP for testing when email fails (remove before full production)
    logger.debug(`[register] OTP for ${user.email}: ${otp}`);
  }

  // Update referrer's referral count
  if (referredBy) {
    const referrer = await User.findByIdAndUpdate(
      referredBy,
      { $inc: { 'referral.totalReferrals': 1 } },
      { new: true }
    );
    if (referrer) {
      const tier = calculateReferralTierFromCount(referrer.referral.totalReferrals);
      await User.findByIdAndUpdate(referredBy, { 'referral.tier': tier });
    }
  }

  return {
    user: sanitizeUser(user),
    userId: user._id.toString(),
    requiresVerification: true,
    message: 'OTP sent to your email. Please verify within 10 minutes.',
  };
};

// ==================== VERIFY EMAIL OTP ====================
const verifyEmail = async (otp, userId) => {
  if (!otp || !userId) {
    const error = new Error('OTP and User ID are required');
    error.statusCode = 400;
    throw error;
  }

  // Get OTP from Redis
  const storedOtp = await getCache(`email_otp:${userId}`);
  logger.debug('[verifyEmail] Redis lookup', { userId, storedOtp, inputOtp: otp });
  if (!storedOtp) {
    const error = new Error('OTP expired or not found. Click "Resend OTP" to get a new one.');
    error.statusCode = 400;
    throw error;
  }

  // Verify OTP
  if (storedOtp !== otp) {
    const error = new Error('Invalid OTP. Please try again.');
    error.statusCode = 400;
    throw error;
  }

  // Mark email as verified
  const user = await User.findByIdAndUpdate(userId, { isEmailVerified: true }, { new: true });

  if (!user) {
    const error = new Error('User not found');
    error.statusCode = 404;
    throw error;
  }

  // Delete OTP from Redis
  await deleteCache(`email_otp:${userId}`);

  // Generate tokens
  const tokens = generateTokenPair(user._id.toString(), user.email, user.plan);

  // Send welcome email
  try {
    await sendWelcomeEmail(user.email, user.name);
  } catch (emailError) {
    logger.error('[verifyEmail] Welcome email failed', { error: emailError.message });
  }

  return {
    user: sanitizeUser(user),
    tokens,
    message: 'Email verified successfully! Welcome to TubeOS.',
  };
};

// ==================== RESEND OTP ====================
const resendOTP = async (email) => {
  if (!email) {
    const error = new Error('Email is required');
    error.statusCode = 400;
    throw error;
  }

  const user = await User.findOne({ email });
  if (!user) {
    const error = new Error('User not found');
    error.statusCode = 404;
    throw error;
  }

  if (user.isEmailVerified) {
    const error = new Error('Email already verified. Please login.');
    error.statusCode = 400;
    throw error;
  }

  // Generate new OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  // Store in Redis (10 minutes)
  await setCache(`email_otp:${user._id.toString()}`, otp, 10 * 60);

  // Send email
  try {
    await sendOTPEmail(user.email, user.name, otp);
    logger.info(`[resendOTP] OTP email sent`, { email: user.email });
  } catch (emailError) {
    logger.error('[resendOTP] Failed to send OTP', {
      error: emailError.message,
      brevoError: emailError.response?.data,
    });
    // Log OTP for testing when email fails (remove before full production)
    logger.debug(`[resendOTP] OTP for ${user.email}: ${otp}`);
  }

  return {
    userId: user._id.toString(),
    message: 'OTP sent to your email.',
  };
};

// ==================== LOGIN ====================
const login = async ({ email, password, ip }) => {
  if (!email || !password) {
    const error = new Error('Email and password are required');
    error.statusCode = 400;
    throw error;
  }

  // Find user (+isAdmin so the frontend can gate the admin panel)
  const user = await User.findOne({ email }).select('+password +isAdmin');
  logger.debug('[login] lookup', {
    email,
    found: !!user,
    verified: user?.isEmailVerified,
    active: user?.isActive,
  });
  if (!user) {
    const error = new Error('Invalid email or password');
    error.statusCode = 401;
    throw error;
  }

  // Check if email is verified — send userId so frontend can show OTP form
  if (!user.isEmailVerified) {
    const error = new Error('Please verify your email first');
    error.statusCode = 403;
    error.userId = user._id.toString();
    throw error;
  }

  // Compare passwords
  const isPasswordCorrect = await user.comparePassword(password);
  logger.debug('[login] password check', { email, passwordMatch: isPasswordCorrect });
  if (!isPasswordCorrect) {
    const error = new Error('Invalid email or password');
    error.statusCode = 401;
    throw error;
  }

  // Check if user is active
  if (!user.isActive) {
    const error = new Error('Account has been deactivated');
    error.statusCode = 403;
    throw error;
  }

  // Check if user is banned
  if (user.isBanned) {
    const error = new Error('Account has been suspended');
    error.statusCode = 403;
    throw error;
  }

  // Generate tokens
  const tokens = generateTokenPair(user._id.toString(), user.email, user.plan);

  // Log login
  await User.findByIdAndUpdate(user._id, { lastLoginAt: new Date(), lastLoginIp: ip });

  return {
    user: sanitizeUser(user),
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    message: 'Login successful',
  };
};

// ==================== FORGOT PASSWORD ====================
const forgotPassword = async (email) => {
  if (!email) {
    const error = new Error('Email is required');
    error.statusCode = 400;
    throw error;
  }

  const user = await User.findOne({ email });
  logger.debug('[forgotPassword] lookup', { email, found: !!user });
  if (!user) {
    // Don't reveal if email exists or not (security)
    return {
      message: 'If an account exists, a password reset link has been sent.',
    };
  }

  // Generate reset token
  const resetToken = crypto.randomBytes(32).toString('hex');
  const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

  // Store in Redis (non-fatal)
  try {
    await setCache(`pwd_reset:${hashedToken}`, user._id.toString(), 15 * 60);
    logger.debug('[forgotPassword] Token stored in Redis', { email: user.email });
  } catch (redisErr) {
    logger.warn('[forgotPassword] Redis store failed (non-fatal)', { error: redisErr.message });
  }

  // Store in DB for backup using findByIdAndUpdate (bypasses schema validation issues)
  try {
    await User.findByIdAndUpdate(user._id, {
      passwordResetToken: hashedToken,
      passwordResetExpires: new Date(Date.now() + 15 * 60 * 1000),
    });
    logger.debug('[forgotPassword] Token saved in DB', { email: user.email });
  } catch (dbErr) {
    logger.warn('[forgotPassword] DB save skipped (non-fatal)', { error: dbErr.message });
  }

  // Reset link logged at debug level only — contains the plaintext token
  const clientUrl = process.env.CLIENT_URL || 'https://tubeos-eight.vercel.app';
  logger.debug(
    `[forgotPassword] RESET LINK for ${user.email}: ${clientUrl}/reset-password?token=${resetToken}`
  );

  // Send reset email
  try {
    await sendPasswordResetEmail(user.email, user.name, resetToken);
    logger.info('[forgotPassword] Reset email sent', { email: user.email });
  } catch (emailError) {
    logger.error('[forgotPassword] Failed to send reset email', {
      error: emailError.message,
      brevoError: emailError.response?.data,
    });
    // Don't throw — token is saved in DB, user can use the logged link above
  }

  return {
    message: 'Password reset link sent to your email. Valid for 15 minutes.',
  };
};

// ==================== RESET PASSWORD ====================
const resetPassword = async (resetToken, newPassword) => {
  if (!resetToken || !newPassword) {
    const error = new Error('Reset token and new password are required');
    error.statusCode = 400;
    throw error;
  }

  if (newPassword.length < 8) {
    const error = new Error('Password must be at least 8 characters');
    error.statusCode = 400;
    throw error;
  }

  // Hash token to match with stored value
  const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

  // Check Redis directly
  let userId = null;
  try {
    const redisClient = getRedisClient();
    const raw = await redisClient.get(`pwd_reset:${hashedToken}`);
    logger.debug('[resetPassword] Redis lookup', {
      keyPrefix: hashedToken.slice(0, 8),
      found: !!raw,
    });
    if (raw) userId = raw.replace(/^"|"$/g, ''); // strip JSON quotes if present
  } catch (redisErr) {
    logger.error('[resetPassword] Redis get error', { error: redisErr.message });
  }

  if (!userId) {
    // Check DB as backup
    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() },
    });
    logger.debug('[resetPassword] DB lookup', { found: !!user });

    if (!user) {
      const error = new Error('Reset token is invalid or expired');
      error.statusCode = 400;
      throw error;
    }
    userId = user._id.toString();
  }

  // Update password
  const user = await User.findById(userId);
  if (!user) {
    const error = new Error('User not found');
    error.statusCode = 404;
    throw error;
  }

  user.password = newPassword; // Will be hashed by model
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  user.passwordChangedAt = new Date();
  await user.save();

  // Clear from cache
  await deleteCache(`pwd_reset:${hashedToken}`);

  return {
    message: 'Password reset successful. You can now login with your new password.',
  };
};

// ==================== REFRESH TOKEN ====================
const refreshToken = async (token) => {
  if (!token) {
    const error = new Error('Refresh token is required');
    error.statusCode = 401;
    throw error;
  }

  try {
    const decoded = verifyRefreshToken(token);
    const user = await User.findById(decoded.id);

    if (!user) {
      const error = new Error('User not found');
      error.statusCode = 404;
      throw error;
    }

    // Check if password was changed after token issue
    if (user.passwordChangedAt) {
      const changedTime = Math.floor(user.passwordChangedAt.getTime() / 1000);
      if (decoded.iat < changedTime) {
        const error = new Error('Password recently changed. Please login again.');
        error.statusCode = 401;
        throw error;
      }
    }

    const tokens = generateTokenPair(user._id.toString(), user.email, user.plan);
    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  } catch (err) {
    const error = new Error('Invalid or expired refresh token', { cause: err });
    error.statusCode = 401;
    throw error;
  }
};

// ==================== GET PROFILE ====================
const getProfile = async (userId) => {
  // +isAdmin so refreshUser() exposes the flag for the frontend AdminRoute
  const user = await User.findById(userId).select('+isAdmin');
  if (!user) {
    const error = new Error('User not found');
    error.statusCode = 404;
    throw error;
  }

  return {
    user: sanitizeUser(user),
  };
};

// ==================== UPDATE PROFILE ====================
const updateProfile = async (userId, updates) => {
  // Allowed fields to update
  const allowedFields = ['name', 'avatar', 'bio'];
  const filteredUpdates = {};

  allowedFields.forEach((field) => {
    if (updates[field] !== undefined) {
      filteredUpdates[field] = updates[field];
    }
  });

  const user = await User.findByIdAndUpdate(userId, filteredUpdates, {
    new: true,
    runValidators: true,
  });

  if (!user) {
    const error = new Error('User not found');
    error.statusCode = 404;
    throw error;
  }

  return {
    user: sanitizeUser(user),
    message: 'Profile updated successfully',
  };
};

// ==================== CHANGE PASSWORD ====================
const changePassword = async (userId, currentPassword, newPassword) => {
  if (!currentPassword || !newPassword) {
    const error = new Error('Current and new passwords are required');
    error.statusCode = 400;
    throw error;
  }

  if (newPassword.length < 8) {
    const error = new Error('New password must be at least 8 characters');
    error.statusCode = 400;
    throw error;
  }

  const user = await User.findById(userId).select('+password');
  if (!user) {
    const error = new Error('User not found');
    error.statusCode = 404;
    throw error;
  }

  // Verify current password
  const isCorrect = await user.comparePassword(currentPassword);
  if (!isCorrect) {
    const error = new Error('Current password is incorrect');
    error.statusCode = 401;
    throw error;
  }

  // Update password
  user.password = newPassword;
  user.passwordChangedAt = new Date();
  await user.save();

  return {
    message: 'Password changed successfully. Please login again.',
  };
};

// ==================== LOGOUT ====================
const logout = async (userId, refreshToken) => {
  // Could blacklist token in Redis if needed
  // For now, token will just expire naturally
  return {
    message: 'Logged out successfully',
  };
};

// ==================== LOGOUT ALL DEVICES ====================
const logoutAll = async (userId) => {
  // Could invalidate all tokens for this user in Redis
  return {
    message: 'Logged out from all devices',
  };
};

module.exports = {
  register,
  verifyEmail,
  resendOTP,
  login,
  forgotPassword,
  resetPassword,
  refreshToken,
  getProfile,
  updateProfile,
  changePassword,
  logout,
  logoutAll,
};
