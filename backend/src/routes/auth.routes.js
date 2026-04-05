// src/routes/auth.routes.js
// All authentication routes with input validation

const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { protect } = require('../middlewares/auth.middleware');
const {
  authLimiter,
  passwordResetLimiter,
} = require('../middlewares/rateLimiter.middleware');

// ==================== VALIDATION HELPERS ====================
const validate = (rules) => {
  return (req, res, next) => {
    const errors = [];

    rules.forEach((rule) => {
      const value = req.body[rule.field];

      // Required check
      if (rule.required && (value === undefined || value === null || value === '')) {
        errors.push({ field: rule.field, message: `${rule.field} is required` });
        return;
      }

      // Skip further checks if not provided and not required
      if (value === undefined || value === null || value === '') return;

      // Min length
      if (rule.minLength && String(value).length < rule.minLength) {
        errors.push({
          field: rule.field,
          message: `${rule.field} must be at least ${rule.minLength} characters`,
        });
      }

      // Max length
      if (rule.maxLength && String(value).length > rule.maxLength) {
        errors.push({
          field: rule.field,
          message: `${rule.field} cannot exceed ${rule.maxLength} characters`,
        });
      }

      // Email format
      if (rule.isEmail) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
          errors.push({ field: rule.field, message: 'Please provide a valid email' });
        }
      }

      // Password strength
      if (rule.isPassword) {
        const hasUpperCase = /[A-Z]/.test(value);
        const hasLowerCase = /[a-z]/.test(value);
        const hasNumbers = /\d/.test(value);
        if (!hasUpperCase || !hasLowerCase || !hasNumbers) {
          errors.push({
            field: rule.field,
            message: 'Password must contain uppercase, lowercase, and a number',
          });
        }
      }
    });

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors,
      });
    }

    next();
  };
};

// ==================== ROUTES ====================

/**
 * @route   POST /api/v1/auth/register
 * @desc    Register new user
 * @access  Public
 */
router.post(
  '/register',
  authLimiter,
  validate([
    { field: 'name', required: true, minLength: 2, maxLength: 50 },
    { field: 'email', required: true, isEmail: true },
    { field: 'password', required: true, minLength: 8, isPassword: true },
  ]),
  authController.register
);

/**
 * @route   GET /api/v1/auth/verify-email
 * @desc    Verify email with token
 * @access  Public
 */
router.get('/verify-email', authController.verifyEmail);
router.post('/verify-email', authController.verifyEmail);
router.post('/resend-otp', authLimiter, validate([{ field: 'email', required: true, isEmail: true }]), authController.resendOTP);

/**
 * @route   POST /api/v1/auth/login
 * @desc    Login user
 * @access  Public
 */
router.post(
  '/login',
  authLimiter,
  validate([
    { field: 'email', required: true, isEmail: true },
    { field: 'password', required: true },
  ]),
  authController.login
);

/**
 * @route   POST /api/v1/auth/refresh
 * @desc    Refresh access token using refresh token
 * @access  Public (needs valid refresh token in cookie or body)
 */
router.post('/refresh', authController.refresh);

/**
 * @route   POST /api/v1/auth/logout
 * @desc    Logout current session
 * @access  Private
 */
router.post('/logout', protect, authController.logout);

/**
 * @route   POST /api/v1/auth/logout-all
 * @desc    Logout from all devices
 * @access  Private
 */
router.post('/logout-all', protect, authController.logoutAll);

/**
 * @route   POST /api/v1/auth/forgot-password
 * @desc    Send password reset email
 * @access  Public
 */
router.post(
  '/forgot-password',
  passwordResetLimiter,
  validate([{ field: 'email', required: true, isEmail: true }]),
  authController.forgotPassword
);

/**
 * @route   POST /api/v1/auth/reset-password
 * @desc    Reset password with token
 * @access  Public
 */
router.post(
  '/reset-password',
  validate([{ field: 'password', required: true, minLength: 8, isPassword: true }]),
  authController.resetPassword
);

/**
 * @route   GET /api/v1/auth/me
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/me', protect, authController.getMe);

/**
 * @route   PATCH /api/v1/auth/me
 * @desc    Update current user profile
 * @access  Private
 */
router.patch(
  '/me',
  protect,
  validate([
    { field: 'name', minLength: 2, maxLength: 50 },
  ]),
  authController.updateMe
);

/**
 * @route   PATCH /api/v1/auth/change-password
 * @desc    Change password (requires current password)
 * @access  Private
 */
router.patch(
  '/change-password',
  protect,
  validate([
    { field: 'currentPassword', required: true },
    { field: 'newPassword', required: true, minLength: 8, isPassword: true },
  ]),
  authController.changePassword
);

module.exports = router;
