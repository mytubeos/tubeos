// @ts-check
// src/services/stripe.service.js
//
// Alternate checkout processor. For INR it's a fallback when a user's card
// doesn't work on Razorpay (limited/unreliable international-card support);
// for EUR/USD it's the only processor, since Razorpay isn't wired for those
// currencies on this merchant account. Prices come from pricing.service.js
// (admin-editable). Mirrors payment.service.js's shape (same activation
// fields on User) but is otherwise independent — see the note in
// payment-history.model.js for why the two gateways don't share activation
// code.

// Cast to any: mongoose v8 Model<any> union overloads cause TS2349 in @ts-check JS files.
const Stripe = /** @type {any} */ (require('stripe'));
const { config } = require('../config/env');
const User = /** @type {any} */ (require('../models/user.model'));
const PaymentHistory = /** @type {any} */ (require('../models/payment-history.model'));
const { validateCoupon, redeemCoupon } = require('./coupon.service');
const { recordEarningFromPayment } = require('./referral.service');
const pricingService = require('./pricing.service');
const { PLAN_LABELS } = pricingService;
const logger = require('../config/logger');

/** @typedef {'creator' | 'pro' | 'agency'} PlanName */
/** @typedef {'INR' | 'EUR' | 'USD'} Currency */

const getStripeInstance = () => {
  if (!config.stripe.secretKey) return null;
  return new Stripe(config.stripe.secretKey);
};

// Create a Stripe Checkout Session — optional coupon support.
// Coupons are INR-priced (coupon.service.js's validateCoupon always prices
// against the INR row), so a coupon on a EUR/USD checkout only makes sense
// as a percentage discount — applying a fixed-rupee discountedPrice to a
// EUR/USD amount would be meaningless. Percent discounts apply the same
// percentage to whatever currency's list price this session actually uses.
/**
 * @param {string} userId
 * @param {PlanName} plan
 * @param {Currency} currency
 * @param {string|null} [couponCode]
 * @returns {Promise<{sessionId: string, url: string}>}
 */
const createCheckoutSession = async (userId, plan, currency = 'INR', couponCode = null) => {
  const stripe = getStripeInstance();
  if (!stripe) {
    const err = new Error(
      'Alternate checkout isn’t set up yet — please use the regular Upgrade button.'
    );
    err.statusCode = 503;
    throw err;
  }

  if (!pricingService.PLANS.includes(plan)) {
    const err = new Error('Invalid plan selected');
    err.statusCode = 400;
    throw err;
  }
  if (!pricingService.CURRENCIES.includes(currency)) {
    const err = new Error('Invalid currency');
    err.statusCode = 400;
    throw err;
  }

  const user = await User.findById(userId);
  if (!user) {
    const err = new Error('User not found');
    err.statusCode = 404;
    throw err;
  }

  const { amount: listAmount } = await pricingService.getPrice(plan, currency);
  let finalAmount = listAmount;
  let couponApplied = null;

  if (couponCode) {
    const couponResult = await validateCoupon(couponCode, plan);
    if (currency === 'INR') {
      finalAmount = Math.max(100, couponResult.discountedPrice * 100);
    } else if (couponResult.discountType === 'percent') {
      finalAmount = Math.max(1, Math.round(listAmount * (1 - couponResult.discountValue / 100)));
    }
    // Fixed-amount coupons on non-INR checkouts: skip the discount rather
    // than apply a rupee figure to a different currency — list price stands.
    couponApplied = couponCode.toUpperCase().trim();
  }

  const label = PLAN_LABELS[plan];
  const clientUrl = config.cors.clientUrl;

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    customer_email: user.email,
    line_items: [
      {
        price_data: {
          currency: currency.toLowerCase(),
          product_data: { name: `Vezrin ${label}` },
          unit_amount: finalAmount,
        },
        quantity: 1,
      },
    ],
    metadata: {
      userId: userId.toString(),
      plan,
      couponCode: couponApplied || '',
    },
    success_url: `${clientUrl}/pricing?stripe_session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${clientUrl}/pricing?stripe_cancelled=1`,
  });

  return { sessionId: session.id, url: session.url };
};

// Shared by both confirmation paths below (client-side verify right after
// checkout, and the async webhook) — same dual-path/de-dupe shape as
// payment.service.js's verifyPayment + handleWebhook, just against Stripe's
// Checkout Session object instead of a Razorpay order/payment pair.
/**
 * @param {any} session
 */
