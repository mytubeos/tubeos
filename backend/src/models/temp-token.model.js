// src/models/temp-token.model.js
// Short-lived key/value store for OTP codes and password-reset tokens --
// backed by Mongo's own TTL index instead of Redis, so this doesn't depend
// on an external cache service's own uptime or usage quota.

const mongoose = require('mongoose');

const tempTokenSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true,
  },
  value: {
    type: String,
    required: true,
  },
  expiresAt: {
    type: Date,
    required: true,
  },
});

// MongoDB's TTL monitor sweeps expired documents in the background (roughly
// every 60s, not instant) -- callers still check expiresAt on read (see
// auth.service.js's getTempToken) to close that window rather than trusting
// the sweep alone.
tempTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const TempToken = mongoose.models.TempToken || mongoose.model('TempToken', tempTokenSchema);

module.exports = TempToken;
