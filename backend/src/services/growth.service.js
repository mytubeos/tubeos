// src/services/growth.service.js
// Growth Intelligence — predictions, competitor tracking, trend scanning

const { GrowthPrediction, Competitor, Trend } = require('../models/growth.model');
const { ChannelAnalytics } = require('../models/analytics.model');
const Video = require('../models/video.model');
const YoutubeChannel = require('../models/youtube-channel.model');
const { getValidAccessToken } = require('./youtube.service');
const { youtubeRequest } = require('../config/youtube.config');
const { setCache, getCache } = require('../config/redis');

// ==================== GROWTH PREDICTION ====================
const getGrowthPrediction = async (userId, channelId) => {
  const cacheKey = `growth:prediction:${channelId}`;
  const cached = await getCache(cacheKey);
  if (cached) return cached;

  const channel = await YoutubeChannel.findOne({ _id: { $eq: channelId }, userId: { $eq: userId } });
  if (!channel) {
    const err = new Error('Channel not found');
    err.statusCode = 404;
    throw err;
  }

  // Get last 90 days analytics
  const days = 90;
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const analyticsData = await ChannelAnalytics.find({
    channelId,
    date: { $gte: startDate },
  }).sort({ date: 1 }).lean();

  if (analyticsData.length < 7) {
    return getDefaultPrediction(channel, userId, channelId);
  }

  // Calculate growth rates
  const recentData = analyticsData.slice(-30);
  const olderData = analyticsData.slice(0, 30);

  const recentAvgViews = avg(recentData.map(d => d.metrics.views));
  const olderAvgViews = avg(olderData.map(d => d.metrics.views));
  const recentSubsGained = sum(recentData.map(d => d.metrics.subscribersGained));
  const olderSubsGained = sum(olderData.map(d => d.metrics.subscribersGained));

  const viewsGrowthRate = calcGrowthRate(recentAvgViews, olderAvgViews);
  const subsGrowthRate = calcGrowthRate(recentSubsGained, olderSubsGained);

  const currentSubs = channel.stats.subscriberCount;
  const monthlySubsGain = recentSubsGained;
  const weeklySubsGain = monthlySubsGain / 4;

  // Predictions
  const pred30 = predictGrowth(currentSubs, weeklySubsGain, 4, subsGrowthRate);
  const pred90 = predictGrowth(currentSubs, weeklySubsGain, 13, subsGrowthRate);
  const pred365 = predictGrowth(currentSubs, weeklySubsGain, 52, subsGrowthRate);

  // Milestones
  const milestones = calculateMilestones(currentSubs, weeklySubsGain, subsGrowthRate);

  // Performance suggestions
  const suggestions = generateSuggestions(channel, analyticsData, recentData);

  // Trend direction
  const trendDirection = subsGrowthRate > 5 ? 'growing'
    : subsGrowthRate < -5 ? 'declining' : 'stable';

  const result = {
    channelId,
    channelName: channel.channelName,
    current: {
      subscribers: currentSubs,
      totalViews: channel.stats.viewCount,
      avgViewsPerDay: Math.round(recentAvgViews),
      monthlySubsGain: Math.round(monthlySubsGain),
      viewsGrowthRate: parseFloat(viewsGrowthRate.toFixed(1)),
      subsGrowthRate: parseFloat(subsGrowthRate.toFixed(1)),
    },
    predictions: {
      thirtyDays: {
        subscribers: pred30.subscribers,
        gain: pred30.gain,
        growthRate: parseFloat(subsGrowthRate.toFixed(1)),
        confidence: analyticsData.length >= 30 ? 75 : 50,
      },
      ninetyDays: {
        subscribers: pred90.subscribers,
        gain: pred90.gain,
        growthRate: parseFloat((subsGrowthRate * 0.9).toFixed(1)),
        confidence: analyticsData.length >= 60 ? 65 : 40,
      },
      oneYear: {
        subscribers: pred365.subscribers,
        gain: pred365.gain,
        growthRate: parseFloat((subsGrowthRate * 0.8).toFixed(1)),
        confidence: 45,
      },
    },
    milestones,
    suggestions,
    trendDirection,
    dataQuality: analyticsData.length >= 60 ? 'high' : analyticsData.length >= 30 ? 'medium' : 'low',
    calculatedAt: new Date(),
  };

  // Save to DB
  await GrowthPrediction.findOneAndUpdate(
    { channelId: { $eq: channelId } },
    { $set: { userId, channelId, ...result } },
    { upsert: true }
  );

  await setCache(cacheKey, result, 12 * 60 * 60); // 12 hour cache
  return result;
};

