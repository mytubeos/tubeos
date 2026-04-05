// src/services/heatmap.service.js
// Time Intelligence System
// Builds 7x24 heatmap + best/worst time detection

const { Heatmap, ChannelAnalytics } = require('../models/analytics.model');
const Video = require('../models/video.model');
const YoutubeChannel = require('../models/youtube-channel.model');
const { getValidAccessToken } = require('./youtube.service');
const { setCache, getCache } = require('../config/redis');

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// ==================== BUILD HEATMAP ====================
const buildHeatmap = async (userId, channelId) => {
  const channel = await YoutubeChannel.findOne({ _id: channelId, userId, isActive: true })
    .select('+oauth.accessToken +oauth.refreshToken +oauth.expiresAt');

  if (!channel) {
    const err = new Error('Channel not found');
    err.statusCode = 404;
    throw err;
  }

  // Try YouTube Analytics API first (real audience activity)
  let grid = null;
  let dataSource = 'default';
  let dataPoints = 0;

  try {
    const accessToken = await getValidAccessToken(channel);
    const result = await buildHeatmapFromYouTube(accessToken, channelId);
    if (result.dataPoints >= 10) {
      grid = result.grid;
      dataSource = 'youtube_analytics';
      dataPoints = result.dataPoints;
    }
  } catch (err) {
    console.error('YouTube heatmap fetch failed, using fallback:', err.message);
  }

  // Fallback: Build from our own video performance data
  if (!grid) {
    const result = await buildHeatmapFromVideoData(userId, channelId);
    grid = result.grid;
    dataSource = result.dataSource;
    dataPoints = result.dataPoints;
  }

  // Normalize grid to 0-100 scale
  const normalizedGrid = normalizeGrid(grid);

  // Extract best + worst slots
  const allSlots = extractAllSlots(normalizedGrid);
  const bestSlots = allSlots.slice(0, 10);  // Top 10
  const worstSlots = allSlots.slice(-10);   // Bottom 10

  // Confidence level
  const confidence = dataPoints >= 100 ? 'high'
    : dataPoints >= 30 ? 'medium' : 'low';

  // Save to DB
  const heatmap = await Heatmap.findOneAndUpdate(
    { channelId },
    {
      $set: {
        userId,
        channelId,
        grid: normalizedGrid,
        bestSlots,
        worstSlots,
        dataPoints,
        confidence,
        basedOnDays: Math.min(dataPoints, 90),
        calculatedAt: new Date(),
        nextRecalcAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Recalc weekly
      },
    },
    { upsert: true, new: true }
  );

  // Update channel bestTimeData
  const bestDays = [...new Set(bestSlots.slice(0, 5).map(s => DAY_NAMES[s.day].toLowerCase()))];
  const bestHours = [...new Set(bestSlots.slice(0, 5).map(s => s.hour))].sort((a, b) => a - b);

  await YoutubeChannel.findByIdAndUpdate(channelId, {
    'bestTimeData.lastCalculatedAt': new Date(),
    'bestTimeData.bestDays': bestDays,
    'bestTimeData.bestHours': bestHours,
    'bestTimeData.heatmapData': { grid: normalizedGrid, dataSource },
  });

  // Clear cache
  await setCache(`heatmap:${channelId}`, null, 1);

  return {
    heatmap,
    dataSource,
    message: `Heatmap built from ${dataPoints} data points (${confidence} confidence)`,
  };
};

// ==================== BUILD FROM YOUTUBE ANALYTICS ====================
const buildHeatmapFromYouTube = async (accessToken, channelId) => {
  // YouTube Analytics: audience activity by hour and day
  const endDate = new Date().toISOString().split('T')[0];
  const startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
    .toISOString().split('T')[0];

  const url = new URL('https://youtubeanalytics.googleapis.com/v2/reports');
  url.searchParams.set('ids', 'channel==MINE');
  url.searchParams.set('startDate', startDate);
  url.searchParams.set('endDate', endDate);
  url.searchParams.set('metrics', 'views');
  url.searchParams.set('dimensions', 'day');

  const response = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) throw new Error('YouTube Analytics API error');

  const data = await response.json();
  const rows = data.rows || [];

  // Build grid from day-of-week patterns
  const grid = Array(7).fill(null).map(() => Array(24).fill(0));
  const counts = Array(7).fill(null).map(() => Array(24).fill(0));

  rows.forEach(([dateStr, views]) => {
    const date = new Date(dateStr);
    const day = date.getDay();
    // Use hour distribution approximation (peak hours model)
    distributeViewsByHour(grid, counts, day, views);
  });

  // Average out
  for (let d = 0; d < 7; d++) {
    for (let h = 0; h < 24; h++) {
      if (counts[d][h] > 0) {
        grid[d][h] = grid[d][h] / counts[d][h];
      }
    }
  }

  return { grid, dataPoints: rows.length };
};

