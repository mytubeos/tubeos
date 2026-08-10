// @ts-check
// src/services/analytics.service.js
// Fetches + aggregates analytics data
// Syncs from YouTube Analytics API + serves dashboard data

/** @typedef {'7d' | '30d' | '90d' | '180d' | '365d'} Period */

// Cast to any: mongoose v8 Model<any> has union overloads that TS can't
// disambiguate in @ts-check JS files (TS2349). Casting the require result
// to any sidesteps the issue while keeping type safety on our own code.
const { ChannelAnalytics, VideoAnalytics } = /** @type {any} */ (
  require('../models/analytics.model')
);
const Video = /** @type {any} */ (require('../models/video.model'));
const YoutubeChannel = /** @type {any} */ (require('../models/youtube-channel.model'));
const { getValidAccessToken, invalidateChannelCache } = require('./youtube.service');
const { youtubeRequest } = require('../config/youtube.config');
const { setCache, getCache, deleteCache } = require('../config/redis');
const logger = require('../config/logger');

// ==================== SYNC CHANNEL VIDEOS ====================
// Imports all existing YouTube channel videos into the Video collection.
// Called on channel connect and every time user clicks Sync.
/**
 * @param {object} channel - YoutubeChannel document
 * @param {string} accessToken
 * @param {string} userId
 * @returns {Promise<number>} Total videos synced
 */
const syncChannelVideos = async (channel, accessToken, userId) => {
  try {
    // 1. Get uploads playlist ID
    const channelData = await youtubeRequest(`/channels?part=contentDetails&mine=true`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const uploadsPlaylistId = channelData.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
    if (!uploadsPlaylistId) return 0;

    // 2. Fetch video IDs from uploads playlist (max 200 videos, 50 per page)
    const allVideoIds = [];
    let pageToken = null;

    do {
      const url = `/playlistItems?part=contentDetails&playlistId=${uploadsPlaylistId}&maxResults=50${pageToken ? `&pageToken=${pageToken}` : ''}`;
      const data = await youtubeRequest(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      (data.items || []).forEach((item) => {
        if (item.contentDetails?.videoId) allVideoIds.push(item.contentDetails.videoId);
      });
      pageToken = data.nextPageToken || null;
    } while (pageToken && allVideoIds.length < 200);

    if (allVideoIds.length === 0) return 0;

    // Skip videos the user deliberately removed from Vezrin only (kept live
    // on YouTube on purpose) — otherwise this upsert loop would silently
    // undo that delete by re-importing the same video right back.
    const excluded = new Set(channel.excludedVideoIds || []);
    const syncableVideoIds = allVideoIds.filter((id) => !excluded.has(id));

    // Reconcile: any video previously synced for this channel whose id is no
    // longer in the CURRENT uploads playlist was deleted directly on YouTube
    // (outside Vezrin, not via the exclusion path above) — mark it failed
    // with a clear reason instead of leaving it dangling forever with a
    // stale "published" status and a dead thumbnail.
    await Video.updateMany(
      {
        channelId: channel._id,
        youtubeVideoId: { $ne: null, $nin: allVideoIds },
        status: { $in: ['published', 'scheduled', 'processing'] },
      },
      {
        $set: {
          status: 'failed',
          lastError: {
            message:
              'No longer found on YouTube — it may have been deleted directly on YouTube Studio.',
            code: 'MISSING_FROM_YOUTUBE',
            occurredAt: new Date(),
          },
        },
      }
    );

    // Separate, narrower case: a record claiming to be published/scheduled/
    // processing but with no youtubeVideoId at all was never actually sent
    // to YouTube in the first place (every code path that sets these
    // statuses sets the id in the same write — see uploadVideo() /
    // cron.js's reapPublishedSchedules). Most likely a stale pre-existing
    // record. Flagged separately from MISSING_FROM_YOUTUBE above since that
    // message would be factually wrong here — this video was never on
    // YouTube to be deleted from.
    await Video.updateMany(
      {
        channelId: channel._id,
        youtubeVideoId: null,
        status: { $in: ['published', 'scheduled', 'processing'] },
      },
      {
        $set: {
          status: 'failed',
          lastError: {
            message: 'This video was never actually uploaded to YouTube.',
            code: 'NEVER_UPLOADED',
            occurredAt: new Date(),
          },
        },
      }
    );

    if (syncableVideoIds.length === 0) return 0;

    // 3. Fetch video details + stats in batches of 50
    let totalSynced = 0;

    for (let i = 0; i < syncableVideoIds.length; i += 50) {
      const batch = syncableVideoIds.slice(i, i + 50);
      const videosData = await youtubeRequest(
        `/videos?part=snippet,statistics,contentDetails,status&id=${batch.join(',')}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      const bulkOps = (videosData.items || []).map((video) => {
        const thumbs = video.snippet?.thumbnails;
        const thumbUrl =
          thumbs?.maxres?.url ||
          thumbs?.high?.url ||
          thumbs?.medium?.url ||
          thumbs?.default?.url ||
          null;
        const duration = parseDuration(video.contentDetails?.duration || '');
        const isShort = duration > 0 && duration <= 60;

        // YouTube's uploads-playlist response includes the owner's own
        // still-private/scheduled videos alongside genuinely public ones —
        // don't blindly mark everything 'published', or a video scheduled
        // for the future gets mislabeled as already live.
        const publishAt = video.status?.publishAt ? new Date(video.status.publishAt) : null;
        const isScheduledFuture =
          video.status?.privacyStatus === 'private' && publishAt && publishAt > new Date();

        return {
          updateOne: {
            filter: { youtubeVideoId: video.id },
            update: {
              $set: {
                userId,
                channelId: channel._id,
                youtubeVideoId: video.id,
                youtubeUrl: `https://www.youtube.com/watch?v=${video.id}`,
                title: video.snippet?.title || 'Untitled',
                description: (video.snippet?.description || '').slice(0, 5000),
                tags: (video.snippet?.tags || []).slice(0, 30),
                category: video.snippet?.categoryId || '22',
                privacy: video.status?.privacyStatus || 'public',
                status: isScheduledFuture ? 'scheduled' : 'published',
                ...(isScheduledFuture ? { scheduledAt: publishAt } : {}),
                publishedAt: video.snippet?.publishedAt
                  ? new Date(video.snippet.publishedAt)
                  : null,
                'thumbnail.url': thumbUrl,
                'thumbnail.isCustom': false,
                isShort,
                'uploadInfo.duration': duration || null,
                'performance.views': parseInt(video.statistics?.viewCount) || 0,
                'performance.likes': parseInt(video.statistics?.likeCount) || 0,
                'performance.comments': parseInt(video.statistics?.commentCount) || 0,
                'performance.lastSyncedAt': new Date(),
              },
            },
            upsert: true,
          },
        };
      });

      if (bulkOps.length > 0) {
        await Video.bulkWrite(bulkOps);
        totalSynced += bulkOps.length;
      }
    }

    logger.info(`[analytics] syncChannelVideos: imported ${totalSynced} videos`, {
      channelId: channel._id,
    });
    return totalSynced;
  } catch (err) {
    logger.error('[analytics] syncChannelVideos failed', { error: err.message });
    return 0;
  }
};

