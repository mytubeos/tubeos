// src/services/pubsub.service.js
// YouTube PubSubHubbub (WebSub) subscription management.
// YouTube pushes Atom XML to our callback when a new video is published.
// Subscriptions last up to 10 days; we lease 9 days and renew every 7 via cron.
// BACKEND_URL must be set to a public URL (Render deploy URL) for this to work.

const axios = require('axios');
const YoutubeChannel = require('../models/youtube-channel.model');
const logger = require('../config/logger');

const HUB_URL = 'https://pubsubhubbub.appspot.com/subscribe';
const LEASE_SECONDS = 9 * 24 * 60 * 60; // 9 days (YouTube max is 10)

const topicUrl = (channelId) =>
  `https://www.youtube.com/xml/feeds/videos.xml?channel_id=${channelId}`;

const callbackUrl = () => `${process.env.BACKEND_URL || ''}/api/v1/webhooks/youtube`;

/**
 * Subscribe (or re-subscribe) a YouTube channel to PubSubHubbub.
 * @param {string} ytChannelId  YouTube channelId (e.g. "UCxxxxxx")
 */
const subscribeChannel = async (ytChannelId) => {
  const verifyToken = process.env.WEBHOOK_VERIFY_TOKEN || '';
  const params = new URLSearchParams({
    'hub.callback': callbackUrl(),
    'hub.topic': topicUrl(ytChannelId),
    'hub.verify': 'async',
    'hub.mode': 'subscribe',
    'hub.lease_seconds': String(LEASE_SECONDS),
  });
  if (verifyToken) params.set('hub.verify_token', verifyToken);

  await axios.post(HUB_URL, params.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    timeout: 10_000,
  });

  const expiresAt = new Date(Date.now() + LEASE_SECONDS * 1000);
  await YoutubeChannel.updateOne(
    { channelId: ytChannelId },
    {
      $set: {
        'pubsub.subscribedAt': new Date(),
        'pubsub.leaseSeconds': LEASE_SECONDS,
        'pubsub.expiresAt': expiresAt,
      },
    }
  );

  logger.info(`[pubsub] subscribed ${ytChannelId}, expires ${expiresAt.toISOString()}`);
};

/**
 * Unsubscribe a channel from PubSubHubbub (called on channel disconnect).
 * @param {string} ytChannelId
 */
const unsubscribeChannel = async (ytChannelId) => {
  const verifyToken = process.env.WEBHOOK_VERIFY_TOKEN || '';
  const params = new URLSearchParams({
    'hub.callback': callbackUrl(),
    'hub.topic': topicUrl(ytChannelId),
    'hub.verify': 'async',
    'hub.mode': 'unsubscribe',
  });
  if (verifyToken) params.set('hub.verify_token', verifyToken);

  await axios.post(HUB_URL, params.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    timeout: 10_000,
  });

  await YoutubeChannel.updateOne({ channelId: ytChannelId }, { $unset: { pubsub: '' } });
  logger.info(`[pubsub] unsubscribed ${ytChannelId}`);
};

/**
 * Renew subscriptions for all active channels that either:
 *  - have never been subscribed, or
 *  - expire within the next 3 days
 * Called by cron every 7 days (and once on boot).
 */
const renewExpiringSubscriptions = async () => {
  if (!process.env.BACKEND_URL) {
    logger.warn('[pubsub] BACKEND_URL not set — skipping subscription renewal');
    return;
  }

  const cutoff = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  const channels = await YoutubeChannel.find({
    isActive: true,
    $or: [{ 'pubsub.expiresAt': { $lte: cutoff } }, { 'pubsub.subscribedAt': { $exists: false } }],
  })
    .select('channelId')
    .lean();

  logger.info(`[pubsub] renewing ${channels.length} subscription(s)`);
  let ok = 0;
  for (const ch of channels) {
    try {
      await subscribeChannel(ch.channelId);
      ok++;
      await new Promise((r) => setTimeout(r, 500));
    } catch (err) {
      logger.error(`[pubsub] renewal failed for ${ch.channelId}`, { error: err.message });
    }
  }
  logger.info(`[pubsub] renewal done: ${ok}/${channels.length}`);
};

module.exports = { subscribeChannel, unsubscribeChannel, renewExpiringSubscriptions };
