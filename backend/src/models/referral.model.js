// src/models/referral.model.js
// Tracks per-referral earning events and payout requests.

const mongoose = require('mongoose');

// Each time a referred user pays, an earning is recorded.
const referralEarningSchema = new mongoose.Schema(
  {
    referrerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    referredUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    plan:               { type: String, required: true },
    paidAmount:         { type: Number, required: true },  // ₹ paid by referred user
    commissionRate:     { type: Number, required: true },  // % at time of earning (10/12/15/20)
    commissionAmount:   { type: Number, required: true },  // ₹ credited to wallet
    razorpayPaymentId:  { type: String, default: null },
    billingCycleIndex:  { type: Number, default: 1 },      // 1..6 (commission valid for 6 cycles)
    status: {
      type: String,
      enum: ['credited', 'reversed'],
      default: 'credited',
    },
  },
  { timestamps: true }
);

referralEarningSchema.index({ referrerId: 1, createdAt: -1 });

// Withdrawal/payout request
const payoutRequestSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    amount:        { type: Number, required: true },
    method:        { type: String, enum: ['upi', 'bank'], required: true },
    upi:           { type: String, default: null },
    bankAccount: {
      accountNumber: String,
      ifsc:          String,
      holderName:    String,
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'paid', 'rejected'],
      default: 'pending',
    },
    adminNote:     { type: String, default: null },
    paidAt:        { type: Date, default: null },
    transactionRef:{ type: String, default: null },
  },
  { timestamps: true }
);

payoutRequestSchema.index({ userId: 1, createdAt: -1 });

const ReferralEarning = mongoose.model('ReferralEarning', referralEarningSchema);
const PayoutRequest = mongoose.model('PayoutRequest', payoutRequestSchema);

module.exports = { ReferralEarning, PayoutRequest };
