// src/controllers/auth.controller.js
// Thin controllers — just handle req/res, call service

const authService = require('../services/auth.service');
const { successResponse, errorResponse } = require('../utils/response.utils');
const { getRefreshTokenCookieOptions } = require('../utils/jwt.utils');

// POST /api/v1/auth/register
const register = async (req, res) => {
  try {
    const { name, email, password, referralCode } = req.body;
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

// GET/POST /api/v1/auth/verify-email
// GET query: { token } for legacy email link
// POST body: { otp, userId } for OTP flow
const verifyEmail = async (req, res) => {
  try {
    const token = req.query.token || req.body?.otp;
    const userId = req.body?.userId;

    if (!token) {
      return errorResponse(res, 400, 'Verification token or OTP is required');
    }

    const result = await authService.verifyEmail(token, userId);

    // Set refresh token in cookie
    res.cookie('refreshToken', result.tokens.refreshToken, getRefreshTokenCookieOptions());

    return successResponse(res, 200, result.message, {
      user: result.user,
      accessToken: result.tokens.accessToken,
    });
  } catch (err) {
    return errorResponse(res, err.statusCode || 500, err.message);
  }
};

// POST /api/v1/auth/login
const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const ip = req.ip || req.connection.remoteAddress;

    const result = await authService.login({ email, password, ip });

    // Set refresh token in HttpOnly cookie
    res.cookie('refreshToken', result.refreshToken, getRefreshTokenCookieOptions());

    return successResponse(res, 200, result.message, {
      user: result.user,
      accessToken: result.accessToken,
    });
  } catch (err) {
    return errorResponse(res, err.statusCode || 500, err.message);
  }
};

// POST /api/v1/auth/refresh
const refresh = async (req, res) => {
  try {
    // Get refresh token from cookie or body
    const token = req.cookies?.refreshToken || req.body?.refreshToken;

    const result = await authService.refreshToken(token);

    // Set new refresh token in cookie
    res.cookie('refreshToken', result.refreshToken, getRefreshTokenCookieOptions());

    return successResponse(res, 200, 'Token refreshed', {
      accessToken: result.accessToken,
    });
  } catch (err) {
    return errorResponse(res, err.statusCode || 401, err.message);
  }
};

// POST /api/v1/auth/logout
const logout = async (req, res) => {
  try {
    const token = req.cookies?.refreshToken || req.body?.refreshToken;
    await authService.logout(req.user.id, token);

    // Clear cookie
    res.clearCookie('refreshToken', { path: '/api/v1/auth' });

    return successResponse(res, 200, 'Logged out successfully');
  } catch (err) {
    return errorResponse(res, err.statusCode || 500, err.message);
  }
};

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

// POST /api/v1/auth/forgot-password
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const result = await authService.forgotPassword(email);
    return successResponse(res, 200, result.message);
  } catch (err) {
    return errorResponse(res, err.statusCode || 500, err.message);
  }
};

// POST /api/v1/auth/reset-password
const resetPassword = async (req, res) => {
  try {
    const { token } = req.query;
    const { password } = req.body;

    if (!token) return errorResponse(res, 400, 'Reset token is required');
    if (!password) return errorResponse(res, 400, 'New password is required');

    const result = await authService.resetPassword(token, password);
    return successResponse(res, 200, result.message);
  } catch (err) {
    return errorResponse(res, err.statusCode || 500, err.message);
  }
};

// GET /api/v1/auth/me
const getMe = async (req, res) => {
  try {
    const result = await authService.getProfile(req.user.id);
    return successResponse(res, 200, 'Profile fetched', result.user);
  } catch (err) {
    return errorResponse(res, err.statusCode || 500, err.message);
  }
};

// PATCH /api/v1/auth/me
const updateMe = async (req, res) => {
  try {
    const result = await authService.updateProfile(req.user.id, req.body);
    return successResponse(res, 200, 'Profile updated', result.user);
  } catch (err) {
    return errorResponse(res, err.statusCode || 500, err.message);
  }
};

// PATCH /api/v1/auth/change-password
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const result = await authService.changePassword(req.user.id, currentPassword, newPassword);
    res.clearCookie('refreshToken', { path: '/api/v1/auth' });
    return successResponse(res, 200, result.message);
  } catch (err) {
    return errorResponse(res, err.statusCode || 500, err.message);
  }
};

// POST /api/v1/auth/resend-otp
const resendOTP = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return errorResponse(res, 400, 'Email is required');
    const result = await authService.resendOTP(email);
    return successResponse(res, 200, result.message, { userId: result.userId });
  } catch (err) {
    return errorResponse(res, err.statusCode || 500, err.message);
  }
};


module.exports = {
  register,
  verifyEmail,
  resendOTP,
  login,
  refresh,
  logout,
  logoutAll,
  forgotPassword,
  resetPassword,
  getMe,
  updateMe,
  changePassword,
};