const activatePlanFromSession = async (session) => {
  const { userId, plan, couponCode } = session.metadata || {};
  if (!userId || !plan || !pricingService.PLANS.includes(plan)) return null;

  const currency = (session.currency || 'inr').toUpperCase();
  const { amount: listAmount } = await pricingService.getPrice(plan, currency);

  if (couponCode) {
    try {
      await redeemCoupon(couponCode);
    } catch (err) {
      logger.warn('[stripe] coupon redeem failed (non-fatal, may already be redeemed)', {
        error: err.message,
      });
    }
  }

  const now = new Date();
  const expiresAt = new Date(now);
  expiresAt.setMonth(expiresAt.getMonth() + 1);

  const user = await User.findByIdAndUpdate(
    userId,
    { plan, subscriptionStartedAt: now, subscriptionExpiresAt: expiresAt },
    { new: true }
  );

  // Referral commissions are wallet-credited in rupees (recordEarningFromPayment's
  // paidAmountPaise param assumes paise) — the referral system was never built
  // multi-currency-aware, and there's no exchange-rate source here to convert a
  // EUR/USD amount correctly. Rather than credit a wrong number, only credit for
  // INR payments; skip (not fail) the rest.
  if (currency === 'INR') {
    try {
      await recordEarningFromPayment({
        referredUserId: userId,
        paidAmountPaise: listAmount,
        plan,
        razorpayPaymentId: session.payment_intent,
      });
    } catch (err) {
      logger.error('[stripe] referral credit failed (non-fatal)', { error: err.message });
    }
  }

  try {
    await PaymentHistory.create({
      user: userId,
      plan,
      amount: session.amount_total,
      originalAmount: listAmount,
      currency,
      couponCode: couponCode || null,
      gateway: 'stripe',
      stripeSessionId: session.id,
      stripePaymentIntentId: session.payment_intent,
    });
  } catch (err) {
    if (err.code !== 11000) {
      logger.error('[stripe] recordPaymentHistory failed (non-fatal)', { error: err.message });
    }
  }

  return {
    plan: user.plan,
    subscriptionStartedAt: user.subscriptionStartedAt,
    subscriptionExpiresAt: user.subscriptionExpiresAt,
  };
};

// Client-confirmed path — called right after Stripe redirects the user back
// to the success_url. Fast feedback; the webhook below is the authoritative
// fallback if the user closes the tab before this fires.
/**
 * @param {string} userId
 * @param {string} sessionId
 */
const verifySession = async (userId, sessionId) => {
  const stripe = getStripeInstance();
  if (!stripe) {
    const err = new Error('Alternate checkout isn’t set up yet.');
    err.statusCode = 503;
    throw err;
  }

  const session = await stripe.checkout.sessions.retrieve(sessionId);

  if (session.metadata?.userId !== userId.toString()) {
    const err = new Error('This checkout session does not belong to you');
    err.statusCode = 403;
    throw err;
  }

  if (session.payment_status !== 'paid') {
    const err = new Error('Payment not completed yet');
    err.statusCode = 400;
    throw err;
  }

  return activatePlanFromSession(session);
};

// Handle Stripe webhook events — authoritative fallback if verifySession never
// fires (tab closed, network drop). No-ops if not configured, same shape as
// payment.service.js's Razorpay webhook.
/**
 * @param {string} rawBody
 * @param {string} signature
 * @returns {Promise<void>}
 */
const handleWebhook = async (rawBody, signature) => {
  const stripe = getStripeInstance();
  if (!stripe || !config.stripe.webhookSecret) return;

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, config.stripe.webhookSecret);
  } catch (err) {
    const wrapped = new Error(`Invalid webhook signature: ${err.message}`);
    wrapped.statusCode = 400;
    throw wrapped;
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    if (session.payment_status === 'paid') {
      await activatePlanFromSession(session);
    }
  }
};

module.exports = {
  createCheckoutSession,
  verifySession,
  handleWebhook,
  // Exported purely for testability — takes a plain Checkout Session shape,
  // no real Stripe SDK call involved, so tests can exercise the actual
  // activation logic without needing to mock the SDK boundary.
  activatePlanFromSession,
};
