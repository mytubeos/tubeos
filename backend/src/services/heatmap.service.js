// src/services/heatmap.service.js
// Time Intelligence System
// Builds 7x24 heatmap + best/worst time detection

const { Heatmap, ChannelAnalytics } = require('../models/analytics.model');
const Video = require('../models/video.model');
const YoutubeChannel = require('../models/youtube-channel.model');
const Comment = require('../models/comment.model');
const { getValidAccessToken } = require('./youtube.service');
const { setCache, getCache } = require('../config/redis');
const logger = require('../config/logger');

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

  // Timezone for this channel. Comments are stored as absolute UTC instants, so
  // converting them to the creator's local timezone buckets a multi-country
  // audience correctly on its own — a US viewer's 8PM comment lands on the
  // matching creator-clock hour without needing per-viewer geography.
  const timeZone = getChannelTimeZone(channel);

  // Comment timestamps are the strongest ToS-safe hour-of-day signal available:
  // they mark when this channel's real audience is actually active. YouTube
  // Analytics has no "hour" dimension (only per-day view totals), so we use the
  // comment-activity shape to distribute those daily totals across hours —
  // preferring it over the older "when videos were published" proxy.
  const commentPattern = await buildHeatmapFromComments(channelId, timeZone);
  const hasCommentSignal = commentPattern.dataPoints >= 20;

  // Fallback hour signal: this channel's own video-performance-by-publish-hour.
  const videoPattern = await buildHeatmapFromVideoData(userId, channelId);
  const hasVideoSignal = videoPattern.dataPoints >= 5;

  // Best available hour-shape to spread real daily view totals across 24 hours.
  const hourShapeGrid = hasCommentSignal ? commentPattern.grid
    : hasVideoSignal ? videoPattern.grid
    : null;

  let grid = null;
  let dataSource = 'default';
  let dataPoints = 0;

  try {
    const accessToken = await getValidAccessToken(channel);
    const result = await buildHeatmapFromYouTube(accessToken, channelId, hourShapeGrid);
    if (result.dataPoints >= 10) {
      grid = result.grid;
      dataSource = hasCommentSignal ? 'youtube_analytics+comment_activity' : result.hourSource;
      dataPoints = result.dataPoints;
    }
  } catch (err) {
    logger.error('YouTube heatmap fetch failed, using fallback', { error: err.message });
  }

  // Fallbacks when YouTube Analytics daily totals aren't available:
  if (!grid) {
    if (hasCommentSignal) {
      // Comments alone give a real day AND hour distribution — best fallback.
      grid = commentPattern.grid;
      dataSource = 'comment_activity';
      dataPoints = commentPattern.dataPoints;
    } else {
      // Otherwise use our own video-performance pattern (indirect hour signal).
      grid = videoPattern.grid;
      dataSource = videoPattern.dataSource;
      dataPoints = videoPattern.dataPoints;
    }
  }

  const dataSourceNotes = {
    'youtube_analytics+comment_activity':
      'Daily totals are real audience view counts from YouTube Analytics; the hour-of-day shape is learned from when your audience actually comments (converted to your channel’s timezone) — a real engagement signal.',
    comment_activity:
      'Built from when your audience actually comments (converted to your channel’s timezone) — a real per-hour engagement signal. Connect full analytics access for real daily view totals too.',
    'youtube_analytics+own_video_pattern':
      'Daily totals are real audience view counts from YouTube Analytics; hour-of-day shape is learned from when your own videos performed best.',
    'youtube_analytics+estimated_pattern':
      'Daily totals are real audience view counts from YouTube Analytics; hour-of-day shape uses a general research pattern (post more videos for a personalized hour pattern).',
    video_performance:
      'Built from when your own published videos performed best — connect full analytics access for real daily view totals too.',
    india_defaults:
      'No channel data yet — showing general India market research defaults.',
  };
  const note = dataSourceNotes[dataSource] || null;

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
        dataSource,
        note,
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
// NOTE: YouTube Analytics has no "hour" dimension — it only ever gives real
// per-DAY view totals. The hour-of-day shape within each day is necessarily
// an approximation; `videoShapeGrid`, when available, lets us use the
// channel's own video-performance-by-publish-hour instead of a generic curve.
const buildHeatmapFromYouTube = async (accessToken, channelId, videoShapeGrid = null) => {
  // YouTube Analytics: real audience view totals per day
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
    // Shape each day's real view total across hours using either the channel's
    // own video-performance pattern (real signal) or a generic fallback curve.
    distributeViewsByHour(grid, counts, day, views, videoShapeGrid ? videoShapeGrid[day] : null);
  });

  // Average out
  for (let d = 0; d < 7; d++) {
    for (let h = 0; h < 24; h++) {
      if (counts[d][h] > 0) {
        grid[d][h] = grid[d][h] / counts[d][h];
      }
    }
  }

  return {
    grid,
    dataPoints: rows.length,
    hourSource: videoShapeGrid ? 'youtube_analytics+own_video_pattern' : 'youtube_analytics+estimated_pattern',
  };
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

