// src/services/payment.service.js
const Razorpay = require('razorpay');
const crypto = require('crypto');
const { config } = require('../config/env');
const User = require('../models/user.model');
const { validateCoupon, redeemCoupon } = require('./coupon.service');
const { recordEarningFromPayment } = require('./referral.service');
const logger = require('../config/logger');

const PLAN_PRICES = {
  creator: { amount: 19900, label: 'Creator Plan' },  // paise (₹199)
  pro:     { amount: 49900, label: 'Pro Plan' },       // ₹499
  agency:  { amount: 299900, label: 'Agency Plan' },   // ₹2999
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

// Create a Razorpay order — optional coupon support
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
const verifyPayment = async (userId, { razorpayOrderId, razorpayPaymentId, razorpaySignature, plan, couponCode }) => {
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
      referredUserId:   userId,
      paidAmountPaise:  PLAN_PRICES[plan].amount,
      plan,
      razorpayPaymentId,
    });
  } catch (err) {
    logger.error('[verifyPayment] referral credit failed (non-fatal)', { error: err.message });
  }

  return {
    plan: user.plan,
    subscriptionStartedAt: user.subscriptionStartedAt,
    subscriptionExpiresAt: user.subscriptionExpiresAt,
  };
};

// Handle Razorpay webhook events
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
          referredUserId:   userId,
          paidAmountPaise:  PLAN_PRICES[plan].amount,
          plan,
          razorpayPaymentId: event.payload.payment.entity.id,
        });
      } catch (err) {
        logger.error('[webhook] referral credit failed (non-fatal)', { error: err.message });
      }
    }
  }
};

module.exports = { createOrder, verifyPayment, handleWebhook };
