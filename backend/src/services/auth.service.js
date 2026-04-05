// src/services/auth.service.js
// All authentication business logic lives here
// Controllers are thin — services do the heavy lifting

const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const User = require('../models/user.model');
const { generateTokenPair, verifyRefreshToken } = require('../utils/jwt.utils');
const { setCache, getCache, deleteCache } = require('../config/redis');
const {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail,
  sendOTPEmail,
} = require('../utils/email.utils');

// ==================== REGISTER ====================
const register = async ({ name, email, password, referralCode }) => {
  // 1. Check if email already exists
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    const error = new Error('Email already registered');
    error.statusCode = 409;
    throw error;
  }

  // 2. Find referrer if referral code provided
  let referredBy = null;
  if (referralCode) {
    const referrer = await User.findOne({ 'referral.myCode': referralCode.toUpperCase() });
    if (referrer) {
      referredBy = referrer._id;
    }
  }

  // 3. Generate unique referral code for new user
  const myReferralCode = await generateUniqueReferralCode(name);

  // 4. Create user
  const user = await User.create({
    name,
    email,
    password,
    isEmailVerified: !process.env.BREVO_API_KEY, // Auto-verify if Brevo not configured
    referral: {
      myCode: myReferralCode,
      referredBy,
    },
  });

  // 5. Generate 6-digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  // Store OTP in Redis (expires in 10 minutes)
  await setCache(
    `email_otp:${user._id.toString()}`,
    { otp, userId: user._id.toString() },
    10 * 60
  );

  // 6. Send OTP email
  try {
    await sendOTPEmail(user, otp);
  } catch (emailError) {
    console.error('Failed to send OTP email:', emailError.message);
    // Don't fail registration if email fails
  }

  // 7. If referred, update referrer stats
  if (referredBy) {
    await User.findByIdAndUpdate(referredBy, {
      $inc: { 'referral.totalReferrals': 1 },
      $set: { 'referral.tier': await calculateReferralTier(referredBy) },
    });
  }

  return {
    user: sanitizeUser(user),
    userId: user._id.toString(),
    requiresVerification: !!process.env.BREVO_API_KEY,
    message: process.env.BREVO_API_KEY
      ? 'OTP sent to your email. Please verify to continue.'
      : 'Registration successful! You can now login.',
  };
};

// ==================== VERIFY EMAIL OTP ====================
const verifyEmail = async (token, userId) => {
  // Support both OTP (new) and token link (old)
  let cachedUserId = userId;

  if (userId) {
    // OTP flow: verify otp against userId
    const cached = await getCache(`email_otp:${userId}`);
    if (!cached || cached.otp !== token) {
      const error = new Error('Invalid or expired OTP');
      error.statusCode = 400;
      throw error;
    }
    await deleteCache(`email_otp:${userId}`);
  } else {
    // Legacy link flow
    const cached = await getCache(`email_verify:${token}`);
    if (!cached) {
      const error = new Error('Invalid or expired verification link');
      error.statusCode = 400;
      throw error;
    }
    cachedUserId = cached.userId;
    await deleteCache(`email_verify:${token}`);
  }

  // Find and update user
  const user = await User.findById(cachedUserId);
  if (!user) {
    const error = new Error('User not found');
    error.statusCode = 404;
    throw error;
  }

  if (user.isEmailVerified) {
    const error = new Error('Email already verified');
    error.statusCode = 400;
    throw error;
  }

  user.isEmailVerified = true;
  await user.save();

  // Send welcome email
  try {
    await sendWelcomeEmail(user);
  } catch (err) {
    console.error('Failed to send welcome email:', err.message);
  }

  // Generate tokens for auto-login after verification
  const tokens = generateTokenPair(user);

  return {
    user: sanitizeUser(user),
    tokens,
    message: 'Email verified successfully!',
  };
};

