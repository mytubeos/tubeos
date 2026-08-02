import { describe, it, expect, afterEach, vi } from 'vitest';
import { createRequire } from 'module';

// See tests/integration/auth.service.test.js for why createRequire is used
// instead of `import` for local project files under test.
const require = createRequire(import.meta.url);
const { reapPublishedSchedules, downgradeExpiredSubscriptions } = require('../../src/jobs/cron.js');
const storageService = require('../../src/services/storage.service.js');
const Schedule = require('../../src/models/schedule.model.js');
const Video = require('../../src/models/video.model.js');
const User = require('../../src/models/user.model.js');
const YoutubeChannel = require('../../src/models/youtube-channel.model.js');
const Notification = require('../../src/models/notification.model.js');

// Same monkey-patch approach as video.service.test.js — storage.service.js
// is loaded via the same createRequire "world" as cron.js's
// require('../services/video.service'), which itself requires
// storage.service.js, so patching its exports here is visible there too.
const originalDeleteFile = storageService.deleteFile;
const originalCreateReadStream = storageService.createReadStream;

const setupFetchMock = ({ initOk = true, uploadOk = true } = {}) => {
  const fetchMock = vi.fn(async (url) => {
    if (typeof url === 'string' && url.includes('uploadType=resumable')) {
      if (!initOk) {
        return { ok: false, json: async () => ({ error: { message: 'YouTube init failed' } }) };
      }
      return { ok: true, headers: { get: () => 'https://upload.example.com/session123' } };
    }
    if (!uploadOk) {
      return { ok: false, json: async () => ({ error: { message: 'YouTube upload failed' } }) };
    }
    return { ok: true, json: async () => ({ id: 'yt_video_123' }) };
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

// Mocks GET /videos?part=status&id=... — the uploadStatus lookup used by
// Part 3 of reapPublishedSchedules (checking on still-"processing" videos).
const setupUploadStatusFetchMock = (statusById) => {
  const fetchMock = vi.fn(async (url) => {
    const idsParam = new URL(url).searchParams.get('id');
    const ids = (idsParam || '').split(',');
    return {
      ok: true,
      json: async () => ({
        items: ids
          .filter((id) => statusById[id])
          .map((id) => ({ id, status: { uploadStatus: statusById[id] } })),
      }),
    };
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

const createBaseFixtures = async (userOverrides = {}) => {
  const user = await User.create({
    name: 'Creator',
    email: `creator-${Date.now()}-${Math.random()}@example.com`,
    password: 'password123',
    isEmailVerified: true,
    plan: 'creator', // uploads limit 5 (free plan has 0)
    ...userOverrides,
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

const fakeStagedFile = () => ({
  gcsPath: `staging/${Math.random()}/video.mp4`,
  bucket: 'test-bucket',
  size: 12345,
  mimeType: 'video/mp4',
});

afterEach(() => {
  vi.unstubAllGlobals();
  storageService.deleteFile = originalDeleteFile;
  storageService.createReadStream = originalCreateReadStream;
});

describe('cron.reapPublishedSchedules — Schedule-backed drafts (real upload at due time)', () => {
  it('uploads the staged file to YouTube and marks both records published', async () => {
    setupFetchMock({ initOk: true, uploadOk: true });
    storageService.createReadStream = vi.fn(() => 'fake-stream');
    storageService.deleteFile = vi.fn(async () => {});

    const { user, channel } = await createBaseFixtures();
    const video = await Video.create({
      userId: user._id,
      channelId: channel._id,
      title: 'Staged Video',
      status: 'scheduled',
      stagedFile: fakeStagedFile(),
    });
    const schedule = await Schedule.create({
      userId: user._id,
      channelId: channel._id,
      videoId: video._id,
      scheduledAt: new Date(Date.now() - 60 * 1000),
    });

    await reapPublishedSchedules();

    const dbSchedule = await Schedule.findById(schedule._id);
    expect(dbSchedule.status).toBe('published');
    expect(dbSchedule.executedAt).toBeTruthy();

    const dbVideo = await Video.findById(video._id);
    expect(dbVideo.status).toBe('processing'); // matches a direct "Upload Now" with no schedule
    expect(dbVideo.youtubeVideoId).toBe('yt_video_123');
    expect(dbVideo.stagedFile?.gcsPath).toBeFalsy(); // dangling reference cleared
    expect(storageService.deleteFile).toHaveBeenCalledWith(video.stagedFile.gcsPath);
  });

  it('marks the schedule failed (not published) when the draft has no staged file', async () => {
    const { user, channel } = await createBaseFixtures();
    const video = await Video.create({
      userId: user._id,
      channelId: channel._id,
      title: 'Fileless Draft',
      status: 'scheduled',
    });
    const schedule = await Schedule.create({
      userId: user._id,
      channelId: channel._id,
      videoId: video._id,
      scheduledAt: new Date(Date.now() - 60 * 1000),
    });

    await reapPublishedSchedules();

    const dbSchedule = await Schedule.findById(schedule._id);
    expect(dbSchedule.status).toBe('failed');
    expect(dbSchedule.failReason).toMatch(/no video file/i);

    const dbVideo = await Video.findById(video._id);
    expect(dbVideo.status).toBe('scheduled'); // untouched — never attempted
  });

  it('marks the schedule failed when the real YouTube upload fails', async () => {
    setupFetchMock({ initOk: false });
    storageService.createReadStream = vi.fn(() => 'fake-stream');
    storageService.deleteFile = vi.fn(async () => {});

    const { user, channel } = await createBaseFixtures();
    const video = await Video.create({
      userId: user._id,
      channelId: channel._id,
      title: 'Will fail to upload',
      status: 'scheduled',
      stagedFile: fakeStagedFile(),
    });
    const schedule = await Schedule.create({
      userId: user._id,
      channelId: channel._id,
      videoId: video._id,
      scheduledAt: new Date(Date.now() - 60 * 1000),
    });

    await reapPublishedSchedules();

    const dbSchedule = await Schedule.findById(schedule._id);
    expect(dbSchedule.status).toBe('failed');
    expect(dbSchedule.failReason).toMatch(/youtube init failed/i);

    const dbVideo = await Video.findById(video._id);
    expect(dbVideo.status).toBe('failed'); // set by uploadVideo()'s own catch block
    expect(dbVideo.stagedFile?.gcsPath).toBeFalsy(); // still cleared, GCS object still deleted
  });

  it('marks the schedule failed when its linked video record no longer exists', async () => {
    const { user, channel } = await createBaseFixtures();
    const video = await Video.create({
      userId: user._id,
      channelId: channel._id,
      title: 'Will be deleted',
      status: 'scheduled',
      stagedFile: fakeStagedFile(),
    });
    const schedule = await Schedule.create({
      userId: user._id,
      channelId: channel._id,
      videoId: video._id,
      scheduledAt: new Date(Date.now() - 60 * 1000),
    });
    await Video.findByIdAndDelete(video._id);

    await reapPublishedSchedules();

    const dbSchedule = await Schedule.findById(schedule._id);
    expect(dbSchedule.status).toBe('failed');
    expect(dbSchedule.failReason).toMatch(/video record missing/i);
  });

  it('leaves a schedule alone if scheduledAt is still in the future', async () => {
    const { user, channel } = await createBaseFixtures();
    const video = await Video.create({
      userId: user._id,
      channelId: channel._id,
      title: 'Future Video',
      status: 'scheduled',
      stagedFile: fakeStagedFile(),
    });
    const scheduledAt = new Date(Date.now() + 60 * 60 * 1000);
    const schedule = await Schedule.create({
      userId: user._id,
      channelId: channel._id,
      videoId: video._id,
      scheduledAt,
    });

    await reapPublishedSchedules();

    const dbSchedule = await Schedule.findById(schedule._id);
    expect(dbSchedule.status).toBe('pending');

    const dbVideo = await Video.findById(video._id);
    expect(dbVideo.status).toBe('scheduled');
    expect(dbVideo.stagedFile?.gcsPath).toBeTruthy(); // untouched
  });

  it('processes multiple due schedules in a single run and leaves not-yet-due ones untouched', async () => {
    setupFetchMock({ initOk: true, uploadOk: true });
    storageService.createReadStream = vi.fn(() => 'fake-stream');
    storageService.deleteFile = vi.fn(async () => {});

    const { user, channel } = await createBaseFixtures();

    const dueVideos = await Promise.all(
      [1, 2].map((i) =>
        Video.create({
          userId: user._id,
          channelId: channel._id,
          title: `Due Video ${i}`,
          status: 'scheduled',
          stagedFile: fakeStagedFile(),
        })
      )
    );
    const dueSchedules = await Promise.all(
      dueVideos.map((v) =>
        Schedule.create({
          userId: user._id,
          channelId: channel._id,
          videoId: v._id,
          scheduledAt: new Date(Date.now() - 60 * 1000),
        })
      )
    );

    const futureVideo = await Video.create({
      userId: user._id,
      channelId: channel._id,
      title: 'Not due yet',
      status: 'scheduled',
      stagedFile: fakeStagedFile(),
    });
    const futureSchedule = await Schedule.create({
      userId: user._id,
      channelId: channel._id,
      videoId: futureVideo._id,
      scheduledAt: new Date(Date.now() + 60 * 60 * 1000),
    });

    await reapPublishedSchedules();

    for (const s of dueSchedules) {
      const updated = await Schedule.findById(s._id);
      expect(updated.status).toBe('published');
    }
    const untouchedSchedule = await Schedule.findById(futureSchedule._id);
    expect(untouchedSchedule.status).toBe('pending');
  });
});

describe('cron.reapPublishedSchedules — direct (Upload-page) schedules', () => {
  it('flips a due direct-scheduled video to published once its time has passed', async () => {
    const { user, channel } = await createBaseFixtures();
    const video = await Video.create({
      userId: user._id,
      channelId: channel._id,
      title: 'Direct-scheduled video',
      status: 'scheduled',
      youtubeVideoId: 'yt_already_uploaded',
      scheduledAt: new Date(Date.now() - 60 * 1000),
    });

    await reapPublishedSchedules();

    const dbVideo = await Video.findById(video._id);
    expect(dbVideo.status).toBe('published');
    expect(dbVideo.publishedAt).toBeTruthy();
  });

  it('leaves a direct-scheduled video alone if its time is still in the future', async () => {
    const { user, channel } = await createBaseFixtures();
    const video = await Video.create({
      userId: user._id,
      channelId: channel._id,
      title: 'Future direct-scheduled video',
      status: 'scheduled',
      youtubeVideoId: 'yt_already_uploaded',
      scheduledAt: new Date(Date.now() + 60 * 60 * 1000),
    });

    await reapPublishedSchedules();

    const dbVideo = await Video.findById(video._id);
    expect(dbVideo.status).toBe('scheduled');
  });

  it('does not touch a due "scheduled" video that was never actually uploaded to YouTube', async () => {
    // Defensive check: a plain Video.status='scheduled' with no
    // youtubeVideoId shouldn't occur via either real code path, but if it
    // ever did, this must not get marked published — nothing is live.
    const { user, channel } = await createBaseFixtures();
    const video = await Video.create({
      userId: user._id,
      channelId: channel._id,
      title: 'Never uploaded',
      status: 'scheduled',
      scheduledAt: new Date(Date.now() - 60 * 1000),
    });

    await reapPublishedSchedules();

    const dbVideo = await Video.findById(video._id);
    expect(dbVideo.status).toBe('scheduled');
  });
});

describe('cron.reapPublishedSchedules — refreshing "processing" videos', () => {
  it('marks a video published once YouTube reports it finished processing', async () => {
    const { user, channel } = await createBaseFixtures();
    const video = await Video.create({
      userId: user._id,
      channelId: channel._id,
      title: 'Short video',
      status: 'processing',
      youtubeVideoId: 'yt_short_video',
    });
    setupUploadStatusFetchMock({ yt_short_video: 'processed' });

    await reapPublishedSchedules();

    const dbVideo = await Video.findById(video._id);
    expect(dbVideo.status).toBe('published');
    expect(dbVideo.publishedAt).toBeTruthy();
  });

  it('marks a video failed if YouTube rejected/failed it after upload', async () => {
    const { user, channel } = await createBaseFixtures();
    const video = await Video.create({
      userId: user._id,
      channelId: channel._id,
      title: 'Rejected video',
      status: 'processing',
      youtubeVideoId: 'yt_rejected_video',
    });
    setupUploadStatusFetchMock({ yt_rejected_video: 'rejected' });

    await reapPublishedSchedules();

    const dbVideo = await Video.findById(video._id);
    expect(dbVideo.status).toBe('failed');
    expect(dbVideo.lastError?.message).toMatch(/rejected/i);
  });

  it('leaves a video alone while YouTube still reports it as uploaded (still processing)', async () => {
    const { user, channel } = await createBaseFixtures();
    const video = await Video.create({
      userId: user._id,
      channelId: channel._id,
      title: 'Still processing',
      status: 'processing',
      youtubeVideoId: 'yt_still_processing',
    });
    setupUploadStatusFetchMock({ yt_still_processing: 'uploaded' });

    await reapPublishedSchedules();

    const dbVideo = await Video.findById(video._id);
    expect(dbVideo.status).toBe('processing');
  });

  it('checks multiple processing videos across different channels independently', async () => {
    const { user: userA, channel: channelA } = await createBaseFixtures();
    const { user: userB, channel: channelB } = await createBaseFixtures();
    const videoA = await Video.create({
      userId: userA._id,
      channelId: channelA._id,
      title: 'Channel A video',
      status: 'processing',
      youtubeVideoId: 'yt_a',
    });
    const videoB = await Video.create({
      userId: userB._id,
      channelId: channelB._id,
      title: 'Channel B video',
      status: 'processing',
      youtubeVideoId: 'yt_b',
    });
    setupUploadStatusFetchMock({ yt_a: 'processed', yt_b: 'uploaded' });

    await reapPublishedSchedules();

    expect((await Video.findById(videoA._id)).status).toBe('published');
    expect((await Video.findById(videoB._id)).status).toBe('processing');
  });
});

describe('cron.downgradeExpiredSubscriptions', () => {
  // Regression test: billing here is a manual monthly top-up, not an
  // auto-charge subscription (see payment.service.js) -- nothing anywhere
  // else in the codebase ever checked subscriptionExpiresAt against "now",
  // so a paid plan stayed active forever after a single payment. This job
  // is the only enforcement point.
  it('downgrades a user whose subscriptionExpiresAt has already passed', async () => {
    const user = await User.create({
      name: 'Expired Payer',
      email: `expired-${Date.now()}-${Math.random()}@example.com`,
      password: 'password123',
      plan: 'agency',
      subscriptionExpiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // yesterday
    });

    await downgradeExpiredSubscriptions();

    const dbUser = await User.findById(user._id);
    expect(dbUser.plan).toBe('free');
    expect(dbUser.subscriptionExpiresAt).toBeNull();

    const notification = await Notification.findOne({ userId: user._id });
    expect(notification).toBeTruthy();
    expect(notification.type).toBe('subscription_expired');
    expect(notification.message).toMatch(/agency/i);
  });

  it('leaves a still-active paid subscription untouched', async () => {
    const user = await User.create({
      name: 'Active Payer',
      email: `active-${Date.now()}-${Math.random()}@example.com`,
      password: 'password123',
      plan: 'pro',
      subscriptionExpiresAt: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), // 15 days from now
    });

    await downgradeExpiredSubscriptions();

    const dbUser = await User.findById(user._id);
    expect(dbUser.plan).toBe('pro');
    expect(dbUser.subscriptionExpiresAt).toBeTruthy();

    const notification = await Notification.findOne({ userId: user._id });
    expect(notification).toBeNull();
  });

  it('does not touch users already on the free plan', async () => {
    const user = await User.create({
      name: 'Free User',
      email: `free-${Date.now()}-${Math.random()}@example.com`,
      password: 'password123',
      plan: 'free',
    });

    await downgradeExpiredSubscriptions();

    const dbUser = await User.findById(user._id);
    expect(dbUser.plan).toBe('free');
  });
});
