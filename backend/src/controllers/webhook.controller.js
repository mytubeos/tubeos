// src/controllers/webhook.controller.js
// Handles YouTube PubSubHubbub: challenge verification (GET) + new-video notifications (POST).

const YoutubeChannel = require('../models/youtube-channel.model');
const logger = require('../config/logger');

/**
 * GET /api/v1/webhooks/youtube
 * YouTube hub sends hub.challenge to verify our callback URL.
 * We echo it back to confirm. Optional hub.verify_token check for security.
 */
const verifyWebhook = (req, res) => {
  const { 'hub.mode': mode, 'hub.challenge': challenge, 'hub.verify_token': token } = req.query;

  const expected = process.env.WEBHOOK_VERIFY_TOKEN;
  if (expected && token !== expected) {
    logger.warn('[webhook] invalid hub.verify_token on challenge');
    return res.status(403).send('Forbidden');
  }

  if (mode === 'subscribe' || mode === 'unsubscribe') {
    logger.info(`[webhook] hub verification ok (mode=${mode})`);
    return res.status(200).send(challenge);
  }

  res.status(400).send('Bad Request');
};

/**
 * POST /api/v1/webhooks/youtube
 * YouTube pushes Atom XML when a new video is published on a subscribed channel.
 * We respond 204 immediately, then process async so YouTube doesn't retry.
 */
const handleNotification = async (req, res) => {
  res.status(204).send();

  try {
    const xml = req.rawBody || '';
    if (!xml) return;

    const channelId = extractTag(xml, 'yt:channelId');
    const videoId = extractTag(xml, 'yt:videoId');

    if (!channelId || !videoId) {
      logger.warn('[webhook] notification missing channelId or videoId');
      return;
    }

    logger.info(`[webhook] new video: channel=${channelId} video=${videoId}`);

    const channel = await YoutubeChannel.findOne({ channelId, isActive: true })
      .select('_id userId')
      .lean();

    if (!channel) {
      logger.warn(`[webhook] no active channel found for ${channelId}`);
      return;
    }

    // Short 7-day sync to pick up the new video's initial stats quickly
    const { syncChannelAnalytics } = require('../services/analytics.service');
    await syncChannelAnalytics(channel._id.toString(), channel.userId.toString(), 7);

    logger.info(`[webhook] analytics synced after new video ${videoId} on ${channelId}`);
  } catch (err) {
    logger.error('[webhook] notification handling failed', { error: err.message });
  }
};

const extractTag = (xml, tag) => {
  const match = xml.match(new RegExp(`<${tag}>([^<]+)</${tag}>`));
  return match ? match[1].trim() : null;
};

module.exports = { verifyWebhook, handleNotification };
