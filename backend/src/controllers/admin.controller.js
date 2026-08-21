// src/controllers/admin.controller.js
// Coupon endpoints below are backed by Dodo Payments' own native Discount
// API now, not the local Coupon model — see dodo-discount.service.js.
const couponService = require('../services/dodo-discount.service');
const pricingService = require('../services/pricing.service');
const planLimitService = require('../services/plan-limit.service');
const reportSettingsService = require('../services/report-settings.service');
const { createNotification } = require('../services/notification.service');
const logger = require('../config/logger');
const User = require('../models/user.model');
const YoutubeChannel = require('../models/youtube-channel.model');
const { successResponse, errorResponse, paginatedResponse } = require('../utils/response.utils');

// ==================== USER ENDPOINTS ====================

// GET /api/v1/admin/users/stats
const getUserStats = async (req, res) => {
  try {
    const [total, free, creator, pro, agency, banned] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ plan: 'free' }),
      User.countDocuments({ plan: 'creator' }),
      User.countDocuments({ plan: 'pro' }),
      User.countDocuments({ plan: 'agency' }),
      User.countDocuments({ isBanned: true }),
    ]);
    const paid = creator + pro + agency;
    return successResponse(res, 200, 'User stats', {
      total,
      free,
      paid,
      creator,
      pro,
      agency,
      banned,
    });
  } catch (err) {
    return errorResponse(res, 500, err.message);
  }
};

// GET /api/v1/admin/users
const listUsers = async (req, res) => {
  try {
    const { page = 1, limit = 20, plan, status, search } = req.query;
    const query = {};
    if (plan && ['free', 'creator', 'pro', 'agency'].includes(plan)) query.plan = plan;
    if (status === 'banned') query.isBanned = true;
    if (status === 'active') query.isBanned = false;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [users, total] = await Promise.all([
      User.find(query)
        .select(
          'name email plan isBanned isEmailVerified createdAt subscriptionExpiresAt lastLoginAt deletedAt'
        )
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      User.countDocuments(query),
    ]);
    return paginatedResponse(res, 200, 'Users fetched', users, {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
    });
  } catch (err) {
    return errorResponse(res, 500, err.message);
  }
};

// PATCH /api/v1/admin/users/:id/plan
const changeUserPlan = async (req, res) => {
  try {
    const { plan } = req.body;
    if (!['free', 'creator', 'pro', 'agency'].includes(plan)) {
      return errorResponse(res, 400, 'Invalid plan');
    }
    const before = await User.findById(req.params.id).select('plan');
    if (!before) return errorResponse(res, 404, 'User not found');

    const now = new Date();
    const expiresAt = new Date(now);
    expiresAt.setMonth(expiresAt.getMonth() + 1);
    const user = await User.findByIdAndUpdate(
      req.params.id,
      {
        plan,
        subscriptionStartedAt: plan === 'free' ? null : now,
        subscriptionExpiresAt: plan === 'free' ? null : expiresAt,
      },
      { new: true }
    ).select('name email plan subscriptionExpiresAt');

    // Only celebrate a real grant — not a downgrade to free, not a no-op re-save.
    // Best-effort: the plan change above already succeeded, so a notification
    // hiccup shouldn't turn this into a failed request.
    if (plan !== 'free' && plan !== before.plan) {
      try {
        const label = pricingService.PLAN_LABELS[plan] || plan;
        await createNotification(
          user._id,
          'plan_activated',
          `🎉 Congratulations! Your ${label} has been activated by admin — enjoy the new features!`,
          'celebrate'
        );
      } catch (err) {
        logger.error('[admin] failed to create plan_activated notification', {
          userId: user._id.toString(),
          error: err.message,
        });
      }
    }

    return successResponse(res, 200, `Plan changed to ${plan}`, user);
  } catch (err) {
    return errorResponse(res, 500, err.message);
  }
};

// PATCH /api/v1/admin/users/:id/ban
const toggleBanUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('name email isBanned');
    if (!user) return errorResponse(res, 404, 'User not found');
    user.isBanned = !user.isBanned;
    user.bannedAt = user.isBanned ? new Date() : null;
    user.bannedReason = user.isBanned ? req.body.reason || 'Admin action' : null;
    await user.save();
    return successResponse(res, 200, user.isBanned ? 'User banned' : 'User unbanned', {
      isBanned: user.isBanned,
    });
  } catch (err) {
    return errorResponse(res, 500, err.message);
  }
};

