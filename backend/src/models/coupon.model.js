// src/models/coupon.model.js
const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    // internal = developer/team use (hidden from public); public = normal users
    type: {
      type: String,
      enum: ['internal', 'public'],
      default: 'public',
    },
    discountType: {
      type: String,
      enum: ['percent', 'fixed'],
      required: true,
    },
    // percent: 1–100 | fixed: amount in rupees (₹)
    discountValue: {
      type: Number,
      required: true,
      min: 1,
    },
    validPlans: {
      type: [String],
      enum: ['creator', 'pro', 'agency'],
      default: ['creator', 'pro', 'agency'],
    },
    maxUses: {
      type: Number,
      default: null, // null = unlimited
    },
    usedCount: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    expiresAt: {
      type: Date,
      default: null, // null = never expires
    },
    description: {
      type: String,
      default: '',
      maxlength: 300,
    },
  },
  { timestamps: true }
);

couponSchema.index({ code: 1 });
couponSchema.index({ isActive: 1, type: 1 });

module.exports = mongoose.model('Coupon', couponSchema);
