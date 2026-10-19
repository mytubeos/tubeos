const mongoose = require('mongoose');
const purchaseSchema = new mongoose.Schema(
  {
    _id: String, // SHA-256 of Google's globally unique purchase token.
    userId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    encryptedToken: { type: String, required: true, select: false },
    productId: String,
    state: String,
    expiresAt: Date,
    autoRenewing: Boolean,
    orderId: String,
    superseded: { type: Boolean, default: false },
    checkedAt: Date,
  },
  { timestamps: true }
);
const accountSchema = new mongoose.Schema({
  _id: mongoose.Schema.Types.ObjectId,
  currentTokenHash: String,
  lockId: String,
  lockUntil: Date,
});
module.exports = {
  PlayPurchase: mongoose.models.PlayPurchase || mongoose.model('PlayPurchase', purchaseSchema),
  PlayBillingAccount:
    mongoose.models.PlayBillingAccount || mongoose.model('PlayBillingAccount', accountSchema),
};
