// src/services/coupon.service.js
const Coupon = require('../models/coupon.model');

const PLAN_PRICES_INR = { creator: 199, pro: 499, agency: 2999 };

// Validate a coupon code for a given plan (public API — never reveals type)
const validateCoupon = async (code, plan) => {
  if (!code || !plan) {
    const err = new Error('Coupon code and plan are required');
    err.statusCode = 400;
    throw err;
  }

  const coupon = await Coupon.findOne({ code: code.toUpperCase().trim() });

  if (!coupon || !coupon.isActive) {
    const err = new Error('Invalid or expired coupon code');
    err.statusCode = 400;
    throw err;
  }

  if (coupon.expiresAt && coupon.expiresAt < new Date()) {
    const err = new Error('This coupon has expired');
    err.statusCode = 400;
    throw err;
  }

  if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) {
    const err = new Error('This coupon has reached its usage limit');
    err.statusCode = 400;
    throw err;
  }

  if (!coupon.validPlans.includes(plan)) {
    const err = new Error(`This coupon is not valid for the ${plan} plan`);
    err.statusCode = 400;
    throw err;
  }

  const originalPrice = PLAN_PRICES_INR[plan];
  let discountedPrice;

  if (coupon.discountType === 'percent') {
    discountedPrice = Math.round(originalPrice * (1 - coupon.discountValue / 100));
  } else {
    discountedPrice = originalPrice - coupon.discountValue;
  }

  // Minimum ₹1
  discountedPrice = Math.max(1, discountedPrice);

  return {
    valid: true,
    originalPrice,
    discountedPrice,
    discountType: coupon.discountType,
    discountValue: coupon.discountValue,
    // Never expose coupon.type to client
  };
};

// Increment usedCount after successful payment
const redeemCoupon = async (code) => {
  await Coupon.findOneAndUpdate({ code: code.toUpperCase().trim() }, { $inc: { usedCount: 1 } });
};

// ==================== ADMIN CRUD ====================

const listCoupons = async ({ page = 1, limit = 20, type, status, search } = {}) => {
  const query = {};
  if (type && ['internal', 'public'].includes(type)) query.type = type;
  if (status === 'active') query.isActive = true;
  if (status === 'inactive') query.isActive = false;
  if (search) query.code = { $regex: search.toUpperCase(), $options: 'i' };

  const skip = (page - 1) * limit;
  const [coupons, total] = await Promise.all([
    Coupon.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Coupon.countDocuments(query),
  ]);

  return { coupons, total, page, limit };
};

const createCoupon = async (data) => {
  const {
    code,
    type,
    discountType,
    discountValue,
    validPlans,
    maxUses,
    expiresAt,
    description,
    isActive,
  } = data;

  if (!code || !discountType || !discountValue) {
    const err = new Error('Code, discountType, and discountValue are required');
    err.statusCode = 400;
    throw err;
  }

  const existing = await Coupon.findOne({ code: code.toUpperCase().trim() });
  if (existing) {
    const err = new Error('Coupon code already exists');
    err.statusCode = 400;
    throw err;
  }

  const coupon = await Coupon.create({
    code: code.toUpperCase().trim(),
    type: type || 'public',
    discountType,
    discountValue,
    validPlans: validPlans && validPlans.length ? validPlans : ['creator', 'pro', 'agency'],
    maxUses: maxUses || null,
    expiresAt: expiresAt || null,
    description: description || '',
    isActive: isActive !== undefined ? isActive : true,
  });

  return coupon;
};

const updateCoupon = async (id, data) => {
  const coupon = await Coupon.findById(id);
  if (!coupon) {
    const err = new Error('Coupon not found');
    err.statusCode = 404;
    throw err;
  }

  const allowed = [
    'type',
    'discountType',
    'discountValue',
    'validPlans',
    'maxUses',
    'expiresAt',
    'description',
    'isActive',
  ];
  allowed.forEach((key) => {
    if (data[key] !== undefined) coupon[key] = data[key];
  });

  await coupon.save();
  return coupon;
};

const deleteCoupon = async (id) => {
  const coupon = await Coupon.findByIdAndDelete(id);
  if (!coupon) {
    const err = new Error('Coupon not found');
    err.statusCode = 404;
    throw err;
  }
};

const getStats = async () => {
  const [total, active, internal, totalUses] = await Promise.all([
    Coupon.countDocuments(),
    Coupon.countDocuments({ isActive: true }),
    Coupon.countDocuments({ type: 'internal' }),
    Coupon.aggregate([{ $group: { _id: null, total: { $sum: '$usedCount' } } }]),
  ]);

  return {
    total,
    active,
    inactive: total - active,
    internal,
    public: total - internal,
    totalUses: totalUses[0]?.total || 0,
  };
};

module.exports = {
  validateCoupon,
  redeemCoupon,
  listCoupons,
  createCoupon,
  updateCoupon,
  deleteCoupon,
  getStats,
};
