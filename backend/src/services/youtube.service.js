// src/services/youtube.service.js
// YouTube OAuth flow + channel management

const { v4: uuidv4 } = require('uuid');
const YoutubeChannel = require('../models/youtube-channel.model');
const User = require('../models/user.model');
const { setCache, getCache, deleteCache } = require('../config/redis');
const {
  getAuthUrl,
  exchangeCodeForTokens,
  refreshAccessToken,
  youtubeRequest,
  QUOTA_COSTS,
} = require('../config/youtube.config');

// ==================== STEP 1: GET AUTH URL ====================
const getOAuthUrl = async (userId, plan) => {
  // Check channel limit based on plan
  const planLimits = { free: 1, creator: 1, pro: 3, agency: 25 };
  const limit = planLimits[plan] || 1;

  const existingChannels = await YoutubeChannel.countDocuments({
    userId,
    isActive: true,
  });

  if (existingChannels >= limit) {
    const err = new Error(
      `Your ${plan} plan allows ${limit} channel(s). Please upgrade to connect more.`
    );
    err.statusCode = 403;
    throw err;
  }

  // Generate state token (CSRF protection)
  const state = uuidv4();

  // Store state in Redis for 10 minutes
  await setCache(`oauth_state:${state}`, { userId }, 30 * 60); // 30 min (Render cold start fix)

  const authUrl = getAuthUrl(state);
  return { authUrl, state };
};

// ==================== STEP 2: HANDLE CALLBACK ====================
const handleOAuthCallback = async (code, state) => {
  // 1. Verify state (CSRF protection)
  const cached = await getCache(`oauth_state:${state}`);
  if (!cached) {
    const err = new Error('Invalid or expired OAuth state. Please try again.');
    err.statusCode = 400;
    throw err;
  }

  const { userId } = cached;
  await deleteCache(`oauth_state:${state}`);

  // 2. Exchange code for tokens
  const tokens = await exchangeCodeForTokens(code);

  const {
    access_token,
    refresh_token,
    expires_in,
    token_type,
    scope,
  } = tokens;

  // 3. Get channel info from YouTube
  const channelData = await getChannelInfo(access_token);
  if (!channelData) {
    const err = new Error('Could not fetch YouTube channel data. Please try again.');
    err.statusCode = 400;
    throw err;
  }

  // 4. Check if channel already connected by another account
  const existingChannel = await YoutubeChannel.findOne({
    channelId: channelData.id,
  });

  if (existingChannel && existingChannel.userId.toString() !== userId) {
    const err = new Error('This YouTube channel is already connected to another TubeOS account.');
    err.statusCode = 409;
    throw err;
  }

  // 5. Upsert channel (create or update if reconnecting)
  const expiresAt = new Date(Date.now() + expires_in * 1000);

  const channel = await YoutubeChannel.findOneAndUpdate(
    { channelId: channelData.id },
    {
      $set: {
        userId,
        channelId: channelData.id,
        channelName: channelData.snippet?.title,
        channelHandle: channelData.snippet?.customUrl || null,
        description: channelData.snippet?.description || '',
        thumbnail: channelData.snippet?.thumbnails?.high?.url || null,
        publishedAt: channelData.snippet?.publishedAt || null,
        country: channelData.snippet?.country || null,
        stats: {
          subscriberCount: parseInt(channelData.statistics?.subscriberCount) || 0,
          videoCount: parseInt(channelData.statistics?.videoCount) || 0,
          viewCount: parseInt(channelData.statistics?.viewCount) || 0,
          hiddenSubscriberCount: channelData.statistics?.hiddenSubscriberCount || false,
          lastSyncedAt: new Date(),
        },
        'oauth.accessToken': access_token,
        'oauth.refreshToken': refresh_token || existingChannel?.oauth?.refreshToken,
        'oauth.tokenType': token_type || 'Bearer',
        'oauth.expiresAt': expiresAt,
        'oauth.scope': scope || '',
        isActive: true,
        connectionStatus: 'connected',
        lastError: null,
      },
    },
    { upsert: true, new: true }
  );

  // 6. Add channel reference to user
  await User.findByIdAndUpdate(userId, {
    $addToSet: { youtubeChannels: channel._id },
  });

  // 7. Set as default if first channel
  const channelCount = await YoutubeChannel.countDocuments({ userId, isActive: true });
  if (channelCount === 1) {
    channel.isDefault = true;
    channel.isPrimary = true;
    await channel.save();
  }

  return {
    channel: sanitizeChannel(channel),
    message: `YouTube channel "${channel.channelName}" connected successfully!`,
  };
};

