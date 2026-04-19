// src/services/youtube.service.js
// YouTube OAuth flow + channel management
//
// FIXES:
// 1. getOAuthUrl — state Redis me userId STRING store karo (ObjectId nahi)
// 2. handleOAuthCallback — refresh_token missing hone par proper error
// 3. getValidAccessToken — REFRESH_TOKEN_REVOKED alag handle karo
// 4. getMyChannels — empty array safe return (500 nahi aayega)
// 5. syncChannelStats — oauth fields explicitly select karo

const { v4: uuidv4 } = require('uuid');
const YoutubeChannel = require('../models/youtube-channel.model');
const User = require('../models/user.model');
const { setCache, getCache, deleteCache } = require('../config/redis');
const {
  getAuthUrl,
  exchangeCodeForTokens,
  refreshAccessToken,
  youtubeRequest,
} = require('../config/youtube.config');

// ==================== STEP 1: GET AUTH URL ====================
const getOAuthUrl = async (userId, plan) => {
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

  const state = uuidv4();

  // FIX 1: userId ko string mein store karo — ObjectId Redis se wapas string aata hai
  // seedha userId object store karne pe toString() mein issue aata tha
  await setCache(
    `oauth_state:${state}`,
    { userId: userId.toString() },
    30 * 60 // 30 min — Render cold start ke liye kaafi hai
  );

  const authUrl = getAuthUrl(state);
  return { authUrl, state };
};

