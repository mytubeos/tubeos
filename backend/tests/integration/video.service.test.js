import { describe, it, expect, afterEach, vi } from 'vitest';
import { createRequire } from 'module';

// See tests/integration/auth.service.test.js for why createRequire is used
// instead of `import` for local project files under test.
const require = createRequire(import.meta.url);
const videoService = require('../../src/services/video.service.js');
const storageService = require('../../src/services/storage.service.js');
const Video = require('../../src/models/video.model.js');
const User = require('../../src/models/user.model.js');
const YoutubeChannel = require('../../src/models/youtube-channel.model.js');

// storage.service.js is loaded via the same createRequire "world" as
// video.service.js's own `require('./storage.service')`, so directly
// monkey-patching its exported functions (rather than vi.mock, which can't
// reach a plain-CJS file's internal require — see auth.service.test.js)
// is visible to video.service.js too.
const originalDeleteFile = storageService.deleteFile;
const originalCreateReadStream = storageService.createReadStream;

const setupFetchMock = ({ initOk = true, uploadOk = true } = {}) => {
  const fetchMock = vi.fn(async (url) => {
    if (typeof url === 'string' && url.includes('uploadType=resumable')) {
      if (!initOk) {
        return {
          ok: false,
          json: async () => ({ error: { message: 'YouTube init failed' } }),
        };
      }
      return {
        ok: true,
        headers: { get: () => 'https://upload.example.com/session123' },
      };
    }
    // Step 2: the PUT to the resumable upload URL
    if (!uploadOk) {
      return {
        ok: false,
        json: async () => ({ error: { message: 'YouTube upload failed' } }),
      };
    }
    return { ok: true, json: async () => ({ id: 'yt_video_123' }) };
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

const createFixtures = async (userOverrides = {}) => {
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
      expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1hr out — no refresh needed
    },
  });

  const video = await Video.create({
    userId: user._id,
    channelId: channel._id,
    title: 'My Test Video',
    status: 'draft',
  });

  return { user, channel, video };
};

const fakeGcsFileRef = () => ({
  gcsPath: `staging/${Math.random()}/video.mp4`,
  bucket: 'test-bucket',
  size: 12345,
});

afterEach(() => {
  vi.unstubAllGlobals();
  storageService.deleteFile = originalDeleteFile;
  storageService.createReadStream = originalCreateReadStream;
});

describe('video.service.uploadVideo — GCS staging cleanup', () => {
  it('deletes the GCS staging file after a successful upload', async () => {
    setupFetchMock({ initOk: true, uploadOk: true });
    storageService.createReadStream = vi.fn(() => 'fake-stream');
    storageService.deleteFile = vi.fn(async () => {});

    const { user, video } = await createFixtures();
    const fileRef = fakeGcsFileRef();

    const result = await videoService.uploadVideo(
      user._id.toString(),
      video._id.toString(),
      fileRef,
      'video/mp4'
    );

    expect(result.youtubeVideoId).toBe('yt_video_123');
    expect(storageService.deleteFile).toHaveBeenCalledTimes(1);
    expect(storageService.deleteFile).toHaveBeenCalledWith(fileRef.gcsPath);

    const dbVideo = await Video.findById(video._id);
    expect(dbVideo.status).toBe('processing');
    expect(dbVideo.youtubeVideoId).toBe('yt_video_123');
  });

  it('still deletes the GCS staging file when the video record is not found (early validation failure)', async () => {
    // Regression test for the GCS staging-file leak: multer streams the
    // upload to GCS *before* uploadVideo() runs, so every early-exit path
    // (video not found, channel not found, quota exceeded, bad token) must
    // still clean up the staging object, or it leaks forever.
    storageService.deleteFile = vi.fn(async () => {});
    const { user } = await createFixtures();
    const fileRef = fakeGcsFileRef();

    const bogusVideoId = '507f1f77bcf86cd799439099';
    await expect(
      videoService.uploadVideo(user._id.toString(), bogusVideoId, fileRef, 'video/mp4')
    ).rejects.toMatchObject({ statusCode: 404 });

    expect(storageService.deleteFile).toHaveBeenCalledTimes(1);
    expect(storageService.deleteFile).toHaveBeenCalledWith(fileRef.gcsPath);
  });

  it('still deletes the GCS staging file when the channel is not found', async () => {
    storageService.deleteFile = vi.fn(async () => {});
    const { user, video } = await createFixtures();
    // Detach the video from any real channel
    await Video.findByIdAndUpdate(video._id, { channelId: '507f1f77bcf86cd799439098' });
    const fileRef = fakeGcsFileRef();

    await expect(
      videoService.uploadVideo(user._id.toString(), video._id.toString(), fileRef, 'video/mp4')
    ).rejects.toMatchObject({ statusCode: 404 });

    expect(storageService.deleteFile).toHaveBeenCalledTimes(1);
  });

  it('still deletes the GCS staging file and marks the video failed when the YouTube upload itself fails', async () => {
    setupFetchMock({ initOk: false });
    storageService.createReadStream = vi.fn(() => 'fake-stream');
    storageService.deleteFile = vi.fn(async () => {});

    const { user, video } = await createFixtures();
    const fileRef = fakeGcsFileRef();

    await expect(
      videoService.uploadVideo(user._id.toString(), video._id.toString(), fileRef, 'video/mp4')
    ).rejects.toThrow(/YouTube init failed/);

    expect(storageService.deleteFile).toHaveBeenCalledTimes(1);
    expect(storageService.deleteFile).toHaveBeenCalledWith(fileRef.gcsPath);

    const dbVideo = await Video.findById(video._id);
    expect(dbVideo.status).toBe('failed');
    expect(dbVideo.retryCount).toBe(1);
  });

  it('does not attempt GCS cleanup for an in-memory (Buffer) upload — dev fallback path', async () => {
    setupFetchMock({ initOk: true, uploadOk: true });
    storageService.deleteFile = vi.fn(async () => {});

    const { user, video } = await createFixtures();
    const buffer = Buffer.from('fake video bytes');

    await videoService.uploadVideo(user._id.toString(), video._id.toString(), buffer, 'video/mp4');

    expect(storageService.deleteFile).not.toHaveBeenCalled();
  });

  it('rejects when the monthly upload quota is exhausted (free plan has 0 uploads)', async () => {
    storageService.deleteFile = vi.fn(async () => {});
    const { user, video } = await createFixtures({ plan: 'free' });
    const fileRef = fakeGcsFileRef();

    await expect(
      videoService.uploadVideo(user._id.toString(), video._id.toString(), fileRef, 'video/mp4')
    ).rejects.toMatchObject({ statusCode: 429 });

    expect(storageService.deleteFile).toHaveBeenCalledTimes(1);
  });
});
