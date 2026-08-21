// @ts-check
// src/services/dodo.service.js
//
// Primary checkout processor — a Merchant of Record (Dodo Payments), USD-only.
// Chosen over a direct Stripe/Razorpay account because Stripe is invite-only
// for new India-based businesses and Razorpay isn't wired for international
// cards on this merchant account; Dodo signs up from India today and also
// handles per-country sales-tax/VAT compliance on our behalf, which a direct
// gateway would leave on us. Talks to Dodo's REST API directly via axios
// rather than their SDK, since the SDK's exact method surface hasn't been
// verified against this codebase — the REST shape below is taken straight
// from docs.dodopayments.com.
//
// Mirrors stripe.service.js's shape (webhook is the authoritative activation
// path; PaymentHistory dedupe by gateway-specific payment id) but does NOT
// offer a client-verified fast path the way Stripe's verifySession does —
// Dodo doesn't publish a "retrieve checkout/payment by id" endpoint, and the
// query params Dodo appends to return_url (payment_id/status) are
// browser-controlled and NOT safe to trust for activation (anyone could hand-
// craft a "?status=succeeded" URL without ever paying). The frontend instead
// polls the user's own profile after redirect until the webhook-driven
// activation shows up — see useDodoCheckout.js.

const axios = require('axios');
const { Webhook } = require('standardwebhooks');
const { config } = require('../config/env');
// Cast to any: mongoose v8 Model<any> union overloads cause TS2349 in @ts-check JS files.
const User = /** @type {any} */ (require('../models/user.model'));
const PaymentHistory = /** @type {any} */ (require('../models/payment-history.model'));
const { validateCoupon, redeemCoupon } = require('./coupon.service');
const pricingService = require('./pricing.service');
const { PLAN_LABELS } = pricingService;
const logger = require('../config/logger');

/** @typedef {'creator' | 'pro' | 'agency'} PlanName */

const DODO_BASE_URL = {
  live: 'https://live.dodopayments.com',
  test: 'https://test.dodopayments.com',
};

const getDodoClient = () => {
  if (!config.dodo.apiKey) return null;
  return axios.create({
    baseURL: DODO_BASE_URL[config.dodo.mode],
    headers: {
      Authorization: `Bearer ${config.dodo.apiKey}`,
      'Content-Type': 'application/json',
    },
    timeout: 15000,
  });
};

const notConfiguredError = () => {
  const err = new Error('Payments aren’t set up yet — please try again shortly.');
  err.statusCode = 503;
  return err;
};

// Create a Dodo checkout session — always USD, admin-editable price. Coupons
// mirror stripe.service.js's non-INR handling exactly: only percent discounts
// apply (a fixed-rupee discountedPrice from a coupon has no meaning against a
// USD amount), fixed coupons are silently skipped and the list price stands.
/**
 * @param {string} userId
 * @param {PlanName} plan
 * @param {string|null} [couponCode]
 * @returns {Promise<{sessionId: string, url: string}>}
 */
const createCheckoutSession = async (userId, plan, couponCode = null) => {
  const client = getDodoClient();
  if (!client) throw notConfiguredError();

  if (!pricingService.PLANS.includes(plan)) {
    const err = new Error('Invalid plan selected');
    err.statusCode = 400;
    throw err;
  }

  const productId = config.dodo.productIds[plan];
  if (!productId) {
    logger.error('[dodo] no product_id configured for plan', { plan });
    throw notConfiguredError();
  }

  const user = await User.findById(userId);
  if (!user) {
    const err = new Error('User not found');
    err.statusCode = 404;
    throw err;
  }

  const { amount: listAmount } = await pricingService.getPrice(plan, 'USD');
  let finalAmount = listAmount;
  let couponApplied = null;

  if (couponCode) {
    const couponResult = await validateCoupon(couponCode, plan);
    if (couponResult.discountType === 'percent') {
      finalAmount = Math.max(1, Math.round(listAmount * (1 - couponResult.discountValue / 100)));
    }
    couponApplied = couponCode.toUpperCase().trim();
  }

  const label = PLAN_LABELS[plan];
  const clientUrl = config.cors.clientUrl;

  const { data } = await client
    .post('/checkouts', {
      product_cart: [{ product_id: productId, quantity: 1, amount: finalAmount }],
      customer: { email: user.email, name: user.name || undefined },
      metadata: {
        userId: userId.toString(),
        plan,
        couponCode: couponApplied || '',
      },
      return_url: `${clientUrl}/pricing?dodo_return=1`,
    })
    .catch((err) => {
      logger.error('[dodo] checkout session creation failed', {
        error: err.response?.data || err.message,
      });
      const wrapped = new Error('Could not start checkout — please try again.');
      wrapped.statusCode = 502;
      throw wrapped;
    });

  if (!data.checkout_url) {
    logger.error('[dodo] checkout response missing checkout_url', { data });
    throw notConfiguredError();
  }

  // label kept for parity with stripe.service.js's request shape/comments —
  // Dodo's product name itself is set in their dashboard, not passed here.
  void label;

  return { sessionId: data.session_id, url: data.checkout_url };
};

