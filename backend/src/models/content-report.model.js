const mongoose = require('mongoose');
const schema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    source: { type: String, required: true, maxlength: 200 },
    reason: {
      type: String,
      enum: ['unsafe', 'hate_harassment', 'sexual_content', 'child_safety', 'misleading', 'other'],
      required: true,
    },
    excerpt: { type: String, maxlength: 10000, default: '' },
    details: { type: String, maxlength: 2000, default: '' },
    status: { type: String, enum: ['open', 'reviewed'], default: 'open', index: true },
  },
  { timestamps: true }
);
schema.index({ createdAt: 1 }, { expireAfterSeconds: 180 * 24 * 60 * 60 });
module.exports = mongoose.models.ContentReport || mongoose.model('ContentReport', schema);
