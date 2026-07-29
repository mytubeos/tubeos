import { describe, it, expect, afterEach, vi } from 'vitest';
import { createRequire } from 'module';

// See tests/integration/auth.service.test.js for why createRequire is used
// instead of `import` for local project files under test.
const require = createRequire(import.meta.url);
const analyticsService = require('../../src/services/analytics.service.js');
const Video = require('../../src/models/video.model.js');
const User = require('../../src/models/user.model.js');
const YoutubeChannel = require('../../src/models/youtube-channel.model.js');

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
    expect(result.totals.views).toBe(0); // no VideoAnalytics rows exist for this video
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
