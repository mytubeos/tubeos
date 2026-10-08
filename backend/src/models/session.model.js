const mongoose = require('mongoose');
const schema = new mongoose.Schema(
  {
    _id: String,
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    version: { type: Number, required: true },
    device: { type: String, maxlength: 200 },
    lastSeenAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true, expires: 0 },
  },
  { timestamps: true }
);
module.exports = mongoose.models.Session || mongoose.model('Session', schema);
