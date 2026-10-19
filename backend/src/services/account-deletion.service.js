const User = require('../models/user.model');
const Channel = require('../models/youtube-channel.model');
const Video = require('../models/video.model');
const Schedule = require('../models/schedule.model');
const Comment = require('../models/comment.model');
const Session = require('../models/session.model');
const TempToken = require('../models/temp-token.model');
const Notification = require('../models/notification.model');
const { ChannelAnalytics, VideoAnalytics, Heatmap } = require('../models/analytics.model');
const { GrowthPrediction, Competitor } = require('../models/growth.model');
const { PayoutRequest } = require('../models/referral.model');
const storage = require('./storage.service');
const thumbnails = require('./thumbnail.service');

const requestDeletion = async (userId, password) => {
  const user = await User.findById(userId).select('+password');
  if (!user || typeof password !== 'string' || !(await user.comparePassword(password))) {
    const err = new Error('Current password is incorrect');
    err.statusCode = 400;
    throw err;
  }
  // Disable first so existing tokens and background publishing stop even if a
  // subsequent cleanup operation needs retrying. The cron retries full cleanup.
  const deletedAt = user.deletedAt || new Date();
  await User.updateOne(
    { _id: userId },
    {
      $set: {
        deletedAt,
        deletionDueAt: new Date(Date.now() + 29 * 86400000),
        isActive: false,
        oauth: {},
      },
      $inc: { sessionVersion: 1 },
    }
  );
  await stopAccountActivity(userId);
  return {
    deletedAt,
    message: 'Account deactivated. Account data is scheduled for deletion within 30 days.',
  };
};

const stopAccountActivity = async (userId) => {
  await Schedule.updateMany(
    { userId, status: { $in: ['pending', 'processing'] } },
    { status: 'cancelled' }
  );
  await Channel.updateMany(
    { userId },
    {
      $set: {
        isActive: false,
        connectionStatus: 'disconnected',
        isPrimary: false,
        isDefault: false,
      },
      $unset: { oauth: 1 },
    }
  );
  await Session.deleteMany({ userId });
  await TempToken.deleteMany({ $or: [{ value: String(userId) }, { key: `email_otp:${userId}` }] });
};

// Delete provider files before their DB references, so failures stay retryable.
// No calls here delete videos or comments from the user's YouTube account.
const purgeVideoFiles = async (filter) => {
  const videos = await Video.find(filter).lean();
  for (const video of videos) {
    if (video.stagedFile?.gcsPath) await storage.deleteFile(video.stagedFile.gcsPath, true);
    const ids = [
      video.thumbnail?.cloudinaryId,
      ...(video.abTesting?.variants || []).map((v) => v.cloudinaryId),
    ].filter(Boolean);
    await thumbnails.deleteStoredImages(ids);
  }
};

const purgeChannelData = async (channelId) => {
  const channel = await Channel.findById(channelId).select('connectionStatus updatedAt');
  if (
    !channel ||
    channel.connectionStatus !== 'disconnected' ||
    channel.updatedAt > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  )
    return;

  const filter = { channelId };
  await purgeVideoFiles(filter);
  for (const model of [
    Schedule,
    Comment,
    ChannelAnalytics,
    VideoAnalytics,
    Heatmap,
    GrowthPrediction,
    Video,
  ]) {
    await model.deleteMany(filter);
  }
  await Channel.deleteOne({ _id: channelId, connectionStatus: 'disconnected' });
};

const purgeAccountData = async (userId) => {
  const user = await User.findOneAndUpdate(
    {
      _id: userId,
      deletedAt: { $ne: null },
      $and: [
        {
          $or: [
            { deletionDueAt: { $ne: null, $lte: new Date() } },
            { deletionDueAt: null, deletedAt: { $lte: new Date(Date.now() - 90 * 86400000) } },
          ],
        },
        {
          $or: [
            { deletionProcessingAt: null },
            { deletionProcessingAt: { $lt: new Date(Date.now() - 60 * 60 * 1000) } },
          ],
        },
      ],
    },
    { $set: { isActive: false, deletionProcessingAt: new Date() } },
    { new: true }
  );
  if (!user) return;

  await stopAccountActivity(userId);
  await purgeVideoFiles({ userId });
  await thumbnails.deleteUserImages(String(userId));
  for (const model of [
    Schedule,
    Comment,
    ChannelAnalytics,
    VideoAnalytics,
    Heatmap,
    GrowthPrediction,
    Competitor,
    Video,
    Channel,
    Session,
    Notification,
  ]) {
    await model.deleteMany({ userId });
  }
  const ContentReport = require('../models/content-report.model');
  await ContentReport.deleteMany({ userId });
  // Retain minimal financial transaction records, but remove payout destination
  // details and unlink referrals from the profile being removed.
  await PayoutRequest.updateMany({ userId }, { $unset: { bankAccount: 1, upi: 1 } });
  await User.updateMany({ 'referral.referredBy': userId }, { 'referral.referredBy': null });
  const { PlayPurchase, PlayBillingAccount } = require('../models/play-purchase.model');
  await PlayPurchase.deleteMany({ userId });
  await PlayBillingAccount.deleteOne({ _id: userId });
  await require('../models/checkout-intent.model').deleteMany({ userId });
  await User.deleteOne({ _id: userId, deletedAt: { $ne: null } });
};
module.exports = { requestDeletion, stopAccountActivity, purgeAccountData, purgeChannelData };
