// src/routes/payment.routes.js
const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth.middleware');
const { createOrder, verifyPayment, validateCouponEndpoint, webhook } = require('../controllers/payment.controller');

// Webhook — no auth, raw body captured in app.js
router.post('/webhook', webhook);

// Protected routes
router.post('/create-order',      protect, createOrder);
router.post('/verify',            protect, verifyPayment);
router.post('/validate-coupon',   protect, validateCouponEndpoint);

module.exports = router;
