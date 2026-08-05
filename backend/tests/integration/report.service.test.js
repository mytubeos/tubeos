import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

// See tests/integration/auth.service.test.js for why createRequire is used
// instead of `import` for local project files under test.
const require = createRequire(import.meta.url);
const {
  gatherReportData,
  getCompetitorHistoryGrowth,
} = require('../../src/services/report.service.js');
const User = require('../../src/models/user.model.js');
const YoutubeChannel = require('../../src/models/youtube-channel.model.js');
const { Competitor } = require('../../src/models/growth.model.js');

const daysAgo = (n) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);

const createUser = async (overrides = {}) =>
  User.create({
    name: 'Creator',
    email: `creator-${Date.now()}-${Math.random()}@example.com`,
    password: 'password123',
    ...overrides,
  });

const createChannel = async (userId) =>
  YoutubeChannel.create({
    userId,
    channelId: `UC${Date.now()}${Math.random().toString(36).slice(2)}`,
    channelName: 'My Channel',
    oauth: {
      accessToken: 'tok',
      refreshToken: 'refresh',
      expiresAt: new Date(Date.now() + 3600000),
    },
  });

describe('report.service.getCompetitorHistoryGrowth', () => {
  it('returns null when history is missing or too short', () => {
    expect(getCompetitorHistoryGrowth(undefined, 1000)).toBeNull();
    expect(getCompetitorHistoryGrowth([], 1000)).toBeNull();
    expect(getCompetitorHistoryGrowth([{ date: daysAgo(7), totalViews: 900 }], 1000)).toBeNull();
  });

  it('computes % growth against the entry closest to the target period', () => {
    const history = [
      { date: daysAgo(30), totalViews: 500 },
      { date: daysAgo(7), totalViews: 1000 },
      { date: daysAgo(1), totalViews: 1080 },
    ];
    const result = getCompetitorHistoryGrowth(history, 1100, 7);
    expect(result.pct).toBeCloseTo(10, 5);
    expect(result.actualDays).toBe(7);
  });

  it('returns null rather than dividing by a zero baseline', () => {
    const history = [
      { date: daysAgo(10), totalViews: 0 },
      { date: daysAgo(1), totalViews: 500 },
    ];
    expect(getCompetitorHistoryGrowth(history, 1000, 7)).toBeNull();
  });

  it('returns null when the closest entry has no meaningful time gap', () => {
    const history = [
      { date: daysAgo(0), totalViews: 900 },
      { date: daysAgo(0), totalViews: 1000 },
    ];
    expect(getCompetitorHistoryGrowth(history, 1000, 7)).toBeNull();
  });
});

describe('report.service.gatherReportData — competitor comparison plan gating', () => {
  it('includes competitorComparison for an Agency-plan user with real competitor history', async () => {
    const user = await createUser();
    const channel = await createChannel(user._id);
    await Competitor.create({
      userId: user._id,
      trackingChannelId: channel._id,
      youtubeChannelId: 'UCcompetitor1',
      channelName: 'Rival Channel',
      stats: { totalViews: 1100 },
      history: [
        { date: daysAgo(30), totalViews: 500 },
        { date: daysAgo(7), totalViews: 1000 },
      ],
    });

    const data = await gatherReportData(user._id.toString(), channel._id.toString(), 7, 'agency');

    expect(data.competitorComparison).toBeTruthy();
    expect(data.competitorComparison.competitors).toHaveLength(1);
    expect(data.competitorComparison.competitors[0]).toMatchObject({
      name: 'Rival Channel',
      pct: 10,
    });
  });

  it('omits competitorComparison for a Free-plan user even with tracked competitors in Mongo', async () => {
    // Regression guard for the double-gate: a downgraded user's stale
    // Competitor rows must never leak into their report once they're no
    // longer entitled to see them (mirrors the White-label branding gate).
    const user = await createUser();
    const channel = await createChannel(user._id);
    await Competitor.create({
      userId: user._id,
      trackingChannelId: channel._id,
      youtubeChannelId: 'UCcompetitor2',
      channelName: 'Rival Channel',
      stats: { totalViews: 1100 },
      history: [
        { date: daysAgo(30), totalViews: 500 },
        { date: daysAgo(7), totalViews: 1000 },
      ],
    });

    const data = await gatherReportData(user._id.toString(), channel._id.toString(), 7, 'free');

    expect(data.competitorComparison).toBeUndefined();
  });

  it('omits competitorComparison for a Pro-plan user with zero tracked competitors', async () => {
    const user = await createUser();
    const channel = await createChannel(user._id);

    const data = await gatherReportData(user._id.toString(), channel._id.toString(), 7, 'pro');

    expect(data.competitorComparison).toBeUndefined();
  });

  it('defaults to omitting competitorComparison when no plan is passed at all', async () => {
    const user = await createUser();
    const channel = await createChannel(user._id);
    await Competitor.create({
      userId: user._id,
      trackingChannelId: channel._id,
      youtubeChannelId: 'UCcompetitor3',
      channelName: 'Rival Channel',
      stats: { totalViews: 1100 },
      history: [
        { date: daysAgo(30), totalViews: 500 },
        { date: daysAgo(7), totalViews: 1000 },
      ],
    });

    const data = await gatherReportData(user._id.toString(), channel._id.toString(), 7);

    expect(data.competitorComparison).toBeUndefined();
  });
});
