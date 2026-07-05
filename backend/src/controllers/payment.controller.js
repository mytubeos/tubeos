// src/controllers/payment.controller.js
const paymentService = require('../services/payment.service');
const { validateCoupon } = require('../services/coupon.service');
const { successResponse, errorResponse } = require('../utils/response.utils');

// POST /api/v1/payment/create-order
const createOrder = async (req, res) => {
  try {
    const { plan, couponCode } = req.body;
    if (!plan) return errorResponse(res, 400, 'Plan is required');

    const order = await paymentService.createOrder(req.user.id, plan, couponCode || null);
    return successResponse(res, 200, 'Order created', order);
  } catch (err) {
    return errorResponse(res, err.statusCode || 500, err.message);
  }
};

// POST /api/v1/payment/verify
const verifyPayment = async (req, res) => {
  try {
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature, plan, couponCode } = req.body;

    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature || !plan) {
      return errorResponse(res, 400, 'Missing payment verification fields');
    }

    const result = await paymentService.verifyPayment(req.user.id, {
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
      plan,
      couponCode: couponCode || null,
    });

    return successResponse(res, 200, 'Payment verified. Plan activated!', result);
  } catch (err) {
    return errorResponse(res, err.statusCode || 500, err.message);
  }
};

// POST /api/v1/payment/validate-coupon  (public for logged-in users)
const validateCouponEndpoint = async (req, res) => {
  try {
    const { code, plan } = req.body;
    if (!code || !plan) return errorResponse(res, 400, 'Code and plan are required');

    const result = await validateCoupon(code, plan);
    return successResponse(res, 200, 'Coupon is valid', result);
  } catch (err) {
    return errorResponse(res, err.statusCode || 400, err.message);
  }
};

// POST /api/v1/payment/webhook  (no auth — raw body needed)
const webhook = async (req, res) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    await paymentService.handleWebhook(req.rawBody, signature);
    return res.status(200).json({ received: true });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
};

module.exports = { createOrder, verifyPayment, validateCouponEndpoint, webhook };
