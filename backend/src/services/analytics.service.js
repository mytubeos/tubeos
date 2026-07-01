// src/services/analytics.service.js
// Fetches + aggregates analytics data
// Syncs from YouTube Analytics API + serves dashboard data

const { ChannelAnalytics, VideoAnalytics } = require('../models/analytics.model');
const Video = require('../models/video.model');
const YoutubeChannel = require('../models/youtube-channel.model');
const { getValidAccessToken, invalidateChannelCache } = require('./youtube.service');
const { youtubeRequest } = require('../config/youtube.config');
const { setCache, getCache, deleteCache } = require('../config/redis');

// ==================== SYNC CHANNEL VIDEOS ====================
// Imports all existing YouTube channel videos into the Video collection.
// Called on channel connect and every time user clicks Sync.
const syncChannelVideos = async (channel, accessToken, userId) => {
  try {
    // 1. Get uploads playlist ID
    const channelData = await youtubeRequest(
      `/channels?part=contentDetails&mine=true`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const uploadsPlaylistId = channelData.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
    if (!uploadsPlaylistId) return 0;

    // 2. Fetch video IDs from uploads playlist (max 200 videos, 50 per page)
    const allVideoIds = [];
    let pageToken = null;

    do {
      const url = `/playlistItems?part=contentDetails&playlistId=${uploadsPlaylistId}&maxResults=50${pageToken ? `&pageToken=${pageToken}` : ''}`;
      const data = await youtubeRequest(url, { headers: { Authorization: `Bearer ${accessToken}` } });
      (data.items || []).forEach(item => {
        if (item.contentDetails?.videoId) allVideoIds.push(item.contentDetails.videoId);
      });
      pageToken = data.nextPageToken || null;
    } while (pageToken && allVideoIds.length < 200);

    if (allVideoIds.length === 0) return 0;

    // 3. Fetch video details + stats in batches of 50
    let totalSynced = 0;

    for (let i = 0; i < allVideoIds.length; i += 50) {
      const batch = allVideoIds.slice(i, i + 50);
      const videosData = await youtubeRequest(
        `/videos?part=snippet,statistics,contentDetails,status&id=${batch.join(',')}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      const bulkOps = (videosData.items || []).map(video => {
        const thumbs = video.snippet?.thumbnails;
        const thumbUrl = thumbs?.maxres?.url || thumbs?.high?.url || thumbs?.medium?.url || thumbs?.default?.url || null;
        const duration = parseDuration(video.contentDetails?.duration || '');
        const isShort = duration > 0 && duration <= 60;

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
                status: 'published',
                publishedAt: video.snippet?.publishedAt ? new Date(video.snippet.publishedAt) : null,
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

    console.log(`[analytics] syncChannelVideos: imported ${totalSynced} videos for channel ${channel._id}`);
    return totalSynced;
  } catch (err) {
    console.error('[analytics] syncChannelVideos failed:', err.message);
    return 0;
  }
};

// Parse ISO 8601 duration to seconds: "PT1M30S" -> 90
const parseDuration = (iso) => {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  return (parseInt(match[1] || 0) * 3600) + (parseInt(match[2] || 0) * 60) + parseInt(match[3] || 0);
};

// Clears all analytics caches for a channel so next request gets fresh DB data
const invalidateAnalyticsCache = async (channelId) => {
  const periods = ['7d', '30d', '90d'];
  const metrics = ['views', 'subscribers', 'likes', 'comments', 'watchTime', 'ctr'];
  await Promise.all([
    ...periods.map(p => deleteCache(`analytics:overview:${channelId}:${p}`)),
    ...periods.flatMap(p => metrics.map(m => deleteCache(`analytics:daily:${channelId}:${p}:${m}`))),
    deleteCache(`analytics:topvideos:${channelId}:5:views`),
    deleteCache(`analytics:topvideos:${channelId}:10:views`),
  ]);
};

// ==================== SYNC CHANNEL ANALYTICS ====================
// Fetches last N days of analytics from YouTube API
const syncChannelAnalytics = async (channelId, userId, days = 30) => {
  const channel = await YoutubeChannel.findOne({ _id: channelId, userId, isActive: true })
    .select('+oauth.accessToken +oauth.refreshToken +oauth.expiresAt');

  if (!channel) {
    const err = new Error('Channel not found');
    err.statusCode = 404;
    throw err;
  }

  const accessToken = await getValidAccessToken(channel);

  // Date range
  const endDate = new Date().toISOString().split('T')[0];
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    .toISOString().split('T')[0];

  // Fetch from YouTube Analytics API
  const analyticsUrl = new URL('https://youtubeanalytics.googleapis.com/v2/reports');
  analyticsUrl.searchParams.set('ids', `channel==MINE`);
  analyticsUrl.searchParams.set('startDate', startDate);
  analyticsUrl.searchParams.set('endDate', endDate);
  analyticsUrl.searchParams.set('metrics', [
    'views', 'estimatedMinutesWatched', 'averageViewDuration',
    'averageViewPercentage', 'subscribersGained', 'subscribersLost',
    'likes', 'comments', 'shares', 'impressions', 'impressionsCtr',
    // estimatedRevenue removed — requires yt-analytics-monetary.readonly scope
  ].join(','));
  analyticsUrl.searchParams.set('dimensions', 'day');
  analyticsUrl.searchParams.set('sort', 'day');

  const response = await fetch(analyticsUrl.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    if (response.status === 403) {
      // Analytics API needs yt-analytics scope — fall back to YouTube Data API (youtube.readonly)
      console.log('[analytics] Analytics API 403:', JSON.stringify(error?.error || error));
      const synced = await syncFromVideoStats(channel, accessToken, startDate, endDate, userId);
      await syncChannelVideos(channel, accessToken, userId);
      await YoutubeChannel.findByIdAndUpdate(channel._id, { analyticsMode: 'basic' });
      await invalidateAnalyticsCache(channelId);
      return { synced, message: `Synced ${synced} days of data (basic mode — views, likes, comments)` };
    }
    const err = new Error(error.error?.message || 'Failed to fetch analytics');
    err.statusCode = response.status;
    throw err;
  }

  const data = await response.json();
  const rows = data.rows || [];
  const headers = data.columnHeaders?.map(h => h.name) || [];

  // Upsert each day's data
  const bulkOps = rows.map(row => {
    const record = {};
    headers.forEach((h, i) => { record[h] = row[i]; });

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
            'metrics.impressions': record.impressions || 0,
            'metrics.impressionsCtr': record.impressionsCtr || 0,
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

  // Import/update all channel videos with latest stats
  await syncChannelVideos(channel, accessToken, userId);

  await YoutubeChannel.findByIdAndUpdate(channel._id, { analyticsMode: 'full' });
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
    console.error('Traffic sources sync failed:', err.message);
  }
};

// ==================== FALLBACK: SYNC FROM VIDEO STATS (youtube.readonly scope) ====================
// Used when Analytics API returns 403 (missing yt-analytics scope on stored token).
// Fetches ALL video stats and writes aggregate into today's ChannelAnalytics row.
// NOTE: Old code filtered by publishedAt (last 30 days) so old channels always got 0.
const syncFromVideoStats = async (channel, accessToken, startDate, endDate, userId) => {
  try {
    // 1. Get uploads playlist ID
    const channelData = await youtubeRequest(
      `/channels?part=contentDetails,statistics&mine=true`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const uploadsId = channelData.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
    const channelStats = channelData.items?.[0]?.statistics || {};

    // Save fresh subscriber/view counts to YoutubeChannel so dashboard always shows latest
    await YoutubeChannel.findByIdAndUpdate(channel._id, {
      'stats.subscriberCount': parseInt(channelStats.subscriberCount) || 0,
      'stats.viewCount':       parseInt(channelStats.viewCount)       || 0,
      'stats.videoCount':      parseInt(channelStats.videoCount)      || 0,
      'stats.lastSyncedAt':    new Date(),
    });
    await invalidateChannelCache(userId);

    const today = new Date().toISOString().split('T')[0];

    if (!uploadsId) {
      // At minimum write channel-level subscriber count
      await ChannelAnalytics.findOneAndUpdate(
        { channelId: channel._id, date: new Date(today) },
        {
          $set: {
            userId,
            channelId: channel._id,
            date: new Date(today),
            'metrics.views': parseInt(channelStats.viewCount) || 0,
            'metrics.subscribersGained': parseInt(channelStats.subscriberCount) || 0,
          },
        },
        { upsert: true }
      );
      return 1;
    }

    // 2. Fetch ALL videos from uploads playlist (no date filter — old code was wrong here)
    const playlistData = await youtubeRequest(
      `/playlistItems?part=contentDetails&playlistId=${uploadsId}&maxResults=50`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    const allItems = playlistData.items || [];

    // 3. Get stats for all videos
    const videoIds = allItems.map(i => i.contentDetails.videoId).filter(Boolean).slice(0, 50);

    let totalViews = 0, totalLikes = 0, totalComments = 0, totalEstimatedMinutes = 0;

    if (videoIds.length > 0) {
      const statsData = await youtubeRequest(
        `/videos?part=statistics,contentDetails&id=${videoIds.join(',')}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      for (const video of (statsData.items || [])) {
        const views    = parseInt(video.statistics?.viewCount)    || 0;
        const durationSec = parseDuration(video.contentDetails?.duration || 'PT0S');
        totalViews    += views;
        totalLikes    += parseInt(video.statistics?.likeCount)    || 0;
        totalComments += parseInt(video.statistics?.commentCount) || 0;
        totalEstimatedMinutes += Math.round(views * (durationSec / 60) * 0.4);
      }
    }

    // 4. Write aggregate into today's ChannelAnalytics row
    await ChannelAnalytics.findOneAndUpdate(
      { channelId: channel._id, date: new Date(today) },
      {
        $set: {
          userId,
          channelId: channel._id,
          date: new Date(today),
          'metrics.views':                   totalViews,
          'metrics.likes':                   totalLikes,
          'metrics.comments':                totalComments,
          'metrics.estimatedMinutesWatched': totalEstimatedMinutes,
        },
      },
      { upsert: true }
    );

    return 1;
  } catch (err) {
    console.error('[analytics] Video stats fallback failed:', err.message);
    return 0;
  }
};

// ==================== GET OVERVIEW (Main Dashboard) ====================
const getOverview = async (userId, channelId, period = '30d') => {
  const cacheKey = `analytics:overview:${channelId}:${period}`;
  const cached = await getCache(cacheKey);
  if (cached) return cached;

  const days = parsePeriod(period);
  const endDate = new Date();
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const prevStartDate = new Date(startDate - days * 24 * 60 * 60 * 1000);

  const [current, previous] = await Promise.all([
    ChannelAnalytics.aggregate([
      {
        $match: {
          channelId: require('mongoose').Types.ObjectId.createFromHexString(channelId),
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
          channelId: require('mongoose').Types.ObjectId.createFromHexString(channelId),
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

  // Fallback: if no ChannelAnalytics data, sum from Video.performance
  // This happens when user has no yt-analytics scope and fallback sync hasn't run yet
  if (!curr.totalViews && !curr.totalLikes) {
    const mongoose = require('mongoose');
    const videoFallback = await Video.aggregate([
      {
        $match: {
          channelId: mongoose.Types.ObjectId.createFromHexString(channelId),
          status: 'published',
          'performance.lastSyncedAt': { $exists: true },
        },
      },
      {
        $group: {
          _id: null,
          totalViews:    { $sum: '$performance.views' },
          totalLikes:    { $sum: '$performance.likes' },
          totalComments: { $sum: '$performance.comments' },
        },
      },
    ]);
    if (videoFallback[0]?.totalViews) {
      curr = {
        totalViews:         videoFallback[0].totalViews,
        totalLikes:         videoFallback[0].totalLikes,
        totalComments:      videoFallback[0].totalComments,
        totalWatchTime:     0,
        subscribersGained:  0,
        subscribersLost:    0,
        totalImpressions:   0,
        avgCtr:             0,
        avgViewDuration:    0,
        totalRevenue:       0,
      };
    }
  }

  const result = {
    period,
    metrics: {
      views: {
        value: curr.totalViews || 0,
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
const getDailyGraph = async (userId, channelId, period = '30d', metric = 'views') => {
  const cacheKey = `analytics:daily:${channelId}:${period}:${metric}`;
  const cached = await getCache(cacheKey);
  if (cached) return cached;

  const days = parsePeriod(period);
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const metricField = {
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
    date: { $gte: startDate },
  })
    .sort({ date: 1 })
    .select(`date ${metricField}`)
    .lean();

  const result = {
    metric,
    period,
    data: data.map(d => ({
      date: d.date.toISOString().split('T')[0],
      value: getNestedValue(d, metricField) || 0,
    })),
  };

  await setCache(cacheKey, result, 30 * 60);
  return result;
};

// ==================== GET DAY-WISE PERFORMANCE ====================
// Aggregates performance by day of week
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

  const dayNames = ['', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  const result = {
    period,
    data: dayNames.slice(1).map((name, i) => {
      const found = data.find(d => d._id === i + 1);
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
const getTopVideos = async (userId, channelId, limit = 10, sortBy = 'views') => {
  const cacheKey = `analytics:topvideos:${channelId}:${limit}:${sortBy}`;
  const cached = await getCache(cacheKey);
  if (cached) return cached;

  const sortField = {
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
    videos: videos.map(v => ({
      ...v,
      watchUrl: `https://www.youtube.com/watch?v=${v.youtubeVideoId}`,
    })),
  };

  await setCache(cacheKey, result, 30 * 60);
  return result;
};

// ==================== GET PER VIDEO BREAKDOWN ====================
const getVideoBreakdown = async (userId, videoId) => {
  const cacheKey = `analytics:video:${videoId}`;
  const cached = await getCache(cacheKey);
  if (cached) return cached;

  const video = await Video.findOne({ _id: videoId, userId })
    .populate('channelId', 'channelName thumbnail');

  if (!video) {
    const err = new Error('Video not found');
    err.statusCode = 404;
    throw err;
  }

  // Get daily breakdown
  const dailyData = await VideoAnalytics.find({ videoId })
    .sort({ date: 1 })
    .lean();

  // Aggregate totals
  const totals = dailyData.reduce((acc, d) => ({
    views: acc.views + (d.metrics.views || 0),
    watchTime: acc.watchTime + (d.metrics.estimatedMinutesWatched || 0),
    likes: acc.likes + (d.metrics.likes || 0),
    comments: acc.comments + (d.metrics.comments || 0),
    impressions: acc.impressions + (d.metrics.impressions || 0),
    revenue: acc.revenue + (d.metrics.estimatedRevenue || 0),
  }), { views: 0, watchTime: 0, likes: 0, comments: 0, impressions: 0, revenue: 0 });

  const result = {
    video: {
      _id: video._id,
      title: video.title,
      thumbnail: video.thumbnail,
      youtubeVideoId: video.youtubeVideoId,
      publishedAt: video.publishedAt,
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
    daily: dailyData.map(d => ({
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
  const total = Object.values(d).filter(v => typeof v === 'number').reduce((a, b) => a + b, 0) || 1;

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
  if (!previous) return current > 0 ? 100 : 0;
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
};