// ==================== STEP 2: HANDLE CALLBACK ====================
const handleOAuthCallback = async (code, state) => {
  // 1. State verify karo (CSRF protection)
  const cached = await getCache(`oauth_state:${state}`);
  if (!cached) {
    const err = new Error('Invalid or expired OAuth state. Please try connecting again.');
    err.statusCode = 400;
    throw err;
  }

  const { userId } = cached;
  await deleteCache(`oauth_state:${state}`);

  // 2. Code se tokens lo
  const tokens = await exchangeCodeForTokens(code);
  const { access_token, refresh_token, expires_in, token_type, scope } = tokens;

  // FIX 2: refresh_token nahi aaya to clearly batao
  // Ye tab hota hai jab user ne pehle is app ko access de rakha ho
  // Solution: user ko myaccount.google.com/permissions pe jaake app revoke karna hoga
  if (!refresh_token) {
    const err = new Error(
      'Could not get refresh token. Please go to myaccount.google.com/permissions, ' +
      'remove this app, and try connecting again.'
    );
    err.statusCode = 400;
    err.code = 'NO_REFRESH_TOKEN';
    throw err;
  }

  // 3. YouTube se channel info lo
  const channelData = await getChannelInfo(access_token);
  if (!channelData) {
    const err = new Error('Could not fetch YouTube channel data. Please try again.');
    err.statusCode = 400;
    throw err;
  }

  // 4. Check karo channel kisi aur account se connected to nahi
  const existingChannel = await YoutubeChannel.findOne({
    channelId: channelData.id,
  });

  if (existingChannel && existingChannel.userId.toString() !== userId.toString()) {
    const err = new Error(
      'This YouTube channel is already connected to another account.'
    );
    err.statusCode = 409;
    throw err;
  }

  // 5. Channel create ya update karo
  const expiresAt = new Date(Date.now() + expires_in * 1000);

  const channel = await YoutubeChannel.findOneAndUpdate(
    { channelId: channelData.id },
    {
      $set: {
        userId,
        channelId:     channelData.id,
        channelName:   channelData.snippet?.title,
        channelHandle: channelData.snippet?.customUrl || null,
        description:   channelData.snippet?.description || '',
        thumbnail:     channelData.snippet?.thumbnails?.high?.url || null,
        publishedAt:   channelData.snippet?.publishedAt || null,
        country:       channelData.snippet?.country || null,
        stats: {
          subscriberCount:      parseInt(channelData.statistics?.subscriberCount) || 0,
          videoCount:           parseInt(channelData.statistics?.videoCount) || 0,
          viewCount:            parseInt(channelData.statistics?.viewCount) || 0,
          hiddenSubscriberCount: channelData.statistics?.hiddenSubscriberCount || false,
          lastSyncedAt:         new Date(),
        },
        'oauth.accessToken':  access_token,
        'oauth.refreshToken': refresh_token,
        'oauth.tokenType':    token_type || 'Bearer',
        'oauth.expiresAt':    expiresAt,
        'oauth.scope':        scope || '',
        isActive:             true,
        connectionStatus:     'connected',
        lastError:            null,
      },
    },
    { upsert: true, new: true }
  );

  // 6. User ke youtubeChannels array mein add karo
  await User.findByIdAndUpdate(userId, {
    $addToSet: { youtubeChannels: channel._id },
  });

  // 7. Pehla channel hai to primary set karo
  const channelCount = await YoutubeChannel.countDocuments({
    userId,
    isActive: true,
  });

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

// ==================== CHANNEL INFO FROM YOUTUBE ====================
const getChannelInfo = async (accessToken) => {
  try {
    const data = await youtubeRequest(
      '/channels?part=snippet,statistics,brandingSettings&mine=true',
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    return data.items?.[0] || null;
  } catch (err) {
    console.error('[youtube.service] getChannelInfo failed:', err.message);
    return null;
  }
};

// ==================== GET ALL CONNECTED CHANNELS ====================
// FIX 4: try/catch ke andar empty array return — kabhi 500 nahi aayega
const getMyChannels = async (userId) => {
  try {
    const channels = await YoutubeChannel.find({
      userId,
      isActive: true,
    })
      .select('-oauth')
      .sort({ isPrimary: -1, createdAt: 1 });

    return { channels: channels.map(sanitizeChannel) };
  } catch (err) {
    console.error('[youtube.service] getMyChannels failed:', err.message);
    return { channels: [] };
  }
};

// ==================== SYNC CHANNEL STATS ====================
// FIX 5: .select('+oauth.accessToken +oauth.refreshToken +oauth.expiresAt') zaroori hai
// warna getValidAccessToken ko undefined milta tha
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

  const accessToken = await getValidAccessToken(channel);

  const data = await youtubeRequest(
    `/channels?part=snippet,statistics&id=${channel.channelId}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  const ytChannel = data.items?.[0];
  if (!ytChannel) {
    const err = new Error('Channel not found on YouTube');
    err.statusCode = 404;
    throw err;
  }

  channel.stats = {
    subscriberCount:      parseInt(ytChannel.statistics?.subscriberCount) || 0,
    videoCount:           parseInt(ytChannel.statistics?.videoCount) || 0,
    viewCount:            parseInt(ytChannel.statistics?.viewCount) || 0,
    hiddenSubscriberCount: ytChannel.statistics?.hiddenSubscriberCount || false,
    lastSyncedAt:         new Date(),
  };
  channel.channelName = ytChannel.snippet?.title || channel.channelName;
  channel.thumbnail   = ytChannel.snippet?.thumbnails?.high?.url || channel.thumbnail;
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

  channel.isActive = false;
  channel.connectionStatus = 'disconnected';
  await channel.save();

  await User.findByIdAndUpdate(userId, {
    $pull: { youtubeChannels: channel._id },
  });

  // Koi aur channel hai to use primary banao
  const remaining = await YoutubeChannel.find({ userId, isActive: true });
  if (channel.isPrimary && remaining.length > 0) {
    remaining[0].isPrimary = true;
    remaining[0].isDefault = true;
    await remaining[0].save();
  }

  return { message: `Channel "${channel.channelName}" disconnected successfully` };
};

// ==================== SET PRIMARY CHANNEL ====================
const setPrimaryChannel = async (channelId, userId) => {
  await YoutubeChannel.updateMany(
    { userId },
    { isPrimary: false, isDefault: false }
  );

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
  const channel = await YoutubeChannel.findOne({
    _id: channelId,
    userId,
    isActive: true,
  });

  if (!channel) {
    const err = new Error('Channel not found');
    err.statusCode = 404;
    throw err;
  }

  await channel.resetDailyQuotaIfNeeded();

  return {
    quota: {
      dailyUsed:       channel.quota.dailyUsed,
      dailyLimit:      channel.quota.dailyLimit,
      dailyRemaining:  channel.quota.dailyLimit - channel.quota.dailyUsed,
      uploadCount:     channel.quota.uploadCount,
      uploadDailyLimit: channel.quota.uploadDailyLimit,
      uploadsRemaining: Math.max(0, channel.quota.uploadDailyLimit - channel.quota.uploadCount),
      lastResetDate:   channel.quota.lastResetDate,
      percentUsed:     Math.round((channel.quota.dailyUsed / channel.quota.dailyLimit) * 100),
    },
  };
};

// ==================== GET VALID ACCESS TOKEN ====================
// FIX 3: REFRESH_TOKEN_REVOKED alag handle — user ko clear message milega
const getValidAccessToken = async (channel) => {
  const now        = new Date();
  const expiresAt  = new Date(channel.oauth.expiresAt);
  const bufferTime = 5 * 60 * 1000; // 5 min buffer

  if (now >= new Date(expiresAt.getTime() - bufferTime)) {
    try {
      const newTokens = await refreshAccessToken(channel.oauth.refreshToken);

      channel.oauth.accessToken = newTokens.access_token;
      channel.oauth.expiresAt   = new Date(Date.now() + newTokens.expires_in * 1000);
      channel.connectionStatus  = 'connected';
      await channel.save();

      return newTokens.access_token;
    } catch (err) {
      // Refresh token revoke ho gaya — reconnect karna hoga
      if (err.code === 'REFRESH_TOKEN_REVOKED' || err.code === 'NO_REFRESH_TOKEN') {
        channel.connectionStatus = 'reconnect_required';
        channel.lastError = err.message;
        await channel.save();

        const error = new Error(
          'YouTube access has been revoked. Please disconnect and reconnect your channel.'
        );
        error.statusCode = 401;
        error.code = 'RECONNECT_REQUIRED';
        throw error;
      }

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