// Parse ISO 8601 duration to seconds: "PT1M30S" -> 90
const parseDuration = (iso) => {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  return parseInt(match[1] || 0) * 3600 + parseInt(match[2] || 0) * 60 + parseInt(match[3] || 0);
};

// Clears all analytics caches for a channel so next request gets fresh DB data
const invalidateAnalyticsCache = async (channelId) => {
  const periods = ['7d', '30d', '90d'];
  const metrics = ['views', 'subscribers', 'likes', 'comments', 'watchTime', 'ctr'];
  // getVideoBreakdown() caches per-video, not per-channel -- without this,
  // Sync never busts a video's own cached breakdown, so a bad/stale result
  // could keep serving for up to its full 30-minute TTL after every sync.
  const channelVideos = await Video.find({ channelId }).select('_id').lean();
  await Promise.all([
    ...periods.map((p) => deleteCache(`analytics:overview:${channelId}:${p}`)),
    ...periods.flatMap((p) =>
      metrics.map((m) => deleteCache(`analytics:daily:${channelId}:${p}:${m}`))
    ),
    deleteCache(`analytics:topvideos:${channelId}:5:views`),
    deleteCache(`analytics:topvideos:${channelId}:10:views`),
    ...channelVideos.map((v) => deleteCache(`analytics:video:${v._id}`)),
    // growth.service.js's getGrowthPrediction() caches for 12h with no other
    // invalidation hook anywhere -- without this, a Sync right after fixing
    // a real data/growth issue (or just normal day-to-day subscriber growth)
    // would keep serving a stale prediction for up to 12h regardless.
    deleteCache(`growth:prediction:${channelId}`),
  ]);
};

// ==================== SYNC CHANNEL ANALYTICS ====================
// Fetches last N days of analytics from YouTube API
/**
 * @param {string} channelId
 * @param {string} userId
 * @param {number} [days]
 * @returns {Promise<{synced: number, message: string}>}
 */
