// src/models/payment-history.model.js
const mongoose = require('mongoose');

const paymentHistorySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    plan: {
      type: String,
      enum: ['creator', 'pro', 'agency'],
      required: true,
    },
    // Paise, actually charged (post-coupon)
    amount: {
      type: Number,
      required: true,
    },
    // Paise, list price before any coupon — lets the UI show "X% off" style detail
    originalAmount: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      default: 'INR',
    },
    couponCode: {
      type: String,
      default: null,
    },
    razorpayOrderId: {
      type: String,
      default: null,
    },
    // Unique — both the client-verify path and the webhook path can fire for the
    // same payment; this is the de-dupe key (see recordPaymentHistory in payment.service.js)
    razorpayPaymentId: {
      type: String,
      required: true,
      unique: true,
    },
  },
  { timestamps: true }
);

paymentHistorySchema.index({ user: 1, createdAt: -1 });

module.exports =
  mongoose.models.PaymentHistory || mongoose.model('PaymentHistory', paymentHistorySchema);
