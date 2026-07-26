// @ts-check
// src/services/payment.service.js

/** @typedef {'creator' | 'pro' | 'agency'} PlanName */

// Cast to any: mongoose v8 Model<any> union overloads cause TS2349 in @ts-check JS files.
const Razorpay = /** @type {any} */ (require('razorpay'));
const crypto = require('crypto');
const { config } = require('../config/env');
const User = /** @type {any} */ (require('../models/user.model'));
const PaymentHistory = /** @type {any} */ (require('../models/payment-history.model'));
const { validateCoupon, redeemCoupon } = require('./coupon.service');
const { recordEarningFromPayment } = require('./referral.service');
const logger = require('../config/logger');

const PLAN_PRICES = {
  creator: { amount: 19900, label: 'Creator Plan' }, // paise (₹199)
  pro: { amount: 49900, label: 'Pro Plan' }, // ₹499
  agency: { amount: 299900, label: 'Agency Plan' }, // ₹2999
};

const getRazorpayInstance = () => {
  if (!config.razorpay.keyId || !config.razorpay.keySecret) {
    throw new Error('Razorpay credentials not configured');
  }
  return new Razorpay({
    key_id: config.razorpay.keyId,
    key_secret: config.razorpay.keySecret,
  });
};

// Best-effort payment-history insert. Non-fatal by design — the plan is already
// active by the time this runs, so a history-write failure shouldn't undo that.
// razorpayPaymentId has a unique index, so if both the client-verify path and the
// webhook fire for the same payment, the second insert just hits a duplicate-key
// error (11000) here and is silently ignored.
/**
 * @param {{userId: string, plan: PlanName, amount: number, originalAmount: number, couponCode?: string|null, razorpayOrderId?: string|null, razorpayPaymentId: string}} params
 */
const recordPaymentHistory = async ({
  userId,
  plan,
  amount,
  originalAmount,
  couponCode,
  razorpayOrderId,
  razorpayPaymentId,
}) => {
  try {
    await PaymentHistory.create({
      user: userId,
      plan,
      amount,
      originalAmount,
      couponCode: couponCode || null,
      razorpayOrderId: razorpayOrderId || null,
      razorpayPaymentId,
    });
  } catch (err) {
    if (err.code !== 11000) {
      logger.error('[recordPaymentHistory] failed (non-fatal)', { error: err.message });
    }
  }
};

// Create a Razorpay order — optional coupon support
/**
 * @param {string} userId
 * @param {PlanName} plan
 * @param {string|null} [couponCode]
 * @returns {Promise<{orderId: string, amount: number, currency: string, plan: PlanName, label: string, keyId: string, userName: string, userEmail: string, couponApplied: string|null, originalAmount: number}>}
 */
const createOrder = async (userId, plan, couponCode = null) => {
  if (!PLAN_PRICES[plan]) {
    const err = new Error('Invalid plan selected');
    err.statusCode = 400;
    throw err;
  }

  const user = await User.findById(userId);
  if (!user) {
    const err = new Error('User not found');
    err.statusCode = 404;
    throw err;
  }

  let finalAmountPaise = PLAN_PRICES[plan].amount;
  let couponApplied = null;

  if (couponCode) {
    const couponResult = await validateCoupon(couponCode, plan);
    // discountedPrice is in rupees → convert to paise, minimum 100 paise (₹1)
    finalAmountPaise = Math.max(100, couponResult.discountedPrice * 100);
    couponApplied = couponCode.toUpperCase().trim();
  }

  const razorpay = getRazorpayInstance();
  const { label } = PLAN_PRICES[plan];

  const order = await razorpay.orders.create({
    amount: finalAmountPaise,
    currency: 'INR',
    receipt: `rzp_${Date.now()}`,
    notes: {
      userId: userId.toString(),
      plan,
      userEmail: user.email,
      couponCode: couponApplied || '',
    },
  });

  return {
    orderId: order.id,
    amount: order.amount,
    currency: order.currency,
    plan,
    label,
    keyId: config.razorpay.keyId,
    userName: user.name,
    userEmail: user.email,
    couponApplied,
    originalAmount: PLAN_PRICES[plan].amount,
  };
};

// Verify payment signature and activate plan
/**
 * @param {string} userId
 * @param {{ razorpayOrderId: string, razorpayPaymentId: string, razorpaySignature: string, plan: PlanName, couponCode?: string }} params
 * @returns {Promise<{plan: PlanName, subscriptionStartedAt: Date, subscriptionExpiresAt: Date}>}
 */
