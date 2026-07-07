// src/services/report.service.js
// Weekly + monthly performance report — gathers analytics, generates AI insights + action items.
// Called by cron every Monday (weekly) and 1st of month (monthly).
// Data flows: YouTube API → MongoDB → this service → email (with PDF attachment).

const { ChannelAnalytics } = require('../models/analytics.model');
const Video = require('../models/video.model');
const YoutubeChannel = require('../models/youtube-channel.model');

// ==================== MAIN: GATHER REPORT DATA ====================
// days=7 → weekly report, days=30 → monthly report
const gatherReportData = async (userId, channelId, days = 7) => {
  const now = new Date();
  const since = new Date(now - days * 86400000);
  const prevSince = new Date(now - days * 2 * 86400000);

  // Parallel fetch — channel info + current period + previous period analytics
  const [channel, thisWeek, lastWeek, dailyRows, topVideos] = await Promise.all([
    YoutubeChannel.findOne({ _id: channelId, userId, isActive: true }).select(
      'channelName thumbnail stats'
    ),

    ChannelAnalytics.aggregate([
      { $match: { channelId: toObjId(channelId), date: { $gte: since, $lte: now } } },
      {
        $group: {
          _id: null,
          views: { $sum: '$metrics.views' },
          watchTime: { $sum: '$metrics.estimatedMinutesWatched' },
          subsGained: { $sum: '$metrics.subscribersGained' },
          subsLost: { $sum: '$metrics.subscribersLost' },
          likes: { $sum: '$metrics.likes' },
          comments: { $sum: '$metrics.comments' },
          impressions: { $sum: '$metrics.impressions' },
          avgCtr: { $avg: '$metrics.impressionsCtr' },
        },
      },
    ]),

    ChannelAnalytics.aggregate([
      { $match: { channelId: toObjId(channelId), date: { $gte: prevSince, $lt: since } } },
      {
        $group: {
          _id: null,
          views: { $sum: '$metrics.views' },
          watchTime: { $sum: '$metrics.estimatedMinutesWatched' },
          subsGained: { $sum: '$metrics.subscribersGained' },
          avgCtr: { $avg: '$metrics.impressionsCtr' },
        },
      },
    ]),

    ChannelAnalytics.find({ channelId: toObjId(channelId), date: { $gte: since } })
      .sort({ date: 1 })
      .select('date metrics.views')
      .lean(),

    Video.find({ userId, channelId, status: 'published' })
      .sort({ 'performance.views': -1 })
      .limit(5)
      .select('title thumbnail youtubeVideoId publishedAt performance isShort')
      .lean(),
  ]);

  if (!channel) return null;

  const curr = thisWeek[0] || {};
  const prev = lastWeek[0] || {};

  // Fallback: if no ChannelAnalytics, use Video.performance totals
  if (!curr.views) {
    const vAgg = await Video.aggregate([
      { $match: { channelId: toObjId(channelId), status: 'published' } },
      {
        $group: {
          _id: null,
          views: { $sum: '$performance.views' },
          likes: { $sum: '$performance.likes' },
          comments: { $sum: '$performance.comments' },
        },
      },
    ]);
    if (vAgg[0]) {
      curr.views = vAgg[0].views;
      curr.likes = vAgg[0].likes;
      curr.comments = vAgg[0].comments;
    }
  }

  const kpis = {
    views: { value: curr.views || 0, change: pctChange(curr.views, prev.views) },
    watchTime: {
      value: Math.round((curr.watchTime || 0) / 60),
      change: pctChange(curr.watchTime, prev.watchTime),
    },
    subscribers: {
      gained: curr.subsGained || 0,
      lost: curr.subsLost || 0,
      change: pctChange(curr.subsGained, prev.subsGained),
    },
    likes: { value: curr.likes || 0 },
    comments: { value: curr.comments || 0 },
    ctr: {
      value: parseFloat((curr.avgCtr || 0).toFixed(2)),
      change: pctChange(curr.avgCtr, prev.avgCtr),
    },
  };

  // Daily bar chart data (fill missing days with 0)
  const dailyViews = buildDailyArray(dailyRows, since, days);

  // Best posting day in the period
  const bestDayIndex = dailyViews.indexOf(Math.max(...dailyViews));
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const bestDayName = dayNames[(new Date(since).getDay() + bestDayIndex) % 7];

  // Channel health score (0–100)
  const healthScore = calcHealthScore(kpis, prev);

  // Milestones
  const milestones = calcMilestones(channel.stats?.subscriberCount || 0, kpis.subscribers.gained);

  // AI-style insights
  const insights = generateInsights({ kpis, prev, topVideos, bestDayName, channel });

  // Personalised action items
  const actionItems = generateActionItems({ insights, kpis, topVideos });

  // Best posting times (from heatmap service if available)
  let bestTimes;
  try {
    const heatmapService = require('./heatmap.service');
    const slots = await heatmapService.getBestTimeSlots(userId, channelId, 3);
    bestTimes = slots?.nextOptimalSlots || slots?.recommendation?.nextOptimalSlots || [];
  } catch {
    bestTimes = [];
  }

  return {
    channel: {
      name: channel.channelName,
      thumbnail: channel.thumbnail,
      subscribers: channel.stats?.subscriberCount || 0,
    },
    kpis,
    dailyViews,
    bestDayName,
    topVideos,
    insights,
    actionItems,
    bestTimes,
    milestones,
    healthScore,
    weekRange: days <= 7 ? formatWeekRange() : formatDateRange(days),
    reportType: days <= 7 ? 'weekly' : 'monthly',
  };
};