// ==================== GET CHANNEL INFO FROM YOUTUBE ====================
const getChannelInfo = async (accessToken) => {
  try {
    const data = await youtubeRequest(
      '/channels?part=snippet,statistics,brandingSettings&mine=true',
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    return data.items?.[0] || null;
  } catch (err) {
    console.error('Failed to fetch channel info:', err.message);
    return null;
  }
};

// ==================== GET ALL CONNECTED CHANNELS ====================
const getMyChannels = async (userId) => {
  const channels = await YoutubeChannel.find({
    userId,
    isActive: true,
  }).select('-oauth').sort({ isPrimary: -1, createdAt: 1 });

  return { channels: channels.map(sanitizeChannel) };
};

// ==================== SYNC CHANNEL STATS ====================
const syncChannelStats = async (channelId, userId) => {
  const channel = await YoutubeChannel.findOne({
    _id: channelId,
    userId,
    isActive: true,
  }).select('+oauth.accessToken +oauth.refreshToken +oauth.expiresAt');

  if (!channel) {
    const err = new Error('Channel not found');
    err.statusCode = 404;
    throw err;
  }

  // Refresh token if expired
  const accessToken = await getValidAccessToken(channel);

  // Fetch fresh stats from YouTube
  const data = await youtubeRequest(
    `/channels?part=snippet,statistics&id=${channel.channelId}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  const ytChannel = data.items?.[0];
  if (!ytChannel) {
    const err = new Error('Channel not found on YouTube');
    err.statusCode = 404;
    throw err;
  }

  // Update stats
  channel.stats = {
    subscriberCount: parseInt(ytChannel.statistics?.subscriberCount) || 0,
    videoCount: parseInt(ytChannel.statistics?.videoCount) || 0,
    viewCount: parseInt(ytChannel.statistics?.viewCount) || 0,
    hiddenSubscriberCount: ytChannel.statistics?.hiddenSubscriberCount || false,
    lastSyncedAt: new Date(),
  };
  channel.channelName = ytChannel.snippet?.title || channel.channelName;
  channel.thumbnail = ytChannel.snippet?.thumbnails?.high?.url || channel.thumbnail;

  await channel.save();

  return { channel: sanitizeChannel(channel) };
};

// ==================== DISCONNECT CHANNEL ====================
const disconnectChannel = async (channelId, userId) => {
  const channel = await YoutubeChannel.findOne({ _id: channelId, userId });

  if (!channel) {
    const err = new Error('Channel not found');
    err.statusCode = 404;
    throw err;
  }

  // Soft delete
  channel.isActive = false;
  channel.connectionStatus = 'disconnected';
  await channel.save();

  // Remove from user's channel list
  await User.findByIdAndUpdate(userId, {
    $pull: { youtubeChannels: channel._id },
  });

  // If this was default/primary, set another as default
  const remainingChannels = await YoutubeChannel.find({ userId, isActive: true });
  if (channel.isPrimary && remainingChannels.length > 0) {
    remainingChannels[0].isPrimary = true;
    remainingChannels[0].isDefault = true;
    await remainingChannels[0].save();
  }

  return { message: `Channel "${channel.channelName}" disconnected successfully` };
};

// ==================== SET PRIMARY CHANNEL ====================
const setPrimaryChannel = async (channelId, userId) => {
  // Remove primary from all channels
  await YoutubeChannel.updateMany({ userId }, { isPrimary: false, isDefault: false });

  // Set new primary
  const channel = await YoutubeChannel.findOneAndUpdate(
    { _id: channelId, userId, isActive: true },
    { isPrimary: true, isDefault: true },
    { new: true }
  );

  if (!channel) {
    const err = new Error('Channel not found');
    err.statusCode = 404;
    throw err;
  }

  return { channel: sanitizeChannel(channel), message: 'Primary channel updated' };
};

// ==================== GET QUOTA STATUS ====================
const getQuotaStatus = async (channelId, userId) => {
  const channel = await YoutubeChannel.findOne({ _id: channelId, userId, isActive: true });

  if (!channel) {
    const err = new Error('Channel not found');
    err.statusCode = 404;
    throw err;
  }

  await channel.resetDailyQuotaIfNeeded();

  return {
    quota: {
      dailyUsed: channel.quota.dailyUsed,
      dailyLimit: channel.quota.dailyLimit,
      dailyRemaining: channel.quota.dailyLimit - channel.quota.dailyUsed,
      uploadCount: channel.quota.uploadCount,
      uploadDailyLimit: channel.quota.uploadDailyLimit,
      uploadsRemaining: Math.max(0, channel.quota.uploadDailyLimit - channel.quota.uploadCount),
      lastResetDate: channel.quota.lastResetDate,
      percentUsed: Math.round((channel.quota.dailyUsed / channel.quota.dailyLimit) * 100),
    },
  };
};

// ==================== GET VALID ACCESS TOKEN ====================
// Auto-refresh if expired
const getValidAccessToken = async (channel) => {
  const now = new Date();
  const expiresAt = new Date(channel.oauth.expiresAt);
  const bufferTime = 5 * 60 * 1000; // 5 min buffer

  if (now >= new Date(expiresAt.getTime() - bufferTime)) {
    // Token expired or about to expire — refresh it
    try {
      const newTokens = await refreshAccessToken(channel.oauth.refreshToken);

      channel.oauth.accessToken = newTokens.access_token;
      channel.oauth.expiresAt = new Date(Date.now() + newTokens.expires_in * 1000);
      channel.connectionStatus = 'connected';
      await channel.save();

      return newTokens.access_token;
    } catch (err) {
      channel.connectionStatus = 'token_expired';
      channel.lastError = err.message;
      await channel.save();

      const error = new Error('YouTube token expired. Please reconnect your channel.');
      error.statusCode = 401;
      error.code = 'TOKEN_EXPIRED';
      throw error;
    }
  }

  return channel.oauth.accessToken;
};

// ==================== HELPERS ====================
const sanitizeChannel = (channel) => {
  const obj = channel.toObject ? channel.toObject({ virtuals: true }) : { ...channel };
  delete obj.oauth;
  delete obj.__v;
  return obj;
};

module.exports = {
  getOAuthUrl,
  handleOAuthCallback,
  getMyChannels,
  syncChannelStats,
  disconnectChannel,
  setPrimaryChannel,
  getQuotaStatus,
  getValidAccessToken,
  sanitizeChannel,
};