const verifyPayment = async (
  userId,
  { razorpayOrderId, razorpayPaymentId, razorpaySignature, plan, couponCode }
) => {
  const body = `${razorpayOrderId}|${razorpayPaymentId}`;
  const expectedSignature = crypto
    .createHmac('sha256', config.razorpay.keySecret)
    .update(body)
    .digest('hex');

  if (expectedSignature !== razorpaySignature) {
    const err = new Error('Payment verification failed — invalid signature');
    err.statusCode = 400;
    throw err;
  }

  if (!PLAN_PRICES[plan]) {
    const err = new Error('Invalid plan');
    err.statusCode = 400;
    throw err;
  }

  // Recompute the discounted amount for the history record BEFORE redeeming the
  // coupon below — redeeming first would bump usedCount and could make an
  // at-the-cap coupon look invalid on this re-check. Falls back to list price if
  // the coupon can't be re-validated for any reason (history is best-effort; the
  // plan activation below doesn't depend on this).
  let chargedAmountPaise = PLAN_PRICES[plan].amount;
  if (couponCode) {
    try {
      const couponResult = await validateCoupon(couponCode, plan);
      chargedAmountPaise = Math.max(100, couponResult.discountedPrice * 100);
    } catch (err) {
      logger.warn('[verifyPayment] could not recompute coupon discount for history record', {
        error: err.message,
      });
    }
  }

  // Redeem coupon if used
  if (couponCode) {
    await redeemCoupon(couponCode);
  }

  const now = new Date();
  const expiresAt = new Date(now);
  expiresAt.setMonth(expiresAt.getMonth() + 1);

  const user = await User.findByIdAndUpdate(
    userId,
    {
      plan,
      subscriptionStartedAt: now,
      subscriptionExpiresAt: expiresAt,
      razorpaySubscriptionId: razorpayPaymentId,
    },
    { new: true }
  );

  // Credit referrer (if user was referred). Non-fatal if it fails.
  try {
    await recordEarningFromPayment({
      referredUserId: userId,
      paidAmountPaise: PLAN_PRICES[plan].amount,
      plan,
      razorpayPaymentId,
    });
  } catch (err) {
    logger.error('[verifyPayment] referral credit failed (non-fatal)', { error: err.message });
  }

  await recordPaymentHistory({
    userId,
    plan,
    amount: chargedAmountPaise,
    originalAmount: PLAN_PRICES[plan].amount,
    couponCode,
    razorpayOrderId,
    razorpayPaymentId,
  });

  return {
    plan: user.plan,
    subscriptionStartedAt: user.subscriptionStartedAt,
    subscriptionExpiresAt: user.subscriptionExpiresAt,
  };
};

// Handle Razorpay webhook events
/**
 * @param {string} rawBody
 * @param {string} signature
 * @returns {Promise<void>}
 */
const handleWebhook = async (rawBody, signature) => {
  if (!config.razorpay.webhookSecret) return;

  const expectedSignature = crypto
    .createHmac('sha256', config.razorpay.webhookSecret)
    .update(rawBody)
    .digest('hex');

  if (expectedSignature !== signature) {
    const err = new Error('Invalid webhook signature');
    err.statusCode = 400;
    throw err;
  }

  const event = JSON.parse(rawBody);

  if (event.event === 'payment.captured') {
    const notes = event.payload.payment.entity.notes || {};
    const { userId, plan, couponCode } = notes;
    if (userId && plan && PLAN_PRICES[plan]) {
      if (couponCode) await redeemCoupon(couponCode);
      const now = new Date();
      const expiresAt = new Date(now);
      expiresAt.setMonth(expiresAt.getMonth() + 1);
      await User.findByIdAndUpdate(userId, {
        plan,
        subscriptionStartedAt: now,
        subscriptionExpiresAt: expiresAt,
        razorpaySubscriptionId: event.payload.payment.entity.id,
      });

      try {
        await recordEarningFromPayment({
          referredUserId: userId,
          paidAmountPaise: PLAN_PRICES[plan].amount,
          plan,
          razorpayPaymentId: event.payload.payment.entity.id,
        });
      } catch (err) {
        logger.error('[webhook] referral credit failed (non-fatal)', { error: err.message });
      }

      // Webhook payload carries the real captured amount directly — no recompute needed.
      await recordPaymentHistory({
        userId,
        plan,
        amount: event.payload.payment.entity.amount,
        originalAmount: PLAN_PRICES[plan].amount,
        couponCode,
        razorpayOrderId: event.payload.payment.entity.order_id,
        razorpayPaymentId: event.payload.payment.entity.id,
      });
    }
  }
};

// Paginated payment history for the current user, newest first
/**
 * @param {string} userId
 * @param {{page?: number, limit?: number}} [opts]
 */
const getPaymentHistory = async (userId, { page = 1, limit = 20 } = {}) => {
  const skip = (page - 1) * limit;
  const [history, total] = await Promise.all([
    PaymentHistory.find({ user: userId }).sort({ createdAt: -1 }).skip(skip).limit(limit),
    PaymentHistory.countDocuments({ user: userId }),
  ]);
  return { history, total, page, limit };
};

// Switch to Free immediately. There's no real recurring Razorpay subscription to
// cancel here (billing is a manual monthly top-up, not auto-charge) — this just
// ends the current paid plan early rather than waiting for subscriptionExpiresAt.
/**
 * @param {string} userId
 */
const downgradeToFree = async (userId) => {
  const user = await User.findByIdAndUpdate(
    userId,
    { plan: 'free', subscriptionExpiresAt: null },
    { new: true }
  );
  if (!user) {
    const err = new Error('User not found');
    err.statusCode = 404;
    throw err;
  }
  return { plan: user.plan };
};

module.exports = {
  createOrder,
  verifyPayment,
  handleWebhook,
  getPaymentHistory,
  downgradeToFree,
};
