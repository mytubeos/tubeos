// src/controllers/admin.controller.js
const couponService = require('../services/coupon.service');
const { successResponse, errorResponse, paginatedResponse } = require('../utils/response.utils');

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
      type, status, search,
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

module.exports = { getCouponStats, listCoupons, createCoupon, updateCoupon, deleteCoupon };
