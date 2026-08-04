import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
import { createFakeRedisClient } from '../mocks/redis.mock.js';

// See tests/integration/auth.service.test.js for why createRequire is used
// instead of `import` for local project files under test.
const require = createRequire(import.meta.url);
const redisConfig = require('../../src/config/redis.js');
redisConfig._setClientForTesting(createFakeRedisClient());

const heatmapService = require('../../src/services/heatmap.service.js');
const { Heatmap } = require('../../src/models/analytics.model.js');
const User = require('../../src/models/user.model.js');
const YoutubeChannel = require('../../src/models/youtube-channel.model.js');

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

const createFixtures = async () => {
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
    oauth: {
      accessToken: 'fake-access-token',
      refreshToken: 'fake-refresh-token',
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    },
  });
  return { user, channel };
};

describe('heatmap.service.getBestTimeSlots — ranks upcoming slots by real score', () => {
  // Regression test: generateNextSlots() walked the next 14 days
  // chronologically and pushed each day's matching slots in that order,
  // never re-sorting the final list by score. Since bestSlots (its input)
  // is already score-sorted, a lower-scored slot on a *sooner* calendar
  // date would still land at array[0] ahead of a real top slot a few days
  // out -- the frontend's "Best Times to Post" list trusts array[0] as
  // "#1 Best". Same bug, same fix as schedule.service.js's
  // getNextBestSlots() (2026-08-02) -- confirmed live: Dashboard (using
  // the already-fixed schedule.service.js path) and the Heatmap page
  // (using this one) disagreed on which slot was "best" for the same
  // channel at the same moment.
  it('ranks a genuinely top-scored slot first even when lower-scored slots occur sooner', async () => {
    const { user, channel } = await createFixtures();

    // A low-scored slot on every day of the week (guarantees several
    // "sooner" candidates regardless of which real weekday "now" is), plus
    // one real standout 3 days out.
    const bestSlots = DAY_NAMES.map((dayName, day) => ({
      day,
      dayName,
      hour: 22,
      score: 10,
      label: '10:00 PM',
    }));
    const standoutDay = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).getDay();
    bestSlots.push({
      day: standoutDay,
      dayName: DAY_NAMES[standoutDay],
      hour: 18,
      score: 95,
      label: '6:00 PM',
    });

    await Heatmap.create({
      userId: user._id,
      channelId: channel._id,
      grid: Array(7)
        .fill(null)
        .map(() => Array(24).fill(0)),
      bestSlots,
      worstSlots: [],
      dataPoints: 50,
      confidence: 'medium',
      dataSource: 'comment_activity',
      calculatedAt: new Date(),
      nextRecalcAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // fresh, no rebuild needed
    });

    const result = await heatmapService.getBestTimeSlots(
      user._id.toString(),
      channel._id.toString(),
      5
    );

    const top = result.nextOptimalSlots[0];
    expect(top.score).toBe(95);
    expect(top.day).toBe(
      DAY_NAMES[standoutDay].charAt(0).toUpperCase() + DAY_NAMES[standoutDay].slice(1)
    );
  });
});
