const Session = require('../models/session.model');
const User = require('../models/user.model');
const RevokedSession = require('../models/revoked-session.model');
const { verifyRefreshToken, generateTokenPair } = require('../utils/jwt.utils');

const remember = async (refreshToken, userAgent = '') => {
  const token = verifyRefreshToken(refreshToken);
  if (!token.sid) return;
  const os = /android/i.test(userAgent)
    ? 'Android'
    : /iphone|ipad/i.test(userAgent)
      ? 'iOS'
      : /windows/i.test(userAgent)
        ? 'Windows'
        : /macintosh/i.test(userAgent)
          ? 'macOS'
          : 'Device';
  const browser = /edg/i.test(userAgent)
    ? 'Edge'
    : /firefox/i.test(userAgent)
      ? 'Firefox'
      : /chrome|crios/i.test(userAgent)
        ? 'Chrome-compatible browser'
        : /safari/i.test(userAgent)
          ? 'Safari'
          : 'Browser';
  await Session.updateOne(
    { _id: token.sid },
    {
      $set: {
        userId: token.id,
        version: token.version || 0,
        device: `${os} · ${browser}`,
        lastSeenAt: new Date(),
        expiresAt: new Date(token.exp * 1000),
      },
    },
    { upsert: true }
  );
};

const list = async (userId, currentSessionId) => {
  const user = await User.findById(userId).select('sessionVersion');
  const sessions = await Session.find({
    userId,
    version: user.sessionVersion || 0,
    expiresAt: { $gt: new Date() },
  })
    .sort({ lastSeenAt: -1 })
    .lean();
  const revoked = await RevokedSession.find({ _id: { $in: sessions.map((s) => s._id) } })
    .select('_id')
    .lean();
  const revokedIds = new Set(revoked.map((s) => s._id));
  return sessions
    .filter((s) => !revokedIds.has(s._id))
    .map((s) => ({
      id: s._id,
      device: s.device,
      lastSeenAt: s.lastSeenAt,
      current: s._id === currentSessionId,
    }));
};

// Advance the existing revocation generation, then issue credentials only for this device.
// This also invalidates older sessions created before device tracking was introduced.
const logoutOthers = async (userId, currentSessionId, userAgent) => {
  const user = await User.findByIdAndUpdate(userId, { $inc: { sessionVersion: 1 } }, { new: true });
  if (!user) {
    const error = new Error('User not found');
    error.statusCode = 404;
    throw error;
  }
  const tokens = generateTokenPair(user, undefined, undefined, currentSessionId);
  await remember(tokens.refreshToken, userAgent);
  return tokens;
};

module.exports = { remember, list, logoutOthers };