// ==================== LOGIN ====================
const login = async ({ email, password, ip }) => {
  // 1. Find user (include password for comparison)
  const user = await User.findOne({ email }).select('+password +refreshTokens');

  if (!user) {
    const error = new Error('Invalid email or password');
    error.statusCode = 401;
    throw error;
  }

  // 2. Check if banned
  if (user.isBanned) {
    const error = new Error(`Account banned: ${user.banReason || 'Contact support'}`);
    error.statusCode = 403;
    throw error;
  }

  // 3. Compare password
  const isPasswordValid = await user.comparePassword(password);
  if (!isPasswordValid) {
    const error = new Error('Invalid email or password');
    error.statusCode = 401;
    throw error;
  }

  // 4. Check email verification (skip if email not configured)
  if (!user.isEmailVerified && process.env.BREVO_API_KEY) {
    const error = new Error('Please verify your email before logging in');
    error.statusCode = 403;
    error.code = 'EMAIL_NOT_VERIFIED';
    throw error;
  }

  // 5. Generate tokens
  const { accessToken, refreshToken } = generateTokenPair(user);

  // 6. Store refresh token (keep max 5 sessions)
  user.refreshTokens = [...(user.refreshTokens || []).slice(-4), refreshToken];
  user.lastLoginAt = new Date();
  user.lastLoginIp = ip;
  await user.save();

  return {
    user: sanitizeUser(user),
    accessToken,
    refreshToken,
    message: 'Login successful',
  };
};

// ==================== REFRESH TOKEN ====================
const refreshToken = async (token) => {
  if (!token) {
    const error = new Error('Refresh token required');
    error.statusCode = 401;
    throw error;
  }

  // 1. Verify refresh token
  let decoded;
  try {
    decoded = verifyRefreshToken(token);
  } catch (err) {
    const error = new Error('Invalid or expired refresh token');
    error.statusCode = 401;
    throw error;
  }

  // 2. Find user and check token exists
  const user = await User.findById(decoded.id).select('+refreshTokens');
  if (!user || !user.refreshTokens.includes(token)) {
    const error = new Error('Invalid refresh token');
    error.statusCode = 401;
    throw error;
  }

  // 3. Rotate refresh token (invalidate old, issue new)
  const { accessToken, refreshToken: newRefreshToken } = generateTokenPair(user);

  user.refreshTokens = user.refreshTokens
    .filter((t) => t !== token)
    .concat(newRefreshToken)
    .slice(-5);

  await user.save();

  return {
    accessToken,
    refreshToken: newRefreshToken,
  };
};

// ==================== LOGOUT ====================
const logout = async (userId, refreshTokenValue) => {
  const user = await User.findById(userId).select('+refreshTokens');
  if (user) {
    // Remove specific refresh token
    user.refreshTokens = user.refreshTokens.filter((t) => t !== refreshTokenValue);
    await user.save();
  }
  return { message: 'Logged out successfully' };
};

// ==================== LOGOUT ALL DEVICES ====================
const logoutAll = async (userId) => {
  await User.findByIdAndUpdate(userId, { refreshTokens: [] });
  return { message: 'Logged out from all devices' };
};

// ==================== FORGOT PASSWORD ====================
const forgotPassword = async (email) => {
  const user = await User.findOne({ email });

  // Always return success (don't leak if email exists)
  if (!user) {
    return { message: 'If that email exists, a reset link has been sent' };
  }

  // Generate reset token
  const resetToken = crypto.randomBytes(32).toString('hex');

  // Store in Redis (10 minutes)
  await setCache(
    `pwd_reset:${resetToken}`,
    { userId: user._id.toString() },
    10 * 60
  );

  // Send email
  try {
    await sendPasswordResetEmail(user, resetToken);
  } catch (err) {
    await deleteCache(`pwd_reset:${resetToken}`);
    const error = new Error('Failed to send reset email. Try again later.');
    error.statusCode = 500;
    throw error;
  }

  return { message: 'If that email exists, a reset link has been sent' };
};