// ==================== ADD COMPETITOR ====================
const addCompetitor = async (userId, channelId, youtubeChannelId) => {
  // Check plan limits
  const user = await require('../models/user.model').findById(userId).lean({ virtuals: true });
  const limits = { free: 0, creator: 0, pro: 3, agency: 999 };
  const limit = limits[user.plan] || 0;

  if (limit === 0) {
    const err = new Error('Competitor tracking requires PRO plan or above');
    err.statusCode = 403;
    throw err;
  }

  const existingCount = await Competitor.countDocuments({ userId, trackingChannelId: channelId, isActive: true });
  if (existingCount >= limit) {
    const err = new Error(`Your plan allows tracking ${limit} competitors. Upgrade for more.`);
    err.statusCode = 403;
    throw err;
  }

  // Check not duplicate
  const existing = await Competitor.findOne({ userId: { $eq: userId }, youtubeChannelId: { $eq: youtubeChannelId } });
  if (existing) {
    const err = new Error('Already tracking this competitor');
    err.statusCode = 409;
    throw err;
  }

  // Fetch competitor channel info from YouTube
  const trackingChannel = await YoutubeChannel.findOne({ _id: { $eq: channelId }, userId: { $eq: userId } })
    .select('+oauth.accessToken +oauth.refreshToken +oauth.expiresAt');

  const accessToken = await getValidAccessToken(trackingChannel);

  const data = await youtubeRequest(
    `/channels?part=snippet,statistics&id=${youtubeChannelId}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  const yt = data.items?.[0];
  if (!yt) {
    const err = new Error('YouTube channel not found');
    err.statusCode = 404;
    throw err;
  }

  const competitor = await Competitor.create({
    userId,
    trackingChannelId: channelId,
    youtubeChannelId,
    channelName: yt.snippet.title,
    channelHandle: yt.snippet.customUrl || null,
    thumbnail: yt.snippet.thumbnails?.high?.url || null,
    stats: {
      subscribers: parseInt(yt.statistics.subscriberCount) || 0,
      totalViews: parseInt(yt.statistics.viewCount) || 0,
      videoCount: parseInt(yt.statistics.videoCount) || 0,
      lastSyncedAt: new Date(),
    },
    history: [{
      date: new Date(),
      subscribers: parseInt(yt.statistics.subscriberCount) || 0,
      totalViews: parseInt(yt.statistics.viewCount) || 0,
      videoCount: parseInt(yt.statistics.videoCount) || 0,
    }],
  });

  return { competitor, message: `Now tracking "${competitor.channelName}"` };
};

// ==================== GET COMPETITORS ====================
const getCompetitors = async (userId, channelId) => {
  const competitors = await Competitor.find({
    userId,
    trackingChannelId: channelId,
    isActive: true,
  }).sort({ 'stats.subscribers': -1 });

  return { competitors };
};

// ==================== SYNC COMPETITOR STATS ====================
const syncCompetitor = async (userId, competitorId) => {
  const competitor = await Competitor.findOne({ _id: competitorId, userId });
  if (!competitor) {
    const err = new Error('Competitor not found');
    err.statusCode = 404;
    throw err;
  }

  const channel = await YoutubeChannel.findOne({
    _id: { $eq: competitor.trackingChannelId },
    userId: { $eq: userId },
  }).select('+oauth.accessToken +oauth.refreshToken +oauth.expiresAt');

  const accessToken = await getValidAccessToken(channel);

  const data = await youtubeRequest(
    `/channels?part=snippet,statistics&id=${competitor.youtubeChannelId}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  const yt = data.items?.[0];
  if (!yt) throw new Error('Could not fetch competitor data');

  const newStats = {
    subscribers: parseInt(yt.statistics.subscriberCount) || 0,
    totalViews: parseInt(yt.statistics.viewCount) || 0,
    videoCount: parseInt(yt.statistics.videoCount) || 0,
    lastSyncedAt: new Date(),
  };

  // Add to history
  competitor.history.push({
    date: new Date(),
    ...newStats,
  });

  // Keep last 90 snapshots
  if (competitor.history.length > 90) {
    competitor.history = competitor.history.slice(-90);
  }

  competitor.stats = newStats;
  competitor.channelName = yt.snippet.title;
  await competitor.save();

  return { competitor, message: 'Competitor synced' };
};

// ==================== REMOVE COMPETITOR ====================
const removeCompetitor = async (userId, competitorId) => {
  const competitor = await Competitor.findOne({ _id: { $eq: competitorId }, userId: { $eq: userId } });
  if (!competitor) {
    const err = new Error('Competitor not found');
    err.statusCode = 404;
    throw err;
  }

  competitor.isActive = false;
  await competitor.save();

  return { message: `Stopped tracking "${competitor.channelName}"` };
};

// ==================== GET TRENDS ====================
const getTrends = async (userId, channelId, category = null) => {
  const cacheKey = `trends:${category || 'all'}`;
  const cached = await getCache(cacheKey);
  if (cached) return cached;

  const query = {
    status: { $in: ['rising', 'peaking'] },
    expiresAt: { $gt: new Date() },
  };
  if (category) query.category = category;

  const trends = await Trend.find(query)
    .sort({ opportunityScore: -1 })
    .limit(20);

  // If no trends in DB, return curated defaults
  if (trends.length === 0) {
    const defaultTrends = getDefaultTrends();
    await setCache(cacheKey, defaultTrends, 60 * 60);
    return defaultTrends;
  }

  const result = { trends, updatedAt: new Date() };
  await setCache(cacheKey, result, 60 * 60);
  return result;
};

// ==================== GET PERFORMANCE SUGGESTIONS ====================
const getPerformanceSuggestions = async (userId, channelId) => {
  const prediction = await getGrowthPrediction(userId, channelId);
  return {
    channelId,
    suggestions: prediction.suggestions || [],
    trendDirection: prediction.trendDirection,
  };
};

// ==================== HELPERS ====================
const avg = (arr) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
const sum = (arr) => arr.reduce((a, b) => a + b, 0);

const calcGrowthRate = (current, previous) => {
  if (!previous) return 0;
  return ((current - previous) / previous) * 100;
};

const predictGrowth = (current, weeklyGain, weeks, growthRate) => {
  let subs = current;
  let gain = weeklyGain;

  for (let w = 0; w < weeks; w++) {
    gain = gain * (1 + growthRate / 100 / 52);
    subs += gain;
  }

  return {
    subscribers: Math.round(subs),
    gain: Math.round(subs - current),
  };
};

const calculateMilestones = (current, weeklyGain, growthRate) => {
  const milestoneTargets = [
    1000, 5000, 10000, 25000, 50000, 100000,
    500000, 1000000,
  ].filter(t => t > current);

  return milestoneTargets.slice(0, 4).map(target => {
    const gap = target - current;
    const weeksNeeded = weeklyGain > 0 ? Math.ceil(gap / weeklyGain) : 999;
    const daysNeeded = weeksNeeded * 7;
    const estimatedDate = new Date(Date.now() + daysNeeded * 24 * 60 * 60 * 1000);

    return {
      target,
      label: target >= 1000000 ? `${target / 1000000}M`
        : target >= 1000 ? `${target / 1000}K` : target.toString(),
      estimatedDate,
      daysAway: daysNeeded,
      probability: daysNeeded <= 365 ? 80 : daysNeeded <= 730 ? 60 : 40,
    };
  });
};

const generateSuggestions = (channel, allData, recentData) => {
  const suggestions = [];
  const recentAvgViews = avg(recentData.map(d => d.metrics.views));
  const avgCtr = avg(recentData.map(d => d.metrics.impressionsCtr));

  if (avgCtr < 4) {
    suggestions.push({
      type: 'thumbnail',
      title: 'Improve your thumbnails',
      description: `Your CTR is ${avgCtr.toFixed(1)}% — industry average is 4-6%. Better thumbnails can double your views.`,
      impact: 'high',
      metric: 'views',
    });
  }

  const videosPerMonth = allData.length > 0
    ? (allData.length / 90) * 30 : 0;

  if (videosPerMonth < 4) {
    suggestions.push({
      type: 'upload_frequency',
      title: 'Post more consistently',
      description: `You're posting ~${Math.round(videosPerMonth)} videos/month. Creators posting 4+ videos/month grow 2x faster.`,
      impact: 'high',
      metric: 'subscribers',
    });
  }

  if (recentAvgViews < 500) {
    suggestions.push({
      type: 'best_time',
      title: 'Post at peak hours',
      description: 'Use the Time Intelligence heatmap to schedule videos when your audience is most active.',
      impact: 'medium',
      metric: 'views',
    });
  }

  suggestions.push({
    type: 'engagement',
    title: 'Reply to comments within 2 hours',
    description: 'Channels that respond to comments in the first 2 hours see 28% higher engagement rates.',
    impact: 'medium',
    metric: 'engagement',
  });

  return suggestions;
};

const getDefaultPrediction = (channel, userId, channelId) => ({
  channelId,
  channelName: channel.channelName,
  current: {
    subscribers: channel.stats.subscriberCount,
    totalViews: channel.stats.viewCount,
  },
  predictions: {
    thirtyDays: { subscribers: null, confidence: 0 },
    ninetyDays: { subscribers: null, confidence: 0 },
    oneYear: { subscribers: null, confidence: 0 },
  },
  milestones: [],
  suggestions: [
    {
      type: 'data',
      title: 'Need more data',
      description: 'Connect analytics and post more videos to get growth predictions.',
      impact: 'high',
      metric: 'all',
    },
  ],
  trendDirection: 'stable',
  dataQuality: 'low',
  note: 'Sync analytics data to get accurate predictions',
});

const getDefaultTrends = () => ({
  trends: [
    { keyword: 'AI Tools 2026', category: 'Technology', opportunityScore: 92, status: 'rising', growthRate: 45 },
    { keyword: 'YouTube Automation', category: 'Business', opportunityScore: 88, status: 'rising', growthRate: 38 },
    { keyword: 'Shorts Strategy', category: 'Creator', opportunityScore: 85, status: 'peaking', growthRate: 30 },
    { keyword: 'Passive Income India', category: 'Finance', opportunityScore: 82, status: 'rising', growthRate: 25 },
    { keyword: 'AI Video Editing', category: 'Technology', opportunityScore: 79, status: 'rising', growthRate: 55 },
  ],
  updatedAt: new Date(),
  note: 'Curated trends — real-time data available with analytics sync',
});

module.exports = {
  getGrowthPrediction,
  addCompetitor,
  getCompetitors,
  syncCompetitor,
  removeCompetitor,
  getTrends,
  getPerformanceSuggestions,
};
