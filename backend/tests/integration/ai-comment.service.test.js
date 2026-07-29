import { describe, it, expect, afterEach, vi } from 'vitest';
import { createRequire } from 'module';

// See tests/integration/auth.service.test.js for why createRequire is used
// instead of `import` for local project files under test.
const require = createRequire(import.meta.url);
const aiCommentService = require('../../src/services/ai-comment.service.js');
const Comment = require('../../src/models/comment.model.js');
const User = require('../../src/models/user.model.js');
const YoutubeChannel = require('../../src/models/youtube-channel.model.js');

// Mocks GET /commentThreads?... — the YouTube API call syncComments() makes.
const setupCommentThreadsFetchMock = (items, { ok = true, statusCode = 200 } = {}) => {
  const fetchMock = vi.fn(async () => {
    if (!ok) {
      return {
        ok: false,
        status: statusCode,
        json: async () => ({ error: { message: 'insufficient authentication scopes' } }),
      };
    }
    return { ok: true, json: async () => ({ items, nextPageToken: null }) };
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

const fakeCommentThread = (overrides = {}) => ({
  id: `yt_thread_${Math.random().toString(36).slice(2, 10)}`,
  snippet: {
    topLevelComment: {
      snippet: {
        authorDisplayName: 'Test Viewer',
        authorChannelId: { value: 'UCviewer123' },
        authorProfileImageUrl: 'https://example.com/avatar.jpg',
        textOriginal: 'Great video!',
        likeCount: 5,
        publishedAt: new Date().toISOString(),
        videoId: 'yt_video_abc',
        ...overrides,
      },
    },
  },
});

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
      expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1hr out — no refresh needed
    },
  });
  return { user, channel };
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ai-comment.service.syncComments — bulkWrite upsert', () => {
  it('inserts a brand-new comment without a Mongo $setOnInsert/$set path conflict', async () => {
    const { user, channel } = await createFixtures();
    const thread = fakeCommentThread();
    setupCommentThreadsFetchMock([thread]);

    // Regression test: syncComments() used to put `likeCount` in BOTH
    // $setOnInsert and $set for the same bulkWrite updateOne, which Mongo
    // rejects with "Updating the path 'likeCount' would create a conflict at
    // 'likeCount'" — a 500 on every single sync call. analyze:false skips the
    // AI sentiment step, which isn't what this test is about.
    const result = await aiCommentService.syncComments(
      user._id.toString(),
      channel._id.toString(),
      null,
      {
        analyze: false,
      }
    );

    expect(result.synced).toBe(1);

    const dbComment = await Comment.findOne({ youtubeCommentId: thread.id });
    expect(dbComment).toBeTruthy();
    expect(dbComment.text).toBe('Great video!');
    expect(dbComment.likeCount).toBe(5);
    expect(dbComment.authorName).toBe('Test Viewer');
  });

  it('updates likeCount on an existing comment when synced again (upsert match path)', async () => {
    const { user, channel } = await createFixtures();
    const thread = fakeCommentThread({ likeCount: 2 });

    setupCommentThreadsFetchMock([thread]);
    await aiCommentService.syncComments(user._id.toString(), channel._id.toString(), null, {
      analyze: false,
    });

    // Re-sync the same comment thread with an increased like count
    const updatedThread = fakeCommentThread({
      ...thread.snippet.topLevelComment.snippet,
      likeCount: 9,
    });
    updatedThread.id = thread.id; // same YouTube comment, just more likes now
    setupCommentThreadsFetchMock([updatedThread]);
    await aiCommentService.syncComments(user._id.toString(), channel._id.toString(), null, {
      analyze: false,
    });

    const dbComment = await Comment.findOne({ youtubeCommentId: thread.id });
    expect(dbComment.likeCount).toBe(9);
    // Only one document should exist for this youtubeCommentId (real upsert, not a duplicate insert)
    const count = await Comment.countDocuments({ youtubeCommentId: thread.id });
    expect(count).toBe(1);
  });

  it('maps a 403 from YouTube into an actionable reconnect message', async () => {
    const { user, channel } = await createFixtures();
    setupCommentThreadsFetchMock([], { ok: false, statusCode: 403 });

    await expect(
      aiCommentService.syncComments(user._id.toString(), channel._id.toString(), null, {
        analyze: false,
      })
    ).rejects.toMatchObject({
      statusCode: 403,
      code: 'COMMENTS_SCOPE_MISSING',
    });
  });
});
