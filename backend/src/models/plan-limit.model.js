// src/models/plan-limit.model.js
const mongoose = require('mongoose');

// null = unlimited. Infinity isn't JSON-safe (JSON.stringify(Infinity) is
// "null" already) so this makes that explicit instead of accidental — see
// plan-limit.service.js for where it's converted back for the usage-check
// logic that actually consumes these numbers.
const planLimitSchema = new mongoose.Schema(
  {
    plan: {
      type: String,
      enum: ['free', 'creator', 'pro', 'agency'],
      required: true,
      unique: true,
    },
    uploads: { type: Number, default: null, min: 0 },
    aiReplies: { type: Number, default: null, min: 0 },
    aiContent: { type: Number, default: null, min: 0 },
    bulkReplies: { type: Number, default: null, min: 0 },
    thumbnailGen: { type: Number, default: null, min: 0 },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.models.PlanLimit || mongoose.model('PlanLimit', planLimitSchema);