// ==================== RESET PASSWORD ====================
const resetPassword = async (token, newPassword) => {
  // 1. Get token from Redis
  const cached = await getCache(`pwd_reset:${token}`);
  if (!cached) {
    const error = new Error('Invalid or expired reset token');
    error.statusCode = 400;
    throw error;
  }

  // 2. Find user
  const user = await User.findById(cached.userId).select('+refreshTokens');
  if (!user) {
    const error = new Error('User not found');
    error.statusCode = 404;
    throw error;
  }

  // 3. Update password
  user.password = newPassword;
  user.refreshTokens = []; // Invalidate all sessions
  await user.save();

  // 4. Delete reset token
  await deleteCache(`pwd_reset:${token}`);

  return { message: 'Password reset successful. Please login with your new password.' };
};

// ==================== GET PROFILE ====================
const getProfile = async (userId) => {
  const user = await User.findById(userId)
    .populate('youtubeChannels', 'channelName channelId thumbnail subscriberCount')
    .lean({ virtuals: true });

  if (!user) {
    const error = new Error('User not found');
    error.statusCode = 404;
    throw error;
  }

  return { user: sanitizeUser(user) };
};

// ==================== UPDATE PROFILE ====================
const updateProfile = async (userId, updates) => {
  const allowedFields = ['name', 'avatar', 'preferences'];
  const filteredUpdates = {};

  allowedFields.forEach((field) => {
    if (updates[field] !== undefined) {
      filteredUpdates[field] = updates[field];
    }
  });

  const user = await User.findByIdAndUpdate(
    userId,
    { $set: filteredUpdates },
    { new: true, runValidators: true }
  );

  return { user: sanitizeUser(user) };
};

// ==================== CHANGE PASSWORD ====================
const changePassword = async (userId, currentPassword, newPassword) => {
  const user = await User.findById(userId).select('+password +refreshTokens');

  const isValid = await user.comparePassword(currentPassword);
  if (!isValid) {
    const error = new Error('Current password is incorrect');
    error.statusCode = 400;
    throw error;
  }

  user.password = newPassword;
  user.refreshTokens = []; // Logout all devices
  await user.save();

  return { message: 'Password changed successfully. Please login again.' };
};

// ==================== HELPERS ====================

// Remove sensitive fields from user object
const sanitizeUser = (user) => {
  const userObj = user.toObject ? user.toObject({ virtuals: true }) : { ...user };
  delete userObj.password;
  delete userObj.refreshTokens;
  delete userObj.emailVerificationToken;
  delete userObj.passwordResetToken;
  delete userObj.__v;
  return userObj;
};

// Generate unique referral code from name
const generateUniqueReferralCode = async (name) => {
  const base = name.toUpperCase().replace(/[^A-Z]/g, '').substring(0, 4);
  let code;
  let exists = true;

  while (exists) {
    const random = Math.floor(1000 + Math.random() * 9000);
    code = `${base}${random}`;
    const found = await User.findOne({ 'referral.myCode': code });
    exists = !!found;
  }

  return code;
};

// Calculate referral tier based on count
const calculateReferralTier = async (userId) => {
  const user = await User.findById(userId);
  const count = user.referral.totalReferrals;
  if (count >= 50) return 'legend';
  if (count >= 21) return 'champion';
  if (count >= 6) return 'grower';
  return 'starter';
};

// ==================== RESEND OTP ====================
const resendOTP = async (email) => {
  const user = await User.findOne({ email });
  if (!user) {
    const error = new Error('Email not found');
    error.statusCode = 404;
    throw error;
  }

  if (user.isEmailVerified) {
    const error = new Error('Email already verified');
    error.statusCode = 400;
    throw error;
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  await setCache(`email_otp:${user._id.toString()}`, { otp, userId: user._id.toString() }, 10 * 60);

  try {
    await sendOTPEmail(user, otp);
  } catch (err) {
    console.error('Failed to resend OTP:', err.message);
  }

  return { message: 'OTP resent successfully', userId: user._id.toString() };
};


module.exports = {
  register,
  verifyEmail,
  resendOTP,
  login,
  refreshToken,
  logout,
  logoutAll,
  forgotPassword,
  resetPassword,
  getProfile,
  updateProfile,
  changePassword,
};