// Shared by the webhook handler — activates the plan from a Dodo payment
// event's metadata (the same {userId, plan, couponCode} bag set at checkout
// creation above).
/**
 * @param {any} payload
 * @param {string} paymentId
 */
const activatePlanFromPayload = async (payload, paymentId) => {
  const { userId, plan, couponCode } = payload.metadata || {};
  if (!userId || !plan || !pricingService.PLANS.includes(plan)) {
    logger.warn('[dodo] webhook payload missing/invalid metadata, skipping activation', {
      paymentId,
    });
    return null;
  }

  const { amount: listAmount } = await pricingService.getPrice(plan, 'USD');

  if (couponCode) {
    try {
      await redeemCoupon(couponCode);
    } catch (err) {
      logger.warn('[dodo] coupon redeem failed (non-fatal, may already be redeemed)', {
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

  // Referral commissions are wallet-credited in rupees with no exchange-rate
  // source here — same deliberate scope cut as stripe.service.js's non-INR
  // path. Skip, don't fail, the rest of activation over this.
  try {
    await PaymentHistory.create({
      user: userId,
      plan,
      amount: payload.total_amount ?? listAmount,
      originalAmount: listAmount,
      currency: 'USD',
      couponCode: couponCode || null,
      gateway: 'dodo',
      dodoPaymentId: paymentId,
    });
  } catch (err) {
    if (err.code !== 11000) {
      logger.error('[dodo] recordPaymentHistory failed (non-fatal)', { error: err.message });
    }
  }

  return {
    plan: user.plan,
    subscriptionStartedAt: user.subscriptionStartedAt,
    subscriptionExpiresAt: user.subscriptionExpiresAt,
  };
};

// Verify + handle a Dodo webhook. Follows the Standard Webhooks spec (same
// library Dodo's own docs point to) — signed with webhook-id/webhook-
// signature/webhook-timestamp headers over the raw JSON body.
/**
 * @param {string} rawBody
 * @param {{[key: string]: string | string[] | undefined}} headers
 * @returns {Promise<void>}
 */
const handleWebhook = async (rawBody, headers) => {
  if (!config.dodo.apiKey || !config.dodo.webhookSecret) return;

  const webhook = new Webhook(config.dodo.webhookSecret);
  const webhookHeaders = {
    'webhook-id': /** @type {string} */ (headers['webhook-id']),
    'webhook-signature': /** @type {string} */ (headers['webhook-signature']),
    'webhook-timestamp': /** @type {string} */ (headers['webhook-timestamp']),
  };

  let event;
  try {
    event = /** @type {any} */ (webhook.verify(rawBody, webhookHeaders));
  } catch (err) {
    const wrapped = new Error(`Invalid webhook signature: ${err.message}`);
    wrapped.statusCode = 400;
    throw wrapped;
  }

  if (event.type === 'payment.succeeded') {
    const payload = event.data;
    await activatePlanFromPayload(payload, payload.payment_id);
  }
};

module.exports = {
  createCheckoutSession,
  handleWebhook,
  // Exported purely for testability — takes a plain webhook-data shape, no
  // real Dodo API call involved.
  activatePlanFromPayload,
};