// ==================== BUILD FROM COMMENT TIMESTAMPS ====================
// Compact country -> primary IANA timezone map (most common creator countries).
// Multi-timezone countries use their most-populous zone; good enough for
// bucketing engagement by hour-of-day.
const COUNTRY_TZ = {
  IN: 'Asia/Kolkata', US: 'America/New_York', GB: 'Europe/London', CA: 'America/Toronto',
  AU: 'Australia/Sydney', PK: 'Asia/Karachi', BD: 'Asia/Dhaka', NP: 'Asia/Kathmandu',
  LK: 'Asia/Colombo', AE: 'Asia/Dubai', SA: 'Asia/Riyadh', QA: 'Asia/Qatar',
  ID: 'Asia/Jakarta', PH: 'Asia/Manila', MY: 'Asia/Kuala_Lumpur', SG: 'Asia/Singapore',
  DE: 'Europe/Berlin', FR: 'Europe/Paris', ES: 'Europe/Madrid', IT: 'Europe/Rome',
  NL: 'Europe/Amsterdam', PL: 'Europe/Warsaw', BR: 'America/Sao_Paulo', MX: 'America/Mexico_City',
  AR: 'America/Argentina/Buenos_Aires', CO: 'America/Bogota', NG: 'Africa/Lagos',
  ZA: 'Africa/Johannesburg', EG: 'Africa/Cairo', KE: 'Africa/Nairobi', TR: 'Europe/Istanbul',
  RU: 'Europe/Moscow', JP: 'Asia/Tokyo', KR: 'Asia/Seoul', CN: 'Asia/Shanghai',
  TH: 'Asia/Bangkok', VN: 'Asia/Ho_Chi_Minh',
};
const DEFAULT_TZ = 'Asia/Kolkata';

const getChannelTimeZone = (channel) => {
  const cc = (channel && channel.country ? String(channel.country) : '').toUpperCase();
  return COUNTRY_TZ[cc] || DEFAULT_TZ;
};

const DAY_INDEX = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

// Day-of-week (0=Sun) and hour (0-23) of a UTC instant, in a target IANA timezone.
// Uses Intl (built into Node) so no timezone dependency is needed.
const getDayHourInTZ = (date, timeZone) => {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone, weekday: 'short', hour: '2-digit', hour12: false,
    }).formatToParts(date);
    let weekday, hour;
    for (const p of parts) {
      if (p.type === 'weekday') weekday = p.value;
      else if (p.type === 'hour') hour = parseInt(p.value, 10);
    }
    if (hour === 24) hour = 0; // some engines report midnight as 24
    const day = DAY_INDEX[weekday];
    if (day == null || Number.isNaN(hour)) return { day: null, hour: null };
    return { day, hour };
  } catch {
    return { day: null, hour: null };
  }
};

// Builds a 7x24 activity grid from when this channel's audience actually comments.
// Recent comments are weighted more (90-day half-life) so the pattern tracks the
// channel's current audience rather than years-old behavior.
const buildHeatmapFromComments = async (channelId, timeZone) => {
  const since = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);
  const comments = await Comment.find({
    channelId,
    publishedAt: { $gte: since },
  })
    .select('publishedAt')
    .lean();

  if (comments.length === 0) {
    return { grid: null, dataPoints: 0 };
  }

  const grid = Array(7).fill(null).map(() => Array(24).fill(0));
  const now = Date.now();
  const HALF_LIFE = 90 * 24 * 60 * 60 * 1000;

  comments.forEach((c) => {
    const when = new Date(c.publishedAt);
    const { day, hour } = getDayHourInTZ(when, timeZone);
    if (day == null || hour == null) return;
    const recency = Math.pow(0.5, (now - when.getTime()) / HALF_LIFE);
    grid[day][hour] += recency;
  });

  return { grid, dataPoints: comments.length };
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
      logger.error('Heatmap build failed', { error: err.message });
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
  dataSource: heatmap.dataSource,
  note: heatmap.note,
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
  dataSource: 'india_defaults',
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

// Default fallback curve — used only when there's no real per-channel hour
// signal (dayShapeRow) to shape the day's real view total with.
const GENERIC_HOUR_WEIGHTS = [
  2, 1, 1, 1, 1, 2, 3, 5, 7, 8, 8, 9,    // 12AM-11AM
  9, 8, 8, 7, 8, 10, 12, 14, 13, 11, 8, 4  // 12PM-11PM
];

const distributeViewsByHour = (grid, counts, day, totalViews, dayShapeRow = null) => {
  const weights = (dayShapeRow && dayShapeRow.some(v => v > 0))
    ? dayShapeRow
    : GENERIC_HOUR_WEIGHTS;
  const totalWeight = weights.reduce((a, b) => a + b, 0) || 1;

  weights.forEach((weight, hour) => {
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
  getDefaultGrid,
};
