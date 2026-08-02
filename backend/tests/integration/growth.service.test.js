import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
import { createFakeRedisClient } from '../mocks/redis.mock.js';

// See tests/integration/auth.service.test.js for why createRequire is used
// instead of `import` for local project files under test.
const require = createRequire(import.meta.url);
const redisConfig = require('../../src/config/redis.js');
redisConfig._setClientForTesting(createFakeRedisClient());

const growthService = require('../../src/services/growth.service.js');
const User = require('../../src/models/user.model.js');
const YoutubeChannel = require('../../src/models/youtube-channel.model.js');
const { ChannelAnalytics } = require('../../src/models/analytics.model.js');

const createFixtures = async (subscriberCount = 100) => {
  const user = await User.create({
    name: 'Creator',
    email: `creator-${Date.now()}-${Math.random()}@example.com`,
    password: 'password123',
    isEmailVerified: true,
    plan: 'creator',
  });
  const channel = await YoutubeChannel.create({
    userId: user._id,
    channelId: `UC${Math.random().toString(36).slice(2, 24)}`,
    channelName: 'Test Channel',
    isActive: true,
    stats: { subscriberCount, videoCount: 10, viewCount: 5000 },
    oauth: {
      accessToken: 'fake-access-token',
      refreshToken: 'fake-refresh-token',
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    },
  });
  return { user, channel };
};

// analyticsData.length must be >= 7 or getGrowthPrediction() takes the
// no-data fallback path (milestones: []) instead of exercising
// calculateMilestones() at all.
const seedDailyAnalytics = async (channel, { days = 10, subscribersGainedPerDay = 0 }) => {
  const day = 24 * 60 * 60 * 1000;
  for (let i = 0; i < days; i++) {
    await ChannelAnalytics.create({
      userId: channel.userId,
      channelId: channel._id,
      date: new Date(Date.now() - i * day),
      metrics: { views: 10, subscribersGained: subscribersGainedPerDay },
    });
  }
};

describe('growth.service.getGrowthPrediction — milestone estimates', () => {
  // Regression test: calculateMilestones() used to fall back to a hardcoded
  // "999 weeks" whenever weeklyGain wasn't positive, applied identically to
  // every milestone target -- so 1K/5K/10K/25K all showed the exact same
  // daysAway, estimatedDate, and probability. Reproduced live on both real
  // test channels (13 subs and 45 subs, both with zero net weekly gain).
  it('reports no estimate (not an identical fake date) for every milestone when weekly gain is zero', async () => {
    const { user, channel } = await createFixtures(13);
    await seedDailyAnalytics(channel, { days: 10, subscribersGainedPerDay: 0 });

    const result = await growthService.getGrowthPrediction(
      user._id.toString(),
      channel._id.toString()
    );

    expect(result.milestones.length).toBeGreaterThan(1);
    for (const milestone of result.milestones) {
      expect(milestone.daysAway).toBeNull();
      expect(milestone.estimatedDate).toBeNull();
      expect(milestone.probability).toBe(0);
    }
  });

  it('gives farther-out targets a later estimate when there is real positive growth', async () => {
    const { user, channel } = await createFixtures(100);
    await seedDailyAnalytics(channel, { days: 10, subscribersGainedPerDay: 5 });

    const result = await growthService.getGrowthPrediction(
      user._id.toString(),
      channel._id.toString()
    );

    const [m1k, m5k, m10k] = result.milestones;
    expect(m1k.daysAway).not.toBeNull();
    // A bigger target must take at least as long to reach as a smaller one.
    expect(m5k.daysAway).toBeGreaterThan(m1k.daysAway);
    expect(m10k.daysAway).toBeGreaterThan(m5k.daysAway);
  });
});
