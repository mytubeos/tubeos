const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  _id: String,
  expiresAt: { type: Date, required: true, expires: 0 },
});
module.exports = mongoose.models.RevokedSession || mongoose.model('RevokedSession', schema);
