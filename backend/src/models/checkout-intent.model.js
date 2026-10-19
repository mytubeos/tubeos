const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  _id: String,
  userId: { type: mongoose.Schema.Types.ObjectId, required: true },
  plan: { type: String, required: true },
  productId: { type: String, required: true },
  amount: { type: Number, required: true },
  sessionId: String,
  expiresAt: { type: Date, required: true, expires: 0 },
});
module.exports = mongoose.models.CheckoutIntent || mongoose.model('CheckoutIntent', schema);
