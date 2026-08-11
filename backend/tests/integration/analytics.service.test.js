import { describe, it, expect, afterEach, vi } from 'vitest';
import { createRequire } from 'module';
import { createFakeRedisClient } from '../mocks/redis.mock.js';

// See tests/integration/auth.service.test.js for why createRequire is used
// instead of `import` for local project files under test.
const require = createRequire(import.meta.url);
const redisConfig = require('../../src/config/redis.js');
redisConfig._setClientForTesting(createFakeRedisClient());

const analyticsService = require('../../src/services/analytics.service.js');
const Video = require('../../src/models/video.model.js');
const User = require('../../src/models/user.model.js');
const YoutubeChannel = require('../../src/models/youtube-channel.model.js');
const { ChannelAnalytics, VideoAnalytics } = require('../../src/models/analytics.model.js');

// Mocks the 3 YouTube API calls syncChannelVideos() makes in sequence:
// GET /channels (uploads playlist id) -> GET /playlistItems (video ids) ->
// GET /videos (details/stats for those ids, batched).
const setupSyncFetchMock = ({ uploadsPlaylistId = 'PL_uploads', videoIdsInPlaylist = [] } = {}) => {
  const fetchMock = vi.fn(async (url) => {
    const urlStr = String(url);
    if (urlStr.includes('/channels?')) {
      return {
        ok: true,
        json: async () => ({
          items: [{ contentDetails: { relatedPlaylists: { uploads: uploadsPlaylistId } } }],
        }),
      };
    }
    if (urlStr.includes('/playlistItems?')) {
      return {
        ok: true,
        json: async () => ({
          items: videoIdsInPlaylist.map((id) => ({ contentDetails: { videoId: id } })),
          nextPageToken: null,
        }),
      };
    }
    if (urlStr.includes('/videos?')) {
      const idsParam = new URL(urlStr).searchParams.get('id');
      const ids = (idsParam || '').split(',').filter(Boolean);
      return {
        ok: true,
        json: async () => ({
          items: ids.map((id) => ({
            id,
            snippet: {
              title: `Video ${id}`,
              publishedAt: new Date().toISOString(),
              thumbnails: {},
            },
            statistics: { viewCount: '0', likeCount: '0', commentCount: '0' },
            contentDetails: { duration: 'PT2M0S' },
            status: { privacyStatus: 'public' },
          })),
        }),
      };
    }
    throw new Error(`Unexpected fetch URL in test: ${urlStr}`);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

const createFixtures = async (channelOverrides = {}) => {
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
    ...channelOverrides,
  });
  return { user, channel };
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('analytics.service.syncChannelVideos — reconciliation with the real YouTube state', () => {
  it('skips re-importing a video the user deliberately excluded (Vezrin-only delete)', async () => {
    const { user, channel } = await createFixtures({ excludedVideoIds: ['yt_excluded_1'] });
    setupSyncFetchMock({ videoIdsInPlaylist: ['yt_excluded_1', 'yt_new_1'] });

    const synced = await analyticsService.syncChannelVideos(
      channel,
      'fake-token',
      user._id.toString()
    );

    expect(synced).toBe(1); // only yt_new_1 — yt_excluded_1 skipped

    expect(await Video.findOne({ youtubeVideoId: 'yt_excluded_1' })).toBeNull();
    expect(await Video.findOne({ youtubeVideoId: 'yt_new_1' })).toBeTruthy();
  });

  it('marks a previously-synced video failed when it is no longer in the uploads playlist', async () => {
    const { user, channel } = await createFixtures();
    const goneVideo = await Video.create({
      userId: user._id,
      channelId: channel._id,
      title: 'Now Gone',
      youtubeVideoId: 'yt_gone_1',
      status: 'published',
    });

    // yt_gone_1 is no longer in the current playlist — deleted directly on YouTube
    setupSyncFetchMock({ videoIdsInPlaylist: ['yt_still_here'] });

    await analyticsService.syncChannelVideos(channel, 'fake-token', user._id.toString());

    const dbVideo = await Video.findById(goneVideo._id);
    expect(dbVideo.status).toBe('failed');
    expect(dbVideo.lastError.code).toBe('MISSING_FROM_YOUTUBE');
  });

  it('marks a video failed when it claims to be published but has no youtubeVideoId', async () => {
    const { user, channel } = await createFixtures();
    const ghost = await Video.create({
      userId: user._id,
      channelId: channel._id,
      title: 'unknown for trial',
      youtubeVideoId: null,
      status: 'published',
    });

    setupSyncFetchMock({ videoIdsInPlaylist: ['yt_real_1'] });

    await analyticsService.syncChannelVideos(channel, 'fake-token', user._id.toString());

    const dbVideo = await Video.findById(ghost._id);
    expect(dbVideo.status).toBe('failed');
    expect(dbVideo.lastError.code).toBe('NEVER_UPLOADED');
  });

  it('does not touch local-only drafts (no youtubeVideoId) during reconciliation', async () => {
    const { user, channel } = await createFixtures();
    const draft = await Video.create({
      userId: user._id,
      channelId: channel._id,
      title: 'Untouched Draft',
      status: 'draft',
    });

    setupSyncFetchMock({ videoIdsInPlaylist: ['yt_some_video'] });

    await analyticsService.syncChannelVideos(channel, 'fake-token', user._id.toString());

    const dbDraft = await Video.findById(draft._id);
    expect(dbDraft.status).toBe('draft'); // unchanged — never had a youtubeVideoId to reconcile against
  });

  it('still imports a normal new video correctly (no exclusions, nothing missing)', async () => {
    const { user, channel } = await createFixtures();
    setupSyncFetchMock({ videoIdsInPlaylist: ['yt_brand_new'] });

    const synced = await analyticsService.syncChannelVideos(
      channel,
      'fake-token',
      user._id.toString()
    );

    expect(synced).toBe(1);
    const dbVideo = await Video.findOne({ youtubeVideoId: 'yt_brand_new' });
    expect(dbVideo.status).toBe('published');
    expect(dbVideo.title).toBe('Video yt_brand_new');
  });
});

describe('analytics.service.getVideoBreakdown — channel analyticsMode passthrough', () => {
  // Regression test: the video detail page showed all-zero totals with zero
  // explanation whenever the channel never granted Analytics API access
  // (basic mode) — the per-video daily breakdown structurally can't exist
  // without that scope, but the frontend had no way to know why. Fixed by
  // populating analyticsMode alongside the channel info already returned.
  it('includes the channel analyticsMode so the frontend can explain empty/basic data', async () => {
    const { user, channel } = await createFixtures({ analyticsMode: 'basic' });
    const video = await Video.create({
      userId: user._id,
      channelId: channel._id,
      title: 'Basic Mode Video',
      status: 'published',
      // No youtubeVideoId — skips the lazy on-demand YouTube Analytics fetch,
      // keeping this test focused purely on the analyticsMode passthrough.
    });

    const result = await analyticsService.getVideoBreakdown(
      user._id.toString(),
      video._id.toString()
    );

    expect(result.video.channel.analyticsMode).toBe('basic');
    expect(result.totals.views).toBe(0); // no performance.views set on this video
  });

  it('reflects full mode when the channel has real Analytics access', async () => {
    const { user, channel } = await createFixtures({ analyticsMode: 'full' });
    const video = await Video.create({
      userId: user._id,
      channelId: channel._id,
      title: 'Full Mode Video',
      status: 'published',
    });

    const result = await analyticsService.getVideoBreakdown(
      user._id.toString(),
      video._id.toString()
    );

    expect(result.video.channel.analyticsMode).toBe('full');
  });
});

describe("analytics.service.getVideoBreakdown — daily data bounded to the video's own lifetime", () => {
  // Regression test: the {youtubeVideoId, date} unique index on VideoAnalytics
  // is global across the whole collection, not scoped per videoId -- so a
  // stray row dated before a video was ever published (e.g. left over from
  // an earlier, unrelated sync) could otherwise surface in that video's own
  // breakdown, silently defeating the hasNoDailyData "still processing" /
  // "basic mode" banners on the frontend (they'd never trigger since `daily`
  // technically wasn't empty).
  it('excludes VideoAnalytics rows dated before the video was published', async () => {
    const { user, channel } = await createFixtures({ analyticsMode: 'full' });
    const publishedAt = new Date('2026-07-28T00:00:00.000Z');
    const video = await Video.create({
      userId: user._id,
      channelId: channel._id,
      title: 'Recently Published Video',
      status: 'published',
      youtubeVideoId: 'yt_recent_1',
      publishedAt,
      performance: { views: 8, likes: 3 },
    });

    await VideoAnalytics.create({
      userId: user._id,
      channelId: channel._id,
      videoId: video._id,
      youtubeVideoId: video.youtubeVideoId,
      date: new Date('2026-01-30T00:00:00.000Z'), // months before publishedAt
      metrics: { views: 5, likes: 2 },
    });
    await VideoAnalytics.create({
      userId: user._id,
      channelId: channel._id,
      videoId: video._id,
      youtubeVideoId: video.youtubeVideoId,
      date: new Date('2026-07-29T00:00:00.000Z'), // within the video's real lifetime
      metrics: { views: 8, likes: 3 },
    });

    const result = await analyticsService.getVideoBreakdown(
      user._id.toString(),
      video._id.toString()
    );

    expect(result.daily).toHaveLength(1);
    expect(result.daily[0].date).toBe('2026-07-29');
    expect(result.totals.views).toBe(8);
    expect(result.totals.likes).toBe(3);
  });

  // Regression test: the first fix above only bounded the *initial* query.
  // When that bounded query comes back empty (the normal case for a video
  // with no real post-publish data yet -- e.g. still within YouTube's 24-72h
  // processing lag), getVideoBreakdown() falls into a lazy on-demand-sync
  // branch that re-queries VideoAnalytics a second time after fetching fresh
  // data -- that second query had the exact same unbounded
  // VideoAnalytics.find({videoId}) shape and silently reintroduced the same
  // pre-publish-date leak. Caught live: the initial-query fix alone did not
  // change the production symptom at all, because this video's real
  // Analytics data hadn't landed yet, so it always went through this path.
  it('also excludes pre-publish-date rows when the lazy on-demand sync re-fetches', async () => {
    const { user, channel } = await createFixtures({ analyticsMode: 'full' });
    const publishedAt = new Date('2026-07-28T00:00:00.000Z');
    const video = await Video.create({
      userId: user._id,
      channelId: channel._id,
      title: 'Lazy Sync Video',
      status: 'published',
      youtubeVideoId: 'yt_lazy_1',
      publishedAt,
      performance: { views: 8, likes: 3 },
    });

    // Only a stray pre-publish row exists -- the initial bounded query
    // returns empty, which is exactly what triggers the lazy on-demand sync.
    await VideoAnalytics.create({
      userId: user._id,
      channelId: channel._id,
      videoId: video._id,
      youtubeVideoId: video.youtubeVideoId,
      date: new Date('2026-01-30T00:00:00.000Z'),
      metrics: { views: 5 },
    });

    const fetchMock = vi.fn(async (url) => {
      const urlStr = String(url);
      if (urlStr.includes('youtubeanalytics.googleapis.com')) {
        return {
          ok: true,
          json: async () => ({
            columnHeaders: [{ name: 'day' }, { name: 'views' }, { name: 'likes' }],
            rows: [['2026-07-29', 8, 3]],
          }),
        };
      }
      throw new Error(`Unexpected fetch URL in test: ${urlStr}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await analyticsService.getVideoBreakdown(
      user._id.toString(),
      video._id.toString()
    );

    expect(result.daily).toHaveLength(1);
    expect(result.daily[0].date).toBe('2026-07-29');
    expect(result.totals.views).toBe(8);
  });

  // Regression test: this page has no period selector (unlike the
  // channel-level Analytics page's 7/30/90/365d tabs), so a video published
  // years ago used to query VideoAnalytics all the way back to its own
  // publishedAt -- the "Daily Performance" chart would then span that whole
  // multi-year range, crushing every real recent data point into a sliver at
  // one edge. Confirmed live on a video published in 2021.
  it('caps the query window at 1 year back even for a video published years ago', async () => {
    const { user, channel } = await createFixtures({ analyticsMode: 'full' });
    const publishedAt = new Date(Date.now() - 3 * 365 * 24 * 60 * 60 * 1000); // 3 years ago
    const video = await Video.create({
      userId: user._id,
      channelId: channel._id,
      title: 'Old Video',
      status: 'published',
      youtubeVideoId: 'yt_old_1',
      publishedAt,
    });

    await VideoAnalytics.create({
      userId: user._id,
      channelId: channel._id,
      videoId: video._id,
      youtubeVideoId: video.youtubeVideoId,
      date: new Date(Date.now() - 2 * 365 * 24 * 60 * 60 * 1000), // 2 years ago, outside the 1-year cap
      metrics: { views: 500 },
    });
    const recentDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000); // 10 days ago
    await VideoAnalytics.create({
      userId: user._id,
      channelId: channel._id,
      videoId: video._id,
      youtubeVideoId: video.youtubeVideoId,
      date: recentDate,
      metrics: { views: 20 },
    });

    const result = await analyticsService.getVideoBreakdown(
      user._id.toString(),
      video._id.toString()
    );

    expect(result.daily).toHaveLength(1);
    expect(result.daily[0].date).toBe(recentDate.toISOString().split('T')[0]);
    // Not asserting result.totals.views here — that now comes from
    // video.performance.views (Data API lifetime total), unrelated to this
    // test's actual concern (the daily breakdown's 1-year date cap).
  });
});

describe('analytics.service.getVideoBreakdown — views/likes totals use the Data API, not the Analytics API daily sum', () => {
  // Regression test for a real bug reported by a live user: the exact same
  // video showed 8 views/4 likes on the Videos list page (sourced from
  // video.performance, i.e. the YouTube Data API's videos.list statistics —
  // authoritative, no lag) but only 2 views/2 likes on this video's own
  // Analytics detail page (previously summed from the YouTube Analytics
  // API's per-day breakdown, which has YouTube's own well-known 24-48h
  // reporting lag on recent days — the same gap YouTube Studio itself
  // warns about). Fixed by sourcing totals.views/likes from
  // video.performance directly, matching the Videos list page, so the two
  // pages can never disagree about the same video's lifetime totals again.
  it('reports the Data API lifetime totals even when they are higher than the incomplete Analytics-API daily sum', async () => {
    const { user, channel } = await createFixtures({ analyticsMode: 'full' });
    const video = await Video.create({
      userId: user._id,
      channelId: channel._id,
      title: 'MP Tribal Museum: 5 Lessons from Our Educational Trip',
      status: 'published',
      youtubeVideoId: 'yt_real_totals_1',
      publishedAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000),
      // The real, authoritative lifetime totals — same numbers YouTube
      // itself shows, and what the Videos list page already displays.
      performance: { views: 8, likes: 4 },
    });

    // Analytics API's daily breakdown hasn't fully caught up yet — classic
    // reporting-lag scenario, undercounting against the real total above.
    await VideoAnalytics.create({
      userId: user._id,
      channelId: channel._id,
      videoId: video._id,
      youtubeVideoId: video.youtubeVideoId,
      date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      metrics: { views: 2, likes: 2 },
    });

    const result = await analyticsService.getVideoBreakdown(
      user._id.toString(),
      video._id.toString()
    );

    expect(result.totals.views).toBe(8);
    expect(result.totals.likes).toBe(4);
    // The daily breakdown itself is untouched — still genuinely sourced
    // from the Analytics API, since there's no Data API equivalent for a
    // day-by-day trend. Only the headline totals changed source.
    expect(result.daily).toHaveLength(1);
    expect(result.daily[0].views).toBe(2);
  });

  it('falls back to 0 (not the Analytics-API sum) when the video has never had a Data API stats sync', async () => {
    const { user, channel } = await createFixtures({ analyticsMode: 'full' });
    const video = await Video.create({
      userId: user._id,
      channelId: channel._id,
      title: 'Never Stats-Synced Video',
      status: 'published',
      youtubeVideoId: 'yt_no_perf_1',
      // No `performance` field at all.
    });

    await VideoAnalytics.create({
      userId: user._id,
      channelId: channel._id,
      videoId: video._id,
      youtubeVideoId: video.youtubeVideoId,
      date: new Date(),
      metrics: { views: 50, likes: 10 },
    });

    const result = await analyticsService.getVideoBreakdown(
      user._id.toString(),
      video._id.toString()
    );

    expect(result.totals.views).toBe(0);
    expect(result.totals.likes).toBe(0);
  });
});

describe('analytics.service.getVideoBreakdown — re-syncs a stale daily breakdown, not just an empty one', () => {
  // Regression test for a real bug reported by a live user: a low-view video
  // that had fallen out of the channel-wide sync's top-N (syncTopVideoAnalytics
  // only covers the top 20 by views) got ONE early VideoAnalytics row from
  // back when it was still in that top-N, then was frozen forever — the old
  // lazy-sync condition (`dailyData.length === 0`) never re-fired once any
  // row existed, so the "Daily Performance" chart kept showing a flat line
  // at 0 for every day after that single stale row while Total Views (now
  // correctly Data-API-sourced) kept climbing. Confirmed live: a video
  // published 28 Jul with a real Data API total of 9 views showed a chart
  // with a single point on 29 Jul (2 views) then a flat 0 line all the way
  // to today.
  it('re-fetches when the most recent daily row is more than 24h old', async () => {
    const { user, channel } = await createFixtures({ analyticsMode: 'full' });
    const publishedAt = new Date(Date.now() - 12 * 24 * 60 * 60 * 1000);
    const video = await Video.create({
      userId: user._id,
      channelId: channel._id,
      title: 'Fell Out Of Top-N Video',
      status: 'published',
      youtubeVideoId: 'yt_stale_1',
      publishedAt,
      performance: { views: 9, likes: 4 },
    });

    // One real row from an earlier sync, now 10 days stale — this is
    // exactly the "frozen after falling out of top-N" shape.
    await VideoAnalytics.create({
      userId: user._id,
      channelId: channel._id,
      videoId: video._id,
      youtubeVideoId: video.youtubeVideoId,
      date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      metrics: { views: 2, likes: 1 },
    });

    const freshDay = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const fetchMock = vi.fn(async (url) => {
      const urlStr = String(url);
      if (urlStr.includes('youtubeanalytics.googleapis.com')) {
        return {
          ok: true,
          json: async () => ({
            columnHeaders: [{ name: 'day' }, { name: 'views' }, { name: 'likes' }],
            rows: [[freshDay, 7, 3]],
          }),
        };
      }
      throw new Error(`Unexpected fetch URL in test: ${urlStr}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await analyticsService.getVideoBreakdown(
      user._id.toString(),
      video._id.toString()
    );

    // The re-sync ran (fetch was actually called against the Analytics API)
    // and the new, more recent row is now present in the daily breakdown —
    // the chart is no longer frozen on the 10-day-old point alone.
    expect(fetchMock).toHaveBeenCalled();
    expect(result.daily.some((d) => d.date === freshDay)).toBe(true);
  });

  it('does not re-fetch when the most recent daily row is less than 24h old', async () => {
    const { user, channel } = await createFixtures({ analyticsMode: 'full' });
    const video = await Video.create({
      userId: user._id,
      channelId: channel._id,
      title: 'Recently Synced Video',
      status: 'published',
      youtubeVideoId: 'yt_fresh_1',
      publishedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      performance: { views: 5, likes: 2 },
    });

    await VideoAnalytics.create({
      userId: user._id,
      channelId: channel._id,
      videoId: video._id,
      youtubeVideoId: video.youtubeVideoId,
      date: new Date(), // today — fresh
      metrics: { views: 5, likes: 2 },
    });

    const fetchMock = vi.fn(async () => {
      throw new Error('fetch should not have been called — data is fresh');
    });
    vi.stubGlobal('fetch', fetchMock);

    await analyticsService.getVideoBreakdown(user._id.toString(), video._id.toString());

    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('analytics.service.invalidateAnalyticsCache — per-video cache busting', () => {
  // Regression test: getVideoBreakdown() caches per-video (analytics:video:ID),
  // but invalidateAnalyticsCache(channelId) -- called every time Sync runs --
  // only ever cleared channel-level keys. A stale/wrong per-video breakdown
  // could keep serving for its full 30-minute TTL no matter how many times
  // the user clicked Sync.
  it('clears cached per-video breakdowns for every video on the channel', async () => {
    const { user, channel } = await createFixtures();
    const video = await Video.create({
      userId: user._id,
      channelId: channel._id,
      title: 'Cached Video',
      status: 'published',
      youtubeVideoId: 'yt_cached_1',
    });

    const cacheKey = `analytics:video:${video._id}`;
    await redisConfig.setCache(cacheKey, { stale: true }, 1800);
    expect(await redisConfig.getCache(cacheKey)).toEqual({ stale: true });

    await analyticsService.invalidateAnalyticsCache(channel._id.toString());

    expect(await redisConfig.getCache(cacheKey)).toBeNull();
  });

  // Regression test: growth.service.js's getGrowthPrediction() caches for
  // 12h with no invalidation hook anywhere else in the codebase -- a stale
  // prediction (e.g. one computed before a real data or code fix) would
  // keep serving for up to 12h after every single Sync click, regardless of
  // how many times the user re-synced.
  it('clears the 12h growth prediction cache too', async () => {
    const { channel } = await createFixtures();

    const cacheKey = `growth:prediction:${channel._id}`;
    await redisConfig.setCache(cacheKey, { stale: true }, 12 * 60 * 60);
    expect(await redisConfig.getCache(cacheKey)).toEqual({ stale: true });

    await analyticsService.invalidateAnalyticsCache(channel._id.toString());

    expect(await redisConfig.getCache(cacheKey)).toBeNull();
  });
});

describe('analytics.service.getOverview — views.delta always defined, unlike change', () => {
  // Regression test: calcChange() returns null whenever the previous period
  // had zero views -- extremely common for small/new channels, and it
  // happens independently on every period tab (7d/30d/90d). That hid the %
  // badge entirely on the frontend even though "0 -> N views" is real,
  // meaningful growth. delta is a plain subtraction with no null-guard, so
  // it's always a real number the frontend can fall back to.
  it('reports a real delta even when the previous period had zero views (change is null)', async () => {
    const { channel } = await createFixtures();
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;

    // Current 7d window: 10 views. Previous 7d window (8-14 days ago): none.
    await ChannelAnalytics.create({
      userId: channel.userId,
      channelId: channel._id,
      date: new Date(now - 2 * day),
      metrics: { views: 10 },
    });

    const result = await analyticsService.getOverview(
      channel.userId.toString(),
      channel._id.toString(),
      '7d'
    );

    expect(result.metrics.views.change).toBeNull();
    expect(result.metrics.views.delta).toBe(10);
  });

  it('reports a negative delta when views dropped between periods', async () => {
    const { channel } = await createFixtures();
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;

    await ChannelAnalytics.create({
      userId: channel.userId,
      channelId: channel._id,
      date: new Date(now - 2 * day),
      metrics: { views: 5 },
    });
    await ChannelAnalytics.create({
      userId: channel.userId,
      channelId: channel._id,
      date: new Date(now - 10 * day),
      metrics: { views: 20 },
    });

    const result = await analyticsService.getOverview(
      channel.userId.toString(),
      channel._id.toString(),
      '7d'
    );

    expect(result.metrics.views.delta).toBe(-15);
  });
});

describe('analytics.service.getOverview — video-performance fallback only fires when NO analytics data exists at all', () => {
  // Regression test for a real bug: the fallback used to check
  // `!curr.totalViews` (this period's own sum), so a narrow period (7d/30d)
  // whose date window happened to miss a channel's real-but-sparse
  // ChannelAnalytics rows would silently substitute an entirely different,
  // unbounded lifetime Video.performance.views total — while a wider period
  // (90d/365d) that DID catch those same rows used the real, smaller,
  // period-scoped sum. Net effect: the wider period showed FEWER views than
  // the narrower one for the identical channel, which is impossible for a
  // true superset window. Fixed by gating the fallback on whether the
  // channel has ANY ChannelAnalytics row ever, independent of the selected
  // period.
  it('does NOT fall back to the lifetime video total when real (but out-of-window) analytics data exists — a real zero period stays zero', async () => {
    const { user, channel } = await createFixtures();
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;

    // Real ChannelAnalytics row exists, but 45 days ago — outside a 7d or
    // 30d window, inside a 90d window.
    await ChannelAnalytics.create({
      userId: channel.userId,
      channelId: channel._id,
      date: new Date(now - 45 * day),
      metrics: { views: 5000, likes: 100 },
    });

    // A published, synced video with a much larger LIFETIME view count —
    // this is what the old buggy fallback would have surfaced instead.
    await Video.create({
      userId: user._id,
      channelId: channel._id,
      youtubeVideoId: 'yt_lifetime_1',
      title: 'Old video',
      status: 'published',
      performance: { views: 50000, likes: 1000, comments: 10, lastSyncedAt: new Date() },
    });

    const narrow = await analyticsService.getOverview(
      channel.userId.toString(),
      channel._id.toString(),
      '7d'
    );
    expect(narrow.metrics.views.value).toBe(0);

    const wide = await analyticsService.getOverview(
      channel.userId.toString(),
      channel._id.toString(),
      '90d'
    );
    expect(wide.metrics.views.value).toBe(5000);

    // The core invariant that was violated: a wider window must never show
    // fewer views than a narrower one for the same channel.
    expect(wide.metrics.views.value).toBeGreaterThanOrEqual(narrow.metrics.views.value);
  });

  it('still falls back to the lifetime video total when the channel has no ChannelAnalytics data at all (real basic-mode case)', async () => {
    const { user, channel } = await createFixtures();

    await Video.create({
      userId: user._id,
      channelId: channel._id,
      youtubeVideoId: 'yt_basic_1',
      title: 'Basic-mode video',
      status: 'published',
      performance: { views: 5000, likes: 200, comments: 5, lastSyncedAt: new Date() },
    });

    const result = await analyticsService.getOverview(
      channel.userId.toString(),
      channel._id.toString(),
      '30d'
    );

    expect(result.metrics.views.value).toBe(5000);
  });
});
