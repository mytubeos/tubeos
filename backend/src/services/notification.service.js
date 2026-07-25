// src/services/notification.service.js
// Chingari notification feed + activity-streak tracking.
const Notification = require('../models/notification.model');
const User = require('../models/user.model');

const STREAK_MILESTONES = [3, 7, 14, 30];

// ==================== GET NOTIFICATIONS ====================
const getNotifications = async (userId, { page = 1, limit = 20 } = {}) => {
  const pageNum = parseInt(page) || 1;
  const limitNum = parseInt(limit) || 20;
  const skip = (pageNum - 1) * limitNum;

  const [notifications, total, unreadCount] = await Promise.all([
    Notification.find({ userId }).sort({ createdAt: -1 }).skip(skip).limit(limitNum).lean(),
    Notification.countDocuments({ userId }),
    Notification.countDocuments({ userId, read: false }),
  ]);

  return {
    notifications,
    unreadCount,
    pagination: { page: pageNum, limit: limitNum, total },
  };
};

// ==================== MARK AS READ ====================
const markAsRead = async (userId, notificationId) => {
  const notification = await Notification.findOneAndUpdate(
    { _id: notificationId, userId },
    { read: true },
    { new: true }
  );
  if (!notification) {
    const err = new Error('Notification not found');
    err.statusCode = 404;
    throw err;
  }
  return notification;
};

const markAllRead = async (userId) => {
  await Notification.updateMany({ userId, read: false }, { read: true });
  return { message: 'All notifications marked read' };
};

// ==================== CREATE NOTIFICATION (internal) ====================
// Called by the rules engine (jobs/cron.js) and by touchActivity below.
// Enforces the mute preference + daily cap here so every caller gets the
// guardrail for free instead of re-checking it themselves.
const createNotification = async (userId, type, message, mood = 'nudge') => {
  const user = await User.findById(userId).select('preferences');
  if (!user) return null;
  if (user.preferences?.chingariEnabled === false) return null;

  const maxPerDay = user.preferences?.maxNudgesPerDay ?? 2;
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);

  const todayCount = await Notification.countDocuments({
    userId,
    createdAt: { $gte: startOfDay },
  });
  if (todayCount >= maxPerDay) return null;

  return Notification.create({ userId, type, message, mood });
};

// ==================== ACTIVITY STREAK ====================
// Called from a small, deliberate set of "the user did something real" call
// sites (video upload success, comment reply posted) — see video.service.js
// and ai-comment.service.js. No-ops if already touched today; increments if
// the gap since lastActiveDate is exactly 1 day; resets to 1 otherwise
// (including the very first call for a user).
const touchActivity = async (userId) => {
  const user = await User.findById(userId).select('gamification');
  if (!user) return null;

  const now = new Date();
  const todayUTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const last = user.gamification?.lastActiveDate
    ? new Date(user.gamification.lastActiveDate)
    : null;
  const lastUTC = last
    ? Date.UTC(last.getUTCFullYear(), last.getUTCMonth(), last.getUTCDate())
    : null;

  if (lastUTC === todayUTC) return user.gamification?.currentStreak || 0;

  const oneDayMs = 24 * 60 * 60 * 1000;
  const isConsecutive = lastUTC !== null && todayUTC - lastUTC === oneDayMs;
  const newStreak = isConsecutive ? (user.gamification?.currentStreak || 0) + 1 : 1;
  const longest = Math.max(newStreak, user.gamification?.longestStreak || 0);

  await User.findByIdAndUpdate(userId, {
    $set: {
      'gamification.currentStreak': newStreak,
      'gamification.longestStreak': longest,
      'gamification.lastActiveDate': now,
    },
  });

  if (STREAK_MILESTONES.includes(newStreak)) {
    await createNotification(
      userId,
      'streak_milestone',
      `${newStreak} din ka streak! Lagataar consistency dikha rahe ho 🔥`,
      newStreak >= 30 ? 'hype' : 'celebrate'
    );
  }

  return newStreak;
};

module.exports = {
  getNotifications,
  markAsRead,
  markAllRead,
  createNotification,
  touchActivity,
};