const syncChannelAnalytics = async (channelId, userId, days = 30) => {
  const channel = await YoutubeChannel.findOne({ _id: channelId, userId, isActive: true }).select(
    '+oauth.accessToken +oauth.refreshToken +oauth.expiresAt'
  );

  if (!channel) {
    const err = new Error('Channel not found');
    err.statusCode = 404;
    throw err;
  }

  const accessToken = await getValidAccessToken(channel);

  // Date range
  const endDate = new Date().toISOString().split('T')[0];
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const BASE_METRICS = [
    'views',
    'estimatedMinutesWatched',
    'averageViewDuration',
    'averageViewPercentage',
    'subscribersGained',
    'subscribersLost',
    'likes',
    'comments',
    'shares',
  ];

  const buildAnalyticsUrl = (metrics) => {
    const url = new URL('https://youtubeanalytics.googleapis.com/v2/reports');
    url.searchParams.set('ids', `channel==MINE`);
    url.searchParams.set('startDate', startDate);
    url.searchParams.set('endDate', endDate);
    url.searchParams.set('metrics', metrics.join(','));
    url.searchParams.set('dimensions', 'day');
    url.searchParams.set('sort', 'day');
    return url;
  };

  // Try WITH revenue first (requires yt-analytics-monetary.readonly + monetized channel)
  let response = await fetch(buildAnalyticsUrl([...BASE_METRICS, 'estimatedRevenue']).toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  let revenueAvailable = true;

  if (!response.ok) {
    const revenueError = await response
      .clone()
      .json()
      .catch(() => ({}));
    const revenueMsg = revenueError.error?.message || '';
    if (response.status === 403 && /revenue|monetary|monetization/i.test(revenueMsg)) {
      // Channel isn't monetized / token predates the monetary scope — retry without revenue
      revenueAvailable = false;
      response = await fetch(buildAnalyticsUrl(BASE_METRICS).toString(), {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
    }
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    if (response.status === 403) {
      // Analytics API needs yt-analytics scope — fall back to YouTube Data API (youtube.readonly)
      logger.info('[analytics] Analytics API 403', { error: error?.error || error });
      const synced = await syncFromVideoStats(channel, accessToken, startDate, endDate, userId);
      await syncChannelVideos(channel, accessToken, userId);
      await YoutubeChannel.findByIdAndUpdate(channel._id, {
        analyticsMode: 'basic',
        'monetization.revenueDataAvailable': false,
      });
      await invalidateAnalyticsCache(channelId);
      return {
        synced,
        message: `Synced ${synced} days of data (basic mode — views, likes, comments)`,
      };
    }
    const err = new Error(error.error?.message || 'Failed to fetch analytics');
    err.statusCode = response.status;
    throw err;
  }

  const data = await response.json();
  const rows = data.rows || [];
  const headers = data.columnHeaders?.map((h) => h.name) || [];

  // Upsert each day's data
  const bulkOps = rows.map((row) => {
    const record = {};
    headers.forEach((h, i) => {
      record[h] = row[i];
    });

    return {
      updateOne: {
        filter: { channelId, date: new Date(record.day) },
        update: {
          $set: {
            userId,
            channelId,
            date: new Date(record.day),
            'metrics.views': record.views || 0,
            'metrics.estimatedMinutesWatched': record.estimatedMinutesWatched || 0,
            'metrics.averageViewDuration': record.averageViewDuration || 0,
            'metrics.averageViewPercentage': record.averageViewPercentage || 0,
            'metrics.subscribersGained': record.subscribersGained || 0,
            'metrics.subscribersLost': record.subscribersLost || 0,
            'metrics.likes': record.likes || 0,
            'metrics.comments': record.comments || 0,
            'metrics.shares': record.shares || 0,
            ...(revenueAvailable
              ? { 'metrics.estimatedRevenue': record.estimatedRevenue || 0 }
              : {}),
          },
        },
        upsert: true,
      },
    };
  });

  if (bulkOps.length > 0) {
    await ChannelAnalytics.bulkWrite(bulkOps);
  }

  // Also fetch traffic sources
  await syncTrafficSources(channel, accessToken, startDate, endDate, userId);

  // Also fetch impressions/CTR — isolated + gracefully-degrading like traffic
  // sources above, since these metrics were only added to the API in 2026
  // and older/edge-case tokens or channels may not support them.
  await syncImpressionsCtr(channel, accessToken, startDate, endDate);

  // Import/update all channel videos with latest stats
  await syncChannelVideos(channel, accessToken, userId);

  // Per-video daily breakdown — top videos by views (bounded to control API quota)
  await syncTopVideoAnalytics(channel, accessToken, userId, startDate, endDate);

  await YoutubeChannel.findByIdAndUpdate(channel._id, {
    analyticsMode: 'full',
    'monetization.revenueDataAvailable': revenueAvailable,
  });
  await invalidateAnalyticsCache(channelId);
  return { synced: bulkOps.length, message: `Synced ${bulkOps.length} days of analytics` };
};

// ==================== SYNC TRAFFIC SOURCES ====================
const syncTrafficSources = async (channel, accessToken, startDate, endDate, userId) => {
  try {
    const url = new URL('https://youtubeanalytics.googleapis.com/v2/reports');
    url.searchParams.set('ids', 'channel==MINE');
    url.searchParams.set('startDate', startDate);
    url.searchParams.set('endDate', endDate);
    url.searchParams.set('metrics', 'views');
    url.searchParams.set('dimensions', 'insightTrafficSourceType');

    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) return;

    const data = await response.json();
    const rows = data.rows || [];

    // Aggregate traffic sources into latest record
    const trafficMap = {};
    rows.forEach(([source, views]) => {
      trafficMap[source] = (trafficMap[source] || 0) + views;
    });

    // Update today's record
    const today = new Date().toISOString().split('T')[0];
    await ChannelAnalytics.findOneAndUpdate(
      { channelId: channel._id, date: new Date(today) },
      {
        $set: {
          'trafficSources.browseFeatures': trafficMap['BROWSE'] || 0,
          'trafficSources.ytSearch': trafficMap['YT_SEARCH'] || 0,
          'trafficSources.suggested': trafficMap['RELATED_VIDEO'] || 0,
          'trafficSources.external': trafficMap['EXT_URL'] || 0,
          'trafficSources.notification': trafficMap['NOTIFICATION'] || 0,
          'trafficSources.playlist': trafficMap['PLAYLIST'] || 0,
        },
      },
      { upsert: true }
    );
  } catch (err) {
    logger.error('Traffic sources sync failed', { error: err.message });
  }
};

// ==================== SYNC IMPRESSIONS / CTR ====================
// Kept as its own request (not merged into BASE_METRICS above) because these
// are the real YouTube Analytics API metric names — the previous version of
// this code requested 'impressions'/'impressionsCtr', which are not valid
// metric names at all (the actual per-video-thumbnail metrics are named
// below), so CTR was always silently written as 0. Isolated + best-effort
// like syncTrafficSources: if this specific request 400s/403s for a channel
// or token that doesn't support it, the rest of the sync must not break.
const syncImpressionsCtr = async (channel, accessToken, startDate, endDate) => {
  try {
    const url = new URL('https://youtubeanalytics.googleapis.com/v2/reports');
    url.searchParams.set('ids', 'channel==MINE');
    url.searchParams.set('startDate', startDate);
    url.searchParams.set('endDate', endDate);
    url.searchParams.set('metrics', 'videoThumbnailImpressions,videoThumbnailImpressionsClickRate');
    url.searchParams.set('dimensions', 'day');
    url.searchParams.set('sort', 'day');

    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) return;

    const data = await response.json();
    const rows = data.rows || [];
    if (rows.length === 0) return;

    const bulkOps = rows.map(([day, impressions, ctr]) => ({
      updateOne: {
        filter: { channelId: channel._id, date: new Date(day) },
        update: {
          $set: {
            'metrics.impressions': impressions || 0,
            'metrics.impressionsCtr': ctr || 0,
          },
        },
        upsert: true,
      },
    }));

    await ChannelAnalytics.bulkWrite(bulkOps);
  } catch (err) {
    logger.error('Impressions/CTR sync failed', { error: err.message });
  }
};

// ==================== SYNC PER-VIDEO DAILY ANALYTICS ====================
// Populates VideoAnalytics (day-by-day per video) — powers the Video Analytics
// breakdown page. Bounded to the channel's top-viewed videos so a full channel
// sync doesn't burn one YouTube Analytics quota unit per video the channel has ever posted.
const MAX_VIDEOS_PER_SYNC = 20;

const syncTopVideoAnalytics = async (channel, accessToken, userId, startDate, endDate) => {
  try {
    const topVideos = await Video.find({
      channelId: channel._id,
      status: 'published',
      youtubeVideoId: { $exists: true },
    })
      .sort({ 'performance.views': -1 })
      .limit(MAX_VIDEOS_PER_SYNC)
      .select('_id youtubeVideoId')
      .lean();

    await syncVideoAnalyticsBatch(channel, accessToken, userId, topVideos, startDate, endDate);
  } catch (err) {
    logger.error('[analytics] syncTopVideoAnalytics failed', { error: err.message });
  }
};

// Fetches per-day metrics for a specific set of videos from the YouTube Analytics API
// (one request per video — the API has no multi-video "day" dimension breakdown).
const syncVideoAnalyticsBatch = async (
  channel,
  accessToken,
  userId,
  videos,
  startDate,
  endDate
) => {
  for (const video of videos) {
    if (!video.youtubeVideoId) continue;
    try {
      const url = new URL('https://youtubeanalytics.googleapis.com/v2/reports');
      url.searchParams.set('ids', 'channel==MINE');
      url.searchParams.set('startDate', startDate);
      url.searchParams.set('endDate', endDate);
      url.searchParams.set(
        'metrics',
        [
          'views',
          'estimatedMinutesWatched',
          'averageViewDuration',
          'averageViewPercentage',
          'likes',
          'comments',
          'shares',
        ].join(',')
      );
      url.searchParams.set('dimensions', 'day');
      url.searchParams.set('filters', `video==${video.youtubeVideoId}`);
      url.searchParams.set('sort', 'day');

      const response = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!response.ok) {
        // Skip this video, don't fail the whole batch — very common for a
        // just-published video: YouTube Analytics has a real 24-48h+
        // processing lag before per-video daily data is queryable, even
        // though the channel has full Analytics access. Still log it so a
        // genuine auth/quota failure isn't completely invisible.
        const errBody = await response.json().catch(() => ({}));
        logger.warn(`[analytics] per-video analytics fetch not ok for ${video.youtubeVideoId}`, {
          status: response.status,
          error: errBody.error?.message,
        });
        continue;
      }

      const data = await response.json();
      const rows = data.rows || [];
      const headers = data.columnHeaders?.map((h) => h.name) || [];

      const bulkOps = rows.map((row) => {
        const record = {};
        headers.forEach((h, i) => {
          record[h] = row[i];
        });
        return {
          updateOne: {
            filter: { youtubeVideoId: video.youtubeVideoId, date: new Date(record.day) },
            update: {
              $set: {
                userId,
                channelId: channel._id,
                videoId: video._id,
                youtubeVideoId: video.youtubeVideoId,
                date: new Date(record.day),
                'metrics.views': record.views || 0,
                'metrics.estimatedMinutesWatched': record.estimatedMinutesWatched || 0,
                'metrics.averageViewDuration': record.averageViewDuration || 0,
                'metrics.averageViewPercentage': record.averageViewPercentage || 0,
                'metrics.likes': record.likes || 0,
                'metrics.comments': record.comments || 0,
                'metrics.shares': record.shares || 0,
                'metrics.impressions': record.impressions || 0,
                'metrics.impressionsCtr': record.impressionsCtr || 0,
              },
            },
            upsert: true,
          },
        };
      });

      if (bulkOps.length > 0) {
        await VideoAnalytics.bulkWrite(bulkOps);
      }
    } catch (err) {
      logger.error(`[analytics] video analytics sync failed for ${video.youtubeVideoId}`, {
        error: err.message,
      });
    }
  }
};

