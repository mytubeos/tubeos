
// src/routes/auth.routes.js
// FIXED: Complete auth routes with OTP verification, forgot password, reset password
const express = require('express');
const authController = require('../controllers/auth.controller');
const { protect } = require('../middlewares/auth.middleware');
const { authLimiter } = require('../middlewares/rateLimiter.middleware');

const router = express.Router();

// ==================== PUBLIC ROUTES ====================

// POST /api/v1/auth/register — Register with email/password, sends OTP
router.post('/register', authLimiter, authController.register);

// POST /api/v1/auth/verify-email — Verify email with OTP
router.post('/verify-email', authLimiter, authController.verifyEmail);

// POST /api/v1/auth/resend-otp — Resend OTP if expired
router.post('/resend-otp', authLimiter, authController.resendOTP);

// POST /api/v1/auth/login — Login with email/password
router.post('/login', authLimiter, authController.login);

// POST /api/v1/auth/forgot-password — Request password reset link
router.post('/forgot-password', authLimiter, authController.forgotPassword);

// POST /api/v1/auth/reset-password — Reset password with token
router.post('/reset-password', authLimiter, authController.resetPassword);

// POST /api/v1/auth/refresh — Refresh access token
router.post('/refresh', authController.refresh);

// ==================== PROTECTED ROUTES ====================

// GET /api/v1/auth/me — Get current user profile
router.get('/me', protect, authController.getMe);

// PATCH /api/v1/auth/me — Update user profile
router.patch('/me', protect, authController.updateMe);

// PATCH /api/v1/auth/change-password — Change password (logged-in user)
router.patch('/change-password', protect, authLimiter, authController.changePassword);

// POST /api/v1/auth/logout — Logout current device
router.post('/logout', protect, authController.logout);

// POST /api/v1/auth/logout-all — Logout from all devices
router.post('/logout-all', protect, authController.logoutAll);

module.exports = router;