// Thin wrapper for monthly — 30-day period, used by monthly cron
const gatherMonthlyReportData = (userId, channelId) => gatherReportData(userId, channelId, 30);

// ==================== INSIGHTS GENERATOR ====================
const generateInsights = ({ kpis, prev, topVideos, bestDayName, channel }) => {
  const insights = [];

  // 1. Content pattern — detect common word in top videos
  if (topVideos.length >= 2) {
    const topTitle = topVideos[0]?.title || '';
    const keywords = extractKeyword(topTitle);
    if (keywords) {
      const avgTop = topVideos[0]?.performance?.views || 0;
      const avgOthers =
        topVideos.slice(1).reduce((s, v) => s + (v.performance?.views || 0), 0) /
        Math.max(topVideos.length - 1, 1);
      const mult = avgOthers > 0 ? (avgTop / avgOthers).toFixed(1) : null;
      insights.push({
        type: 'opportunity',
        icon: 'bulb',
        color: 'accent',
        title:
          mult && mult > 1.5
            ? `Your "${keywords}" content is ${mult}× better than average`
            : `"${topVideos[0]?.title?.slice(0, 40)}" is your best performer this week`,
        body: `Focus more on this type of content — it clearly resonates with your audience. Use AI Content Studio to generate 5 similar video ideas instantly.`,
      });
    }
  }

  // 2. Best posting time
  if (bestDayName) {
    insights.push({
      type: 'besttime',
      icon: 'clock',
      color: 'success',
      title: `${bestDayName} was your best day this week`,
      body: `You got the most views on ${bestDayName}. Schedule your next video around this day for maximum reach. Check your Heatmap for the exact best hour.`,
    });
  }

  // 3. CTR warning
  if (kpis.ctr.change < -5) {
    insights.push({
      type: 'warning',
      icon: 'alert-triangle',
      color: 'warning',
      title: `CTR dropped ${Math.abs(kpis.ctr.change)}% — thumbnail may need a refresh`,
      body: `Fewer people are clicking your videos despite similar impressions. Try a brighter thumbnail with a face and bold text. Use TubeOS AI Thumbnail Scorer to test before publishing.`,
    });
  }

  // 4. Views growth
  if (kpis.views.change >= 20) {
    insights.push({
      type: 'growth',
      icon: 'trending-up',
      color: 'success',
      title: `Views up ${kpis.views.change}% vs last week — great momentum!`,
      body: `Your channel is growing. Keep posting consistently at your best times to maintain this growth streak. Aim for at least 1 video this week.`,
    });
  } else if (kpis.views.change < -10) {
    insights.push({
      type: 'warning',
      icon: 'trending-down',
      color: 'warning',
      title: `Views dropped ${Math.abs(kpis.views.change)}% this week`,
      body: `Posting less frequently or at off-peak times can cause this. Try to post at least once this week, especially on ${bestDayName}.`,
    });
  }

  // 5. Comments engagement
  if (kpis.comments.value > 0) {
    insights.push({
      type: 'engagement',
      icon: 'message-circle',
      color: 'accent',
      title: `${kpis.comments.value} comments need your attention`,
      body: `Replying to comments in the first 24 hours boosts YouTube algorithm ranking. Use TubeOS AI Reply to respond to all comments in one click.`,
    });
  }

  return insights.slice(0, 3);
};

