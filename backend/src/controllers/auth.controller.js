
// src/controllers/auth.controller.js
// FIXED: All auth endpoints - register, OTP verify, login, forgot password, reset password
const authService = require('../services/auth.service');
const { successResponse, errorResponse } = require('../utils/response.utils');
const { getRefreshTokenCookieOptions } = require('../utils/jwt.utils');

// ==================== REGISTER ====================
// POST /api/v1/auth/register
// Body: { name, email, password, referralCode? }
const register = async (req, res) => {
  try {
    const { name, email, password, referralCode } = req.body;

    // Validation
    if (!name || !email || !password) {
      return errorResponse(res, 400, 'Name, email, and password are required');
    }

    if (password.length < 8) {
      return errorResponse(res, 400, 'Password must be at least 8 characters');
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return errorResponse(res, 400, 'Invalid email format');
    }

    const result = await authService.register({ name, email, password, referralCode });

    return successResponse(res, 201, result.message, {
      user: result.user,
      userId: result.userId,
      requiresVerification: result.requiresVerification,
    });
  } catch (err) {
    return errorResponse(res, err.statusCode || 500, err.message);
  }
};

// ==================== VERIFY EMAIL WITH OTP ====================
// POST /api/v1/auth/verify-email
// Body: { userId, otp }
const verifyEmail = async (req, res) => {
  try {
    const { userId, otp } = req.body;

    if (!userId || !otp) {
      return errorResponse(res, 400, 'User ID and OTP are required');
    }

    if (otp.length !== 6) {
      return errorResponse(res, 400, 'OTP must be 6 digits');
    }

    const result = await authService.verifyEmail(otp, userId);

    // Set refresh token cookie (works for same-origin)
    res.cookie('refreshToken', result.tokens.refreshToken, getRefreshTokenCookieOptions());

    return successResponse(res, 200, result.message, {
      user: result.user,
      accessToken: result.tokens.accessToken,
      refreshToken: result.tokens.refreshToken,
    });
  } catch (err) {
    return errorResponse(res, err.statusCode || 400, err.message);
  }
};

// ==================== RESEND OTP ====================
// POST /api/v1/auth/resend-otp
// Body: { email }
const resendOTP = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return errorResponse(res, 400, 'Email is required');
    }

    const result = await authService.resendOTP(email);

    return successResponse(res, 200, result.message, {
      userId: result.userId,
    });
  } catch (err) {
    return errorResponse(res, err.statusCode || 400, err.message);
  }
};

// ==================== LOGIN ====================
// POST /api/v1/auth/login
// Body: { email, password }
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return errorResponse(res, 400, 'Email and password are required');
    }

    const ip = req.ip || req.connection?.remoteAddress || 'unknown';
    const result = await authService.login({ email, password, ip });

    // Set refresh token cookie (same-origin)
    res.cookie('refreshToken', result.refreshToken, getRefreshTokenCookieOptions());

    return successResponse(res, 200, result.message, {
      user: result.user,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken, // Also in body for cross-origin
    });
  } catch (err) {
    return errorResponse(res, err.statusCode || 401, err.message);
  }
};

// ==================== FORGOT PASSWORD ====================
// POST /api/v1/auth/forgot-password
// Body: { email }
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return errorResponse(res, 400, 'Email is required');
    }

    const result = await authService.forgotPassword(email);

    // Always return success (security: don't reveal if email exists)
    return successResponse(res, 200, result.message);
  } catch (err) {
    // Still return 200 for security
    return successResponse(res, 200, 'If an account exists, a password reset link has been sent.');
  }
};

// ==================== RESET PASSWORD ====================
// POST /api/v1/auth/reset-password
// Query: { token }
// Body: { password }
const resetPassword = async (req, res) => {
  try {
    const { token } = req.query;
    const { password } = req.body;

    if (!token) {
      return errorResponse(res, 400, 'Reset token is required');
    }

    if (!password) {
      return errorResponse(res, 400, 'New password is required');
    }

    if (password.length < 8) {
      return errorResponse(res, 400, 'Password must be at least 8 characters');
    }

    const result = await authService.resetPassword(token, password);

    return successResponse(res, 200, result.message);
  } catch (err) {
    return errorResponse(res, err.statusCode || 400, err.message);
  }
};

// ==================== REFRESH TOKEN ====================
// POST /api/v1/auth/refresh
// Body: { refreshToken? } (or Cookie: refreshToken)
const refresh = async (req, res) => {
  try {
    // Get token from cookie OR body (for cross-origin)
    const token = req.cookies?.refreshToken || req.body?.refreshToken;

    if (!token) {
      return errorResponse(res, 401, 'Refresh token required');
    }

    const result = await authService.refreshToken(token);

    // Set new refresh token cookie
    res.cookie('refreshToken', result.refreshToken, getRefreshTokenCookieOptions());

    return successResponse(res, 200, 'Token refreshed', {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    });
  } catch (err) {
    return errorResponse(res, err.statusCode || 401, err.message);
  }
};

// ==================== GET PROFILE ====================
// GET /api/v1/auth/me
const getMe = async (req, res) => {
  try {
    const result = await authService.getProfile(req.user.id);
    return successResponse(res, 200, 'Profile fetched', result.user);
  } catch (err) {
    return errorResponse(res, err.statusCode || 500, err.message);
  }
};

// ==================== UPDATE PROFILE ====================
// PATCH /api/v1/auth/me
// Body: { name?, avatar?, bio? }
const updateMe = async (req, res) => {
  try {
    const result = await authService.updateProfile(req.user.id, req.body);
    return successResponse(res, 200, result.message, result.user);
  } catch (err) {
    return errorResponse(res, err.statusCode || 500, err.message);
  }
};

// ==================== CHANGE PASSWORD ====================
// PATCH /api/v1/auth/change-password
// Body: { currentPassword, newPassword }
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return errorResponse(res, 400, 'Current and new passwords are required');
    }

    const result = await authService.changePassword(req.user.id, currentPassword, newPassword);

    // Clear refresh token cookie
    res.clearCookie('refreshToken', { path: '/api/v1/auth' });

    return successResponse(res, 200, result.message);
  } catch (err) {
    return errorResponse(res, err.statusCode || 401, err.message);
  }
};

// ==================== LOGOUT ====================
// POST /api/v1/auth/logout
const logout = async (req, res) => {
  try {
    const token = req.cookies?.refreshToken || req.body?.refreshToken;
    await authService.logout(req.user.id, token);

    res.clearCookie('refreshToken', { path: '/api/v1/auth' });

    return successResponse(res, 200, 'Logged out successfully');
  } catch (err) {
    return errorResponse(res, err.statusCode || 500, err.message);
  }
};

// ==================== LOGOUT ALL DEVICES ====================
// POST /api/v1/auth/logout-all
const logoutAll = async (req, res) => {
  try {
    await authService.logoutAll(req.user.id);

    res.clearCookie('refreshToken', { path: '/api/v1/auth' });

    return successResponse(res, 200, 'Logged out from all devices');
  } catch (err) {
    return errorResponse(res, err.statusCode || 500, err.message);
  }
};

module.exports = {
  register,
  verifyEmail,
  resendOTP,
  login,
  forgotPassword,
  resetPassword,
  refresh,
  getMe,
  updateMe,
  changePassword,
  logout,
  logoutAll,
};
  
