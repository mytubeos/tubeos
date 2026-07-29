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

// Mocks the POST /comments?part=snippet call postReply() makes to publish a
// reply to YouTube. Captures the request so tests can assert the exact body
// sent (e.g. an edited reply overriding the stored AI draft).
const setupPostReplyFetchMock = ({ ok = true } = {}) => {
  let counter = 0;
  const fetchMock = vi.fn(async () => {
    if (!ok) {
      return {
        ok: false,
        status: 500,
        json: async () => ({ error: { message: 'YouTube post failed' } }),
      };
    }
    counter += 1;
    return { ok: true, json: async () => ({ id: `yt_reply_${counter}` }) };
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

const createCommentWithDraft = async (userId, channelId, overrides = {}) =>
  require('../../src/models/comment.model.js').create({
    userId,
    channelId,
    youtubeCommentId: `yt_c_${Math.random().toString(36).slice(2, 10)}`,
    youtubeVideoId: 'yt_video_abc',
    authorName: 'Viewer',
    text: 'Nice video',
    publishedAt: new Date(),
    status: 'pending_reply',
    aiReply: { text: 'Thanks a lot!', generatedAt: new Date(), model: 'creator', tone: 'friendly' },
    ...overrides,
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

describe('ai-comment.service.bulkPostReplies — review-then-post-all', () => {
  it('posts multiple approved drafts to YouTube and marks each comment replied', async () => {
    const { user, channel } = await createFixtures();
    const c1 = await createCommentWithDraft(user._id, channel._id);
    const c2 = await createCommentWithDraft(user._id, channel._id, { text: 'Second comment' });
    setupPostReplyFetchMock();

    const result = await aiCommentService.bulkPostReplies(user._id.toString(), [
      { commentId: c1._id.toString() },
      { commentId: c2._id.toString() },
    ]);

    expect(result.summary).toEqual({ total: 2, successful: 2, failed: 0 });

    const dbC1 = await Comment.findById(c1._id);
    expect(dbC1.status).toBe('replied');
    expect(dbC1.youtubeReplyId).toMatch(/^yt_reply_/);
    expect(dbC1.aiReply.isEdited).toBe(false); // posted as-generated, not edited
  });

  it('uses an edited replyText override instead of the stored aiReply.text', async () => {
    const { user, channel } = await createFixtures();
    const c1 = await createCommentWithDraft(user._id, channel._id);
    const fetchMock = setupPostReplyFetchMock();

    await aiCommentService.bulkPostReplies(user._id.toString(), [
      { commentId: c1._id.toString(), replyText: 'Edited reply text' },
    ]);

    const postCall = fetchMock.mock.calls.find(([url]) =>
      String(url).includes('/comments?part=snippet')
    );
    const sentBody = JSON.parse(postCall[1].body);
    expect(sentBody.snippet.textOriginal).toBe('Edited reply text');

    const dbC1 = await Comment.findById(c1._id);
    expect(dbC1.aiReply.isEdited).toBe(true);
  });

  it('continues past a failure and reports it in the summary instead of aborting the batch', async () => {
    const { user, channel } = await createFixtures();
    const c1 = await createCommentWithDraft(user._id, channel._id);
    setupPostReplyFetchMock();

    const result = await aiCommentService.bulkPostReplies(user._id.toString(), [
      { commentId: c1._id.toString() },
      { commentId: '507f1f77bcf86cd799439011' }, // valid ObjectId shape, doesn't exist
    ]);

    expect(result.summary).toEqual({ total: 2, successful: 1, failed: 1 });
    const failedResult = result.results.find((r) => !r.success);
    expect(failedResult.error).toMatch(/not found/i);

    const dbC1 = await Comment.findById(c1._id);
    expect(dbC1.status).toBe('replied'); // the valid one still went through
  });
});