// PATCH /api/v1/admin/users/:id/delete
// Soft-delete: marks deletedAt (cron purges the doc + disconnects their
// YouTube channels after the 90-day retention window in the Privacy Policy).
// Calling again on an already soft-deleted user restores it (clears deletedAt).
const toggleDeleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('name email deletedAt');
    if (!user) return errorResponse(res, 404, 'User not found');

    if (user.deletedAt) {
      user.deletedAt = null;
      await user.save();
      return successResponse(res, 200, 'Account deletion cancelled', { deletedAt: null });
    }

    user.deletedAt = new Date();
    await user.save();

    // Disconnect their channels now — the existing 30-day channel purge job
    // then cleans those up on its own schedule, so we don't need separate
    // cascade-delete logic here.
    await YoutubeChannel.updateMany(
      { userId: user._id, connectionStatus: { $ne: 'disconnected' } },
      { connectionStatus: 'disconnected', isActive: false }
    );

    return successResponse(res, 200, 'Account marked for deletion', {
      deletedAt: user.deletedAt,
    });
  } catch (err) {
    return errorResponse(res, 500, err.message);
  }
};

// GET /api/v1/admin/coupons/stats
const getCouponStats = async (req, res) => {
  try {
    const stats = await couponService.getStats();
    return successResponse(res, 200, 'Coupon stats', stats);
  } catch (err) {
    return errorResponse(res, err.statusCode || 500, err.message);
  }
};

// GET /api/v1/admin/coupons
const listCoupons = async (req, res) => {
  try {
    const { page = 1, limit = 20, type, status, search } = req.query;
    const result = await couponService.listCoupons({
      page: parseInt(page),
      limit: parseInt(limit),
      type,
      status,
      search,
    });
    return paginatedResponse(res, 200, 'Coupons fetched', result.coupons, {
      page: result.page,
      limit: result.limit,
      total: result.total,
    });
  } catch (err) {
    return errorResponse(res, err.statusCode || 500, err.message);
  }
};

// POST /api/v1/admin/coupons
const createCoupon = async (req, res) => {
  try {
    const coupon = await couponService.createCoupon(req.body);
    return successResponse(res, 201, 'Coupon created', coupon);
  } catch (err) {
    return errorResponse(res, err.statusCode || 500, err.message);
  }
};

// PATCH /api/v1/admin/coupons/:id
const updateCoupon = async (req, res) => {
  try {
    const coupon = await couponService.updateCoupon(req.params.id, req.body);
    return successResponse(res, 200, 'Coupon updated', coupon);
  } catch (err) {
    return errorResponse(res, err.statusCode || 500, err.message);
  }
};

// DELETE /api/v1/admin/coupons/:id
const deleteCoupon = async (req, res) => {
  try {
    await couponService.deleteCoupon(req.params.id);
    return successResponse(res, 200, 'Coupon deleted');
  } catch (err) {
    return errorResponse(res, err.statusCode || 500, err.message);
  }
};

// GET /api/v1/admin/pricing
const getPricing = async (req, res) => {
  try {
    const prices = await pricingService.getAllPrices();
    return successResponse(res, 200, 'Pricing fetched', prices);
  } catch (err) {
    return errorResponse(res, err.statusCode || 500, err.message);
  }
};

// PUT /api/v1/admin/pricing/:plan
const updatePricing = async (req, res) => {
  try {
    const result = await pricingService.setPrices(req.params.plan, req.body, req.user.id);
    return successResponse(res, 200, 'Pricing updated', result);
  } catch (err) {
    return errorResponse(res, err.statusCode || 500, err.message);
  }
};

// GET /api/v1/admin/limits
const getLimits = async (req, res) => {
  try {
    const limits = await planLimitService.getAllLimits();
    return successResponse(res, 200, 'Limits fetched', limits);
  } catch (err) {
    return errorResponse(res, err.statusCode || 500, err.message);
  }
};

// PUT /api/v1/admin/limits/:plan
const updateLimits = async (req, res) => {
  try {
    const result = await planLimitService.setLimits(req.params.plan, req.body, req.user.id);
    return successResponse(res, 200, 'Limits updated', result);
  } catch (err) {
    return errorResponse(res, err.statusCode || 500, err.message);
  }
};

// ==================== REPORT EMAIL SETTINGS ====================

// GET /api/v1/admin/report-settings
const getReportSettings = async (req, res) => {
  try {
    const settings = await reportSettingsService.getSettings();
    return successResponse(res, 200, 'Report settings fetched', settings);
  } catch (err) {
    return errorResponse(res, err.statusCode || 500, err.message);
  }
};

// PUT /api/v1/admin/report-settings
const updateReportSettings = async (req, res) => {
  try {
    const result = await reportSettingsService.updateSettings(req.body, req.user.id);
    return successResponse(res, 200, 'Report settings updated', result);
  } catch (err) {
    return errorResponse(res, err.statusCode || 500, err.message);
  }
};

module.exports = {
  getUserStats,
  listUsers,
  changeUserPlan,
  toggleBanUser,
  toggleDeleteUser,
  getCouponStats,
  listCoupons,
  createCoupon,
  updateCoupon,
  deleteCoupon,
  getPricing,
  updatePricing,
  getLimits,
  updateLimits,
  getReportSettings,
  updateReportSettings,
};
