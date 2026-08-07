// src/routes/payment.routes.js
const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth.middleware');
const {
  createOrder,
  verifyPayment,
  validateCouponEndpoint,
  webhook,
  getPaymentHistory,
  downgradeToFree,
  createStripeCheckoutSession,
  verifyStripeSession,
  stripeWebhook,
} = require('../controllers/payment.controller');

// Webhooks — no auth, raw body captured in app.js
router.post('/webhook', webhook);
router.post('/stripe/webhook', stripeWebhook);

// Protected routes
router.post('/create-order', protect, createOrder);
router.post('/verify', protect, verifyPayment);
router.post('/validate-coupon', protect, validateCouponEndpoint);
router.get('/history', protect, getPaymentHistory);
router.post('/downgrade', protect, downgradeToFree);

// Stripe — alternate checkout, used only as a Razorpay-decline fallback
router.post('/stripe/create-checkout-session', protect, createStripeCheckoutSession);
router.post('/stripe/verify-session', protect, verifyStripeSession);

module.exports = router;