// ==================== BUILD FROM VIDEO PERFORMANCE DATA ====================
const buildHeatmapFromVideoData = async (userId, channelId) => {
  // Analyze when our published videos performed best
  const videos = await Video.find({
    userId,
    channelId,
    status: 'published',
    publishedAt: { $exists: true },
    'performance.views': { $gt: 0 },
  })
    .select('publishedAt performance')
    .lean();

  if (videos.length === 0) {
    return { grid: getDefaultGrid(), dataSource: 'india_defaults', dataPoints: 0 };
  }

  const grid = Array(7).fill(null).map(() => Array(24).fill(0));
  const counts = Array(7).fill(null).map(() => Array(24).fill(0));

  videos.forEach(video => {
    const publishDate = new Date(video.publishedAt);
    const day = publishDate.getDay();
    const hour = publishDate.getHours();
    const score = video.performance.views + (video.performance.likes * 10);

    grid[day][hour] += score;
    counts[day][hour]++;
  });

  // Average
  for (let d = 0; d < 7; d++) {
    for (let h = 0; h < 24; h++) {
      if (counts[d][h] > 0) grid[d][h] = grid[d][h] / counts[d][h];
    }
  }

  return {
    grid,
    dataSource: 'video_performance',
    dataPoints: videos.length,
  };
};

// ==================== GET HEATMAP ====================
const getHeatmap = async (userId, channelId) => {
  const cacheKey = `heatmap:${channelId}`;
  const cached = await getCache(cacheKey);
  if (cached) return cached;

  let heatmap = await Heatmap.findOne({ channelId });

  // Build if doesn't exist or stale (7+ days old)
  if (!heatmap || !heatmap.nextRecalcAt || new Date() > heatmap.nextRecalcAt) {
    try {
      const built = await buildHeatmap(userId, channelId);
      heatmap = built.heatmap;
    } catch (err) {
      // Return default if build fails
      console.error('Heatmap build failed:', err.message);
    }
  }

  if (!heatmap) {
    return getDefaultHeatmapResponse(channelId);
  }

  const result = formatHeatmapResponse(heatmap);
  await setCache(cacheKey, result, 6 * 60 * 60); // 6 hour cache
  return result;
};

// ==================== GET BEST TIME SLOTS ====================
const getBestTimeSlots = async (userId, channelId, count = 5) => {
  const heatmapData = await getHeatmap(userId, channelId);

  const nextSlots = generateNextSlots(
    heatmapData.bestSlots || [],
    count
  );

  return {
    channelId,
    bestSlots: heatmapData.bestSlots?.slice(0, count) || [],
    nextOptimalSlots: nextSlots,
    confidence: heatmapData.confidence,
    message: heatmapData.confidence === 'high'
      ? 'Based on your actual audience activity data'
      : 'Based on market research — connect more data for personalized insights',
  };
};

// ==================== GET LOW TRAFFIC HOURS ====================
const getLowTrafficHours = async (userId, channelId) => {
  const heatmapData = await getHeatmap(userId, channelId);

  return {
    channelId,
    avoidSlots: heatmapData.worstSlots?.slice(0, 5) || [],
    avoidDays: getWorstDays(heatmapData.grid || []),
    message: 'Avoid posting during these times for maximum reach',
  };
};

// ==================== HELPERS ====================

const normalizeGrid = (grid) => {
  let max = 0;
  grid.forEach(row => row.forEach(val => { if (val > max) max = val; }));
  if (max === 0) return grid;

  return grid.map(row => row.map(val => Math.round((val / max) * 100)));
};

const extractAllSlots = (grid) => {
  const slots = [];
  for (let d = 0; d < 7; d++) {
    for (let h = 0; h < 24; h++) {
      slots.push({
        day: d,
        dayName: DAY_NAMES[d].toLowerCase(),
        hour: h,
        score: grid[d][h],
        label: formatHour(h),
      });
    }
  }
  return slots.sort((a, b) => b.score - a.score);
};

