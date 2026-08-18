// src/models/notification.model.js
// In-app Chingari notification feed.
const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: [
        'upload_reminder',
        'content_idea_nudge',
        'comment_backlog',
        'growth_win',
        'streak_milestone',
        'welcome',
        'subscription_expired',
        'plan_activated',
      ],
      required: true,
    },
    mood: {
      type: String,
      enum: [
        'idle',
        'celebrate',
        'hype',
        'curious',
        'proud',
        'playful',
        'thinking',
        'nudge',
        'sleepy',
      ],
      default: 'nudge',
    },
    message: {
      type: String,
      required: true,
      maxlength: 300,
    },
    read: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

notificationSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.models.Notification || mongoose.model('Notification', notificationSchema);
