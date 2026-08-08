// src/models/plan-price.model.js
const mongoose = require('mongoose');

const planPriceSchema = new mongoose.Schema(
  {
    plan: {
      type: String,
      enum: ['creator', 'pro', 'agency'],
      required: true,
    },
    currency: {
      type: String,
      enum: ['INR', 'EUR', 'USD'],
      required: true,
    },
    // Smallest currency unit (paise for INR, cents for EUR/USD) — the
    // currently-active price a checkout actually charges.
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    // Same unit, optional — the "regular" price shown struck through once a
    // founders-offer-style discount ends. Null if there's no such note.
    regularAmount: {
      type: Number,
      default: null,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true }
);

planPriceSchema.index({ plan: 1, currency: 1 }, { unique: true });

module.exports = mongoose.models.PlanPrice || mongoose.model('PlanPrice', planPriceSchema);