const formatHour = (hour) => {
  const period = hour >= 12 ? 'PM' : 'AM';
  const h = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${h}:00 ${period}`;
};

const formatHeatmapResponse = (heatmap) => ({
  channelId: heatmap.channelId,
  grid: heatmap.grid,
  bestSlots: heatmap.bestSlots,
  worstSlots: heatmap.worstSlots,
  confidence: heatmap.confidence,
  dataPoints: heatmap.dataPoints,
  calculatedAt: heatmap.calculatedAt,
  nextRecalcAt: heatmap.nextRecalcAt,
  dayLabels: DAY_NAMES,
  hourLabels: Array.from({ length: 24 }, (_, i) => formatHour(i)),
});

const getDefaultGrid = () => {
  // India-researched defaults
  const grid = Array(7).fill(null).map(() => Array(24).fill(10));
  // Boost evening hours (6PM-10PM IST)
  [0, 5, 6].forEach(d => [18, 19, 20, 21].forEach(h => { grid[d][h] = 90; }));
  [1, 2, 3, 4].forEach(d => [19, 20, 21].forEach(h => { grid[d][h] = 60; }));
  // Low traffic (midnight-6AM)
  Array.from({ length: 7 }, (_, d) =>
    [0, 1, 2, 3, 4, 5].forEach(h => { grid[d][h] = 5; })
  );
  return grid;
};

const getDefaultHeatmapResponse = (channelId) => ({
  channelId,
  grid: getDefaultGrid(),
  bestSlots: [
    { day: 6, dayName: 'saturday', hour: 19, score: 90, label: '7:00 PM' },
    { day: 0, dayName: 'sunday', hour: 18, score: 88, label: '6:00 PM' },
    { day: 5, dayName: 'friday', hour: 20, score: 85, label: '8:00 PM' },
  ],
  worstSlots: [
    { day: 1, dayName: 'monday', hour: 3, score: 5, label: '3:00 AM' },
    { day: 2, dayName: 'tuesday', hour: 4, score: 5, label: '4:00 AM' },
  ],
  confidence: 'low',
  dataPoints: 0,
  calculatedAt: new Date(),
  dayLabels: DAY_NAMES,
  hourLabels: Array.from({ length: 24 }, (_, i) => formatHour(i)),
  note: 'Default India market data — build more videos for personalized heatmap',
});

const generateNextSlots = (bestSlots, count) => {
  const now = new Date();
  const slots = [];

  for (let daysAhead = 0; daysAhead <= 14 && slots.length < count; daysAhead++) {
    const date = new Date(now);
    date.setDate(date.getDate() + daysAhead);
    const dayOfWeek = date.getDay();

    const daySlots = bestSlots
      .filter(s => s.day === dayOfWeek)
      .slice(0, 2);

    daySlots.forEach(slot => {
      const slotDate = new Date(date);
      slotDate.setHours(slot.hour, 0, 0, 0);
      if (slotDate > now && slots.length < count) {
        slots.push({
          datetime: slotDate.toISOString(),
          day: DAY_NAMES[slot.day],
          time: slot.label,
          score: slot.score,
        });
      }
    });
  }

  return slots;
};

const getWorstDays = (grid) => {
  const dayTotals = grid.map((row, i) => ({
    day: DAY_NAMES[i],
    total: row.reduce((a, b) => a + b, 0),
  }));
  return dayTotals.sort((a, b) => a.total - b.total).slice(0, 3).map(d => d.day);
};

const distributeViewsByHour = (grid, counts, day, totalViews) => {
  // Approximated India viewership pattern
  const hourWeights = [
    2, 1, 1, 1, 1, 2, 3, 5, 7, 8, 8, 9,    // 12AM-11AM
    9, 8, 8, 7, 8, 10, 12, 14, 13, 11, 8, 4  // 12PM-11PM
  ];
  const totalWeight = hourWeights.reduce((a, b) => a + b, 0);

  hourWeights.forEach((weight, hour) => {
    const viewsForHour = (weight / totalWeight) * totalViews;
    grid[day][hour] += viewsForHour;
    counts[day][hour]++;
  });
};

module.exports = {
  buildHeatmap,
  getHeatmap,
  getBestTimeSlots,
  getLowTrafficHours,
};