// ==================== ACTION ITEMS ====================
const generateActionItems = ({ insights, kpis, topVideos }) => {
  const items = [];

  // Always: post this week
  items.push(`Post your next video this week — consistency is the #1 growth driver`);

  // From top video
  if (topVideos[0]) {
    items.push(
      `Reply to comments on "${topVideos[0].title?.slice(0, 35)}..." — engagement in first 24h boosts reach`
    );
  }

  // From insights
  const warning = insights.find((i) => i.color === 'warning');
  if (warning) {
    items.push(
      warning.type === 'warning' && warning.icon === 'alert-triangle'
        ? `Try a new thumbnail — CTR is down, use AI Thumbnail Scorer to test`
        : `Address: ${warning.title}`
    );
  }

  const opportunity = insights.find((i) => i.color === 'accent' && i.icon === 'message-circle');
  if (opportunity && kpis.comments.value > 0) {
    items.push(`Use AI Reply to respond to all ${kpis.comments.value} pending comments`);
  } else {
    items.push(`Share your channel link this week to boost subscriber count`);
  }

  return items.slice(0, 4);
};

// ==================== CHANNEL HEALTH SCORE ====================
const calcHealthScore = (kpis, prev) => {
  let score = 50;
  if (kpis.views.value > 0) score += 10;
  if (kpis.views.change > 0) score += Math.min(kpis.views.change / 2, 15);
  if (kpis.subscribers.gained > 0) score += 10;
  if (kpis.ctr.value > 3) score += 10;
  if (kpis.ctr.change >= 0) score += 5;
  return Math.min(100, Math.max(0, Math.round(score)));
};

// ==================== MILESTONES ====================
const calcMilestones = (current, weeklyGain) => {
  const targets = [100, 500, 1000, 5000, 10000, 50000, 100000];
  const next = targets.filter((t) => t > current).slice(0, 3);
  const weeklyRate = weeklyGain || 1;
  return next.map((t) => ({
    target: t,
    needed: t - current,
    label: t >= 1000 ? `${t / 1000}K subscribers` : `${t} subscribers`,
    sublabel:
      t === 1000
        ? 'Full monetization eligible'
        : t === 100
          ? 'Community posts unlock'
          : 'YouTube milestone',
    estWeeks: Math.ceil((t - current) / weeklyRate),
  }));
};

// ==================== SUBJECT LINE ====================
const generateSubjectLine = (userName, kpis, weekRange) => {
  const firstName = userName?.split(' ')[0] || 'Creator';
  const subs = kpis?.subscribers?.gained || 0;
  const viewsChange = kpis?.views?.change || 0;
  const views = kpis?.views?.value || 0;

  if (subs >= 10) return `${firstName}, you gained ${subs} subscribers this week! 🎉`;
  if (subs > 0) return `+${subs} new subscribers · Your weekly TubeOS report`;
  if (viewsChange >= 30) return `${firstName}, views up ${viewsChange}% this week 📈`;
  if (views > 0) return `${fmtNum(views)} views this week · Your TubeOS report`;
  return `Your weekly YouTube performance report — ${weekRange}`;
};

// ==================== HELPERS ====================
const toObjId = (id) => require('mongoose').Types.ObjectId.createFromHexString(id.toString());

const pctChange = (curr = 0, prev = 0) => {
  if (!prev) return curr > 0 ? 100 : 0;
  return parseFloat((((curr - prev) / prev) * 100).toFixed(1));
};

const buildDailyArray = (rows, since, days = 7) => {
  const map = {};
  rows.forEach((r) => {
    map[r.date.toISOString().split('T')[0]] = r.metrics?.views || 0;
  });
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(since.getTime() + i * 86400000).toISOString().split('T')[0];
    return map[d] || 0;
  });
};

const extractKeyword = (title) => {
  const words = title
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, '')
    .split(' ')
    .filter((w) => w.length > 3);
  const stop = new Set([
    'this',
    'that',
    'with',
    'your',
    'from',
    'have',
    'been',
    'will',
    'they',
    'what',
    'when',
    'were',
    'their',
    'there',
  ]);
  return words.find((w) => !stop.has(w)) || null;
};

const formatWeekRange = () => {
  const end = new Date();
  const start = new Date(end - 6 * 86400000);
  const opts = { month: 'short', day: 'numeric' };
  return `${start.toLocaleDateString('en-IN', opts)} – ${end.toLocaleDateString('en-IN', opts)}`;
};

const formatDateRange = (days) => {
  const end = new Date();
  const start = new Date(end - (days - 1) * 86400000);
  const opts = { month: 'short', day: 'numeric' };
  return `${start.toLocaleDateString('en-IN', opts)} – ${end.toLocaleDateString('en-IN', opts)}`;
};

const fmtNum = (n) => (n >= 1000 ? `${(n / 1000).toFixed(1)}K` : `${n}`);

module.exports = { gatherReportData, gatherMonthlyReportData, generateSubjectLine };