// ==================== FALLBACK: SYNC FROM VIDEO STATS (youtube.readonly scope) ====================
// Used when Analytics API returns 403 (missing yt-analytics scope on stored token).
// Fetches ALL video stats and writes aggregate into today's ChannelAnalytics row.
// NOTE: Old code filtered by publishedAt (last 30 days) so old channels always got 0.
const syncFromVideoStats = async (channel, accessToken, startDate, endDate, userId) => {
  try {
    // 1. Get uploads playlist ID
    const channelData = await youtubeRequest(`/channels?part=contentDetails,statistics&mine=true`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const uploadsId = channelData.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
    const channelStats = channelData.items?.[0]?.statistics || {};

    // Save fresh subscriber/view counts to YoutubeChannel so dashboard always shows latest
    await YoutubeChannel.findByIdAndUpdate(channel._id, {
      'stats.subscriberCount': parseInt(channelStats.subscriberCount) || 0,
      'stats.viewCount': parseInt(channelStats.viewCount) || 0,
      'stats.videoCount': parseInt(channelStats.videoCount) || 0,
      'stats.lastSyncedAt': new Date(),
    });
    await invalidateChannelCache(userId);

    // In basic mode we only have all-time totals — writing them as daily rows causes
    // the overview to SUM them across days and inflate views (e.g. 1.6K × 2 syncs = 3.2K).
    // Delete any stale basic-mode rows so the video-aggregate fallback in getOverview runs cleanly.
    await ChannelAnalytics.deleteMany({ channelId: channel._id });

    if (!uploadsId) return 1;

    // 2. Fetch ALL videos from uploads playlist
    const playlistData = await youtubeRequest(
      `/playlistItems?part=contentDetails&playlistId=${uploadsId}&maxResults=50`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    const allItems = playlistData.items || [];

    // 3. Update per-video stats in the Video collection so the fallback aggregate is accurate
    const videoIds = allItems
      .map((i) => i.contentDetails.videoId)
      .filter(Boolean)
      .slice(0, 50);

    if (videoIds.length > 0) {
      const statsData = await youtubeRequest(
        `/videos?part=statistics,contentDetails&id=${videoIds.join(',')}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      const bulkOps = (statsData.items || []).map((video) => ({
        updateOne: {
          filter: { youtubeVideoId: video.id, channelId: channel._id },
          update: {
            $set: {
              'performance.views': parseInt(video.statistics?.viewCount) || 0,
              'performance.likes': parseInt(video.statistics?.likeCount) || 0,
              'performance.comments': parseInt(video.statistics?.commentCount) || 0,
              'performance.lastSyncedAt': new Date(),
            },
          },
        },
      }));

      if (bulkOps.length > 0) await Video.bulkWrite(bulkOps);
    }

    return 1;
  } catch (err) {
    logger.error('[analytics] Video stats fallback failed', { error: err.message });
    return 0;
  }
};

// ==================== GET OVERVIEW (Main Dashboard) ====================
/**
 * @param {string} userId
 * @param {string} channelId
 * @param {Period} [period]
 * @returns {Promise<object>}
 */
const getOverview = async (userId, channelId, period = '30d') => {
  const cacheKey = `analytics:overview:${channelId}:${period}`;
  const cached = await getCache(cacheKey);
  if (cached) return cached;

  const days = parsePeriod(period);
  const endDate = new Date();
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const prevStartDate = new Date(startDate.getTime() - days * 24 * 60 * 60 * 1000);

  const channelObjectId = require('mongoose').Types.ObjectId.createFromHexString(channelId);

  // Whether this channel has EVER synced any real ChannelAnalytics row, not
  // scoped to the selected period — the video-performance fallback below is
  // for channels with no real analytics access at all (basic mode). Gating
  // it on "did this specific period's query return rows" instead used to
  // make a wide period (90d/365d) legitimately return a real-but-incomplete
  // period sum while a narrower period (7d/30d) whose window happened to
  // miss the same real data silently substituted a completely different,
  // unbounded lifetime total into the same field — producing a wider period
  // showing FEWER views than a narrower one for the same channel.
  const hasAnyAnalyticsData = await ChannelAnalytics.exists({ channelId: channelObjectId });

  const [current, previous] = await Promise.all([
    ChannelAnalytics.aggregate([
      {
        $match: {
          channelId: channelObjectId,
          date: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: null,
          totalViews: { $sum: '$metrics.views' },
          totalWatchTime: { $sum: '$metrics.estimatedMinutesWatched' },
          avgViewDuration: { $avg: '$metrics.averageViewDuration' },
          subscribersGained: { $sum: '$metrics.subscribersGained' },
          subscribersLost: { $sum: '$metrics.subscribersLost' },
          totalLikes: { $sum: '$metrics.likes' },
          totalComments: { $sum: '$metrics.comments' },
          totalImpressions: { $sum: '$metrics.impressions' },
          avgCtr: { $avg: '$metrics.impressionsCtr' },
          totalRevenue: { $sum: '$metrics.estimatedRevenue' },
        },
      },
    ]),
    ChannelAnalytics.aggregate([
      {
        $match: {
          channelId: channelObjectId,
          date: { $gte: prevStartDate, $lt: startDate },
        },
      },
      {
        $group: {
          _id: null,
          totalViews: { $sum: '$metrics.views' },
          totalWatchTime: { $sum: '$metrics.estimatedMinutesWatched' },
          subscribersGained: { $sum: '$metrics.subscribersGained' },
          totalLikes: { $sum: '$metrics.likes' },
          totalRevenue: { $sum: '$metrics.estimatedRevenue' },
        },
      },
    ]),
  ]);

  let curr = current[0] || {};
  const prev = previous[0] || {};

  // Fallback: if this channel has NEVER synced any ChannelAnalytics row at
  // all (not just "this period's window happened to miss the data"), sum
  // from Video.performance instead — this is the real "no yt-analytics
  // scope, fallback sync hasn't run yet" case. Deliberately NOT gated on
  // `!curr.totalViews` (a real period sum of zero, e.g. a genuinely quiet
  // week, must stay zero — it must not be silently replaced by an unbounded
  // lifetime total).
  if (!hasAnyAnalyticsData) {
    const videoFallback = await Video.aggregate([
      {
        $match: {
          channelId: channelObjectId,
          status: 'published',
          'performance.lastSyncedAt': { $exists: true },
        },
      },
      {
        $group: {
          _id: null,
          totalViews: { $sum: '$performance.views' },
          totalLikes: { $sum: '$performance.likes' },
          totalComments: { $sum: '$performance.comments' },
        },
      },
    ]);
    if (videoFallback[0]?.totalViews) {
      curr = {
        totalViews: videoFallback[0].totalViews,
        totalLikes: videoFallback[0].totalLikes,
        totalComments: videoFallback[0].totalComments,
        totalWatchTime: 0,
        subscribersGained: 0,
        subscribersLost: 0,
        totalImpressions: 0,
        avgCtr: 0,
        avgViewDuration: 0,
        totalRevenue: 0,
      };
    }
  }

  const result = {
    period,
    metrics: {
      views: {
        value: curr.totalViews || 0,
        // calcChange returns null whenever the previous period had zero views —
        // common for small/new channels — which hides the % badge entirely even
        // though "0 -> N" is real growth. delta is always defined (never null),
        // so the frontend can fall back to an absolute "+N views" readout then.
        delta: (curr.totalViews || 0) - (prev.totalViews || 0),
        change: calcChange(curr.totalViews, prev.totalViews),
        trend: getTrend(curr.totalViews, prev.totalViews),
      },
      watchTime: {
        value: curr.totalWatchTime || 0,
        formatted: formatWatchTime(curr.totalWatchTime || 0),
        change: calcChange(curr.totalWatchTime, prev.totalWatchTime),
      },
      subscribers: {
        gained: curr.subscribersGained || 0,
        lost: curr.subscribersLost || 0,
        net: (curr.subscribersGained || 0) - (curr.subscribersLost || 0),
        change: calcChange(curr.subscribersGained, prev.subscribersGained),
        trend: getTrend(curr.subscribersGained, prev.subscribersGained),
      },
      likes: {
        value: curr.totalLikes || 0,
        change: calcChange(curr.totalLikes, prev.totalLikes),
      },
      comments: { value: curr.totalComments || 0 },
      impressions: { value: curr.totalImpressions || 0 },
      ctr: {
        value: parseFloat((curr.avgCtr || 0).toFixed(2)),
        formatted: `${(curr.avgCtr || 0).toFixed(2)}%`,
      },
      avgViewDuration: {
        value: curr.avgViewDuration || 0,
        formatted: formatSeconds(curr.avgViewDuration || 0),
      },
      revenue: {
        value: parseFloat((curr.totalRevenue || 0).toFixed(2)),
        formatted: `$${(curr.totalRevenue || 0).toFixed(2)}`,
        change: calcChange(curr.totalRevenue, prev.totalRevenue),
      },
    },
  };

  await setCache(cacheKey, result, 30 * 60); // Cache 30 mins
  return result;
};

// ==================== GET DAILY GRAPH DATA ====================
/**
 * @param {string} userId
 * @param {string} channelId
 * @param {Period} [period]
 * @param {string} [metric]
 * @returns {Promise<object>}
 */
const getDailyGraph = async (userId, channelId, period = '30d', metric = 'views') => {
  const cacheKey = `analytics:daily:${channelId}:${period}:${metric}`;
  const cached = await getCache(cacheKey);
  if (cached) return cached;

  const days = parsePeriod(period);
  const endDate = new Date();
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const metricField =
    {
      views: 'metrics.views',
      subscribers: 'metrics.subscribersGained',
      likes: 'metrics.likes',
      comments: 'metrics.comments',
      impressions: 'metrics.impressions',
      ctr: 'metrics.impressionsCtr',
      watchTime: 'metrics.estimatedMinutesWatched',
      revenue: 'metrics.estimatedRevenue',
    }[metric] || 'metrics.views';

  const data = await ChannelAnalytics.find({
    channelId: require('mongoose').Types.ObjectId.createFromHexString(channelId),
    date: { $gte: startDate, $lte: endDate },
  })
    .sort({ date: 1 })
    .select(`date ${metricField}`)
    .lean();

  const result = {
    metric,
    period,
    data: data.map((d) => ({
      date: d.date.toISOString().split('T')[0],
      value: getNestedValue(d, metricField) || 0,
    })),
  };

  await setCache(cacheKey, result, 30 * 60);
  return result;
};

// ==================== GET DAY-WISE PERFORMANCE ====================
// Aggregates performance by day of week
/**
 * @param {string} userId
 * @param {string} channelId
 * @param {Period} [period]
 * @returns {Promise<object>}
 */
const getDayWisePerformance = async (userId, channelId, period = '90d') => {
  const cacheKey = `analytics:daywise:${channelId}:${period}`;
  const cached = await getCache(cacheKey);
  if (cached) return cached;

  const days = parsePeriod(period);
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const data = await ChannelAnalytics.aggregate([
    {
      $match: {
        channelId: require('mongoose').Types.ObjectId.createFromHexString(channelId),
        date: { $gte: startDate },
      },
    },
    {
      $group: {
        _id: { $dayOfWeek: '$date' }, // 1=Sun, 2=Mon, ..., 7=Sat
        avgViews: { $avg: '$metrics.views' },
        totalViews: { $sum: '$metrics.views' },
        avgSubscribers: { $avg: '$metrics.subscribersGained' },
        avgCtr: { $avg: '$metrics.impressionsCtr' },
        dataPoints: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  const dayNames = [
    '',
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
  ];

  const result = {
    period,
    data: dayNames.slice(1).map((name, i) => {
      const found = data.find((d) => d._id === i + 1);
      return {
        day: name,
        dayShort: name.slice(0, 3),
        dayIndex: i,
        avgViews: Math.round(found?.avgViews || 0),
        totalViews: found?.totalViews || 0,
        avgSubscribers: Math.round(found?.avgSubscribers || 0),
        avgCtr: parseFloat((found?.avgCtr || 0).toFixed(2)),
        dataPoints: found?.dataPoints || 0,
      };
    }),
  };

  // Find best and worst days
  const sorted = [...result.data].sort((a, b) => b.avgViews - a.avgViews);
  result.bestDay = sorted[0];
  result.worstDay = sorted[sorted.length - 1];

  await setCache(cacheKey, result, 60 * 60); // 1 hour cache
  return result;
};

// ==================== GET TOP VIDEOS ====================
/**
 * @param {string} userId
 * @param {string} channelId
 * @param {number} [limit]
 * @param {string} [sortBy]
 * @returns {Promise<object>}
 */
const getTopVideos = async (userId, channelId, limit = 10, sortBy = 'views') => {
  const cacheKey = `analytics:topvideos:${channelId}:${limit}:${sortBy}`;
  const cached = await getCache(cacheKey);
  if (cached) return cached;

  const sortField =
    {
      views: 'performance.views',
      ctr: 'performance.ctr',
      likes: 'performance.likes',
      comments: 'performance.comments',
      revenue: 'performance.revenue',
      duration: 'performance.avgViewDuration',
    }[sortBy] || 'performance.views';

  const videos = await Video.find({
    userId,
    channelId: require('mongoose').Types.ObjectId.createFromHexString(channelId),
    status: 'published',
    youtubeVideoId: { $exists: true },
  })
    .sort({ [sortField]: -1 })
    .limit(limit)
    .select('title thumbnail youtubeVideoId publishedAt performance isShort')
    .lean();

  const result = {
    sortBy,
    videos: videos.map((v) => ({
      ...v,
      watchUrl: `https://www.youtube.com/watch?v=${v.youtubeVideoId}`,
    })),
  };

  await setCache(cacheKey, result, 30 * 60);
  return result;
};

// ==================== GET PER VIDEO BREAKDOWN ====================
/**
 * @param {string} userId
 * @param {string} videoId
 * @returns {Promise<object>}
 */
const getVideoBreakdown = async (userId, videoId) => {
  const cacheKey = `analytics:video:${videoId}`;
  const cached = await getCache(cacheKey);
  if (cached) return cached;

  const video = await Video.findOne({ _id: videoId, userId }).populate(
    'channelId',
    'channelName thumbnail analyticsMode'
  );

  if (!video) {
    const err = new Error('Video not found');
    err.statusCode = 404;
    throw err;
  }

  // Get daily breakdown. Bounded to on/after the video's own publish (or, if
  // not yet published, creation) date -- the {youtubeVideoId, date} unique
  // index is global across the whole collection, not scoped per videoId, so
  // stray rows from an earlier now-defunct video sharing this same document
  // slot (e.g. repeated re-upload/delete cycles during testing) could
  // otherwise surface as pre-publish-date data that was never really this
  // video's, silently defeating the hasNoDailyData banner on the frontend.
  //
  // Also capped at 1 year back even for older videos -- this page has no
  // period selector (unlike the channel-level Analytics page's 7/30/90/365d
  // tabs), so an old video (e.g. published years ago) would otherwise render
  // a "Daily Performance" chart spanning its entire multi-year lifetime,
  // crushing every real recent data point into a sliver at one edge. 1 year
  // matches the largest window the rest of the app offers anywhere.
  const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
  const publishedOrCreated = video.publishedAt || video.createdAt;
  const sinceDate = publishedOrCreated > oneYearAgo ? publishedOrCreated : oneYearAgo;
  let dailyData = await VideoAnalytics.find({ videoId, date: { $gte: sinceDate } })
    .sort({ date: 1 })
    .lean();

  // Lazy sync: this video hasn't had its per-day breakdown pulled yet
  // (e.g. it wasn't in the top-N videos synced by the channel-wide sync).
  // Fetch it on demand so the page isn't permanently empty.
  if (dailyData.length === 0 && video.youtubeVideoId) {
    try {
      const channel = await YoutubeChannel.findOne({
        _id: video.channelId._id || video.channelId,
        userId,
        isActive: true,
      }).select('+oauth.accessToken +oauth.refreshToken +oauth.expiresAt');
      if (channel) {
        const accessToken = await getValidAccessToken(channel);
        const endDate = new Date().toISOString().split('T')[0];
        // Same 1-year-capped lower bound as the query above -- no point
        // asking the YouTube API for years of daily data this page will
        // never display.
        const startDate = sinceDate.toISOString().split('T')[0];
        await syncVideoAnalyticsBatch(
          channel,
          accessToken,
          userId,
          [{ _id: video._id, youtubeVideoId: video.youtubeVideoId }],
          startDate,
          endDate
        );
        // Same lower date bound as the initial query above -- this re-fetch
        // must not reintroduce pre-publish-date rows either.
        dailyData = await VideoAnalytics.find({ videoId, date: { $gte: sinceDate } })
          .sort({ date: 1 })
          .lean();
      }
    } catch (err) {
      logger.error('[analytics] on-demand video sync failed', { error: err.message });
    }
  }

  // Aggregate totals from the daily (YouTube Analytics API) breakdown —
  // used below for watchTime/comments/impressions/revenue, which have no
  // Data API equivalent. views/likes are overridden right after with the
  // Data API's lifetime totals instead (see comment below) — kept here only
  // so the reduce shape stays uniform.
  const totals = dailyData.reduce(
    (acc, d) => ({
      views: acc.views + (d.metrics.views || 0),
      watchTime: acc.watchTime + (d.metrics.estimatedMinutesWatched || 0),
      likes: acc.likes + (d.metrics.likes || 0),
      comments: acc.comments + (d.metrics.comments || 0),
      impressions: acc.impressions + (d.metrics.impressions || 0),
      revenue: acc.revenue + (d.metrics.estimatedRevenue || 0),
    }),
    { views: 0, watchTime: 0, likes: 0, comments: 0, impressions: 0, revenue: 0 }
  );

  // Views/likes: use the YouTube Data API's lifetime totals (same source
  // Videos.jsx's list already reads via video.performance.views/likes),
  // NOT the Analytics-API daily sum above. The Analytics API has YouTube's
  // own well-known 24-48h reporting lag on recent days, so summing it
  // undercounts against the real total — this was surfacing as the same
  // video showing two different view/like counts on two different Vezrin
  // pages. This page has no period selector (always effectively lifetime,
  // capped at 1yr for old videos), so the Data API's lifetime count is the
  // semantically correct source, not just a convenient patch. watchTime/
  // impressions/CTR/revenue genuinely have no Data API equivalent and stay
  // sourced from the daily breakdown.
  totals.views = video.performance?.views || 0;
  totals.likes = video.performance?.likes || 0;

  const result = {
    video: {
      _id: video._id,
      title: video.title,
      thumbnail: video.thumbnail,
      youtubeVideoId: video.youtubeVideoId,
      status: video.status,
      publishedAt: video.publishedAt,
      scheduledAt: video.scheduledAt,
      channel: video.channelId,
    },
    totals: {
      ...totals,
      avgCtr: dailyData.length
        ? dailyData.reduce((s, d) => s + d.metrics.impressionsCtr, 0) / dailyData.length
        : 0,
      avgViewDuration: dailyData.length
        ? dailyData.reduce((s, d) => s + d.metrics.averageViewDuration, 0) / dailyData.length
        : 0,
    },
    daily: dailyData.map((d) => ({
      date: d.date.toISOString().split('T')[0],
      views: d.metrics.views,
      watchTime: d.metrics.estimatedMinutesWatched,
      likes: d.metrics.likes,
      ctr: d.metrics.impressionsCtr,
    })),
  };

  await setCache(cacheKey, result, 30 * 60);
  return result;
};

// ==================== GET TRAFFIC SOURCES ====================
/**
 * @param {string} userId
 * @param {string} channelId
 * @param {Period} [period]
 * @returns {Promise<object>}
 */
const getTrafficSources = async (userId, channelId, period = '30d') => {
  const days = parsePeriod(period);
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const data = await ChannelAnalytics.aggregate([
    {
      $match: {
        channelId: require('mongoose').Types.ObjectId.createFromHexString(channelId),
        date: { $gte: startDate },
      },
    },
    {
      $group: {
        _id: null,
        browse: { $sum: '$trafficSources.browseFeatures' },
        search: { $sum: '$trafficSources.ytSearch' },
        suggested: { $sum: '$trafficSources.suggested' },
        external: { $sum: '$trafficSources.external' },
        notification: { $sum: '$trafficSources.notification' },
        playlist: { $sum: '$trafficSources.playlist' },
        other: { $sum: '$trafficSources.other' },
      },
    },
  ]);

  const d = data[0] || {};
  const total =
    Object.values(d)
      .filter((v) => typeof v === 'number')
      .reduce((a, b) => a + b, 0) || 1;

  return {
    period,
    sources: [
      { name: 'Browse Features', value: d.browse || 0, percentage: pct(d.browse, total) },
      { name: 'YouTube Search', value: d.search || 0, percentage: pct(d.search, total) },
      { name: 'Suggested Videos', value: d.suggested || 0, percentage: pct(d.suggested, total) },
      { name: 'External', value: d.external || 0, percentage: pct(d.external, total) },
      { name: 'Notifications', value: d.notification || 0, percentage: pct(d.notification, total) },
      { name: 'Playlist', value: d.playlist || 0, percentage: pct(d.playlist, total) },
      { name: 'Other', value: d.other || 0, percentage: pct(d.other, total) },
    ].sort((a, b) => b.value - a.value),
    total,
  };
};

// ==================== HELPERS ====================
const parsePeriod = (period) => {
  const map = { '7d': 7, '30d': 30, '90d': 90, '180d': 180, '365d': 365 };
  return map[period] || 30;
};

const calcChange = (current = 0, previous = 0) => {
  if (!previous) return null; // no previous period data — don't show misleading %
  return parseFloat((((current - previous) / previous) * 100).toFixed(1));
};

const getTrend = (current, previous) => {
  const change = calcChange(current, previous);
  if (change > 5) return 'up';
  if (change < -5) return 'down';
  return 'stable';
};

const formatWatchTime = (minutes) => {
  if (minutes >= 1440) return `${(minutes / 1440).toFixed(1)} days`;
  if (minutes >= 60) return `${(minutes / 60).toFixed(1)} hrs`;
  return `${minutes} min`;
};

const formatSeconds = (seconds) => {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};

const pct = (val = 0, total = 1) => parseFloat(((val / total) * 100).toFixed(1));

const getNestedValue = (obj, path) => {
  return path.split('.').reduce((acc, key) => acc?.[key], obj);
};

module.exports = {
  syncChannelAnalytics,
  syncChannelVideos,
  getOverview,
  getDailyGraph,
  getDayWisePerformance,
  getTopVideos,
  getVideoBreakdown,
  getTrafficSources,
  invalidateAnalyticsCache,
};
