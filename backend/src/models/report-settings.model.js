// src/models/report-settings.model.js
const mongoose = require('mongoose');

// Singleton document (one row for the whole app, keyed by `key: 'default'`).
// Day/hour/minute fields are all IST (India Standard Time, fixed UTC+5:30
// offset, no DST) — that's what the admin panel shows and edits. The actual
// UTC cron pattern is derived from these in report-settings.service.js, not
// stored separately, so there's never a second copy to drift out of sync.
const reportSettingsSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'default', unique: true },

    // Default 13:30 IST Monday == 08:00 UTC Monday, matching the schedule
    // this replaces (jobs/index.js's old hardcoded '0 8 * * 1').
    weeklyDayOfWeek: { type: Number, min: 0, max: 6, default: 1 }, // 0=Sun..6=Sat
    weeklyHour: { type: Number, min: 0, max: 23, default: 13 },
    weeklyMinute: { type: Number, min: 0, max: 59, default: 30 },

    // Default 14:30 IST on the 1st == 09:00 UTC on the 1st, matching the
    // old hardcoded '0 9 1 * *'.
    monthlyDayOfMonth: { type: Number, min: 1, max: 28, default: 1 },
    monthlyHour: { type: Number, min: 0, max: 23, default: 14 },
    monthlyMinute: { type: Number, min: 0, max: 59, default: 30 },

    senderEmail: { type: String, default: 'hello@vezrin.com', trim: true },
    senderName: { type: String, default: 'Vezrin Reports', trim: true },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.ReportSettings || mongoose.model('ReportSettings', reportSettingsSchema);
