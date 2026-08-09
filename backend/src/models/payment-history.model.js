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
    // Which processor this payment actually went through. Dodo is the primary
    // USD checkout; Razorpay/Stripe remain for existing INR subscribers until
    // they migrate.
    gateway: {
      type: String,
      enum: ['razorpay', 'stripe', 'dodo'],
      default: 'razorpay',
    },
    razorpayOrderId: {
      type: String,
      default: null,
    },
    // Unique — both the client-verify path and the webhook path can fire for the
    // same payment; this is the de-dupe key (see recordPaymentHistory in payment.service.js).
    // sparse so Stripe-gateway rows (which never set this) don't collide with
    // each other under the unique constraint. Deliberately NO `default: null`
    // here — Mongoose applies a `default` to every document, which would give
    // every Stripe-gateway row a literal `null` and defeat the sparse index
    // (sparse only excludes documents where the field is genuinely absent, not
    // ones explicitly set to null — caught by a real test failure, see
    // payment.service.test.js). NOTE: the existing index in prod was created
    // non-sparse before this field existed, so it needs a one-time manual
    // rebuild (drop + let autoIndex recreate) before Stripe payments can be
    // recorded more than once; see the Stripe integration notes.
    razorpayPaymentId: {
      type: String,
      unique: true,
      sparse: true,
    },
    // Same de-dupe role as razorpayPaymentId above, for the Stripe path.
    stripeSessionId: {
      type: String,
      default: null,
    },
    stripePaymentIntentId: {
      type: String,
      unique: true,
      sparse: true,
    },
    // Same de-dupe role again, for the Dodo path. No `default: null` on
    // purpose — see the razorpayPaymentId comment above, an explicit null
    // on every row would defeat `sparse` and let a second null-valued
    // document collide with the first under the unique index.
    dodoPaymentId: {
      type: String,
      unique: true,
      sparse: true,
    },
  },
  { timestamps: true }
);

paymentHistorySchema.index({ user: 1, createdAt: -1 });

module.exports =
  mongoose.models.PaymentHistory || mongoose.model('PaymentHistory', paymentHistorySchema);
