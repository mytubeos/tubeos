import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

// See tests/integration/auth.service.test.js for why createRequire is used
// instead of `import` for local project files under test.
const require = createRequire(import.meta.url);
const scheduleService = require('../../src/services/schedule.service.js');
const Schedule = require('../../src/models/schedule.model.js');
const Video = require('../../src/models/video.model.js');
const User = require('../../src/models/user.model.js');
const YoutubeChannel = require('../../src/models/youtube-channel.model.js');

const createFixtures = async (videoOverrides = {}) => {
  const user = await User.create({
    name: 'Creator',
    email: `creator-${Date.now()}-${Math.random()}@example.com`,
    password: 'password123',
  });
  const channel = await YoutubeChannel.create({
    userId: user._id,
    channelId: `UC${Math.random().toString(36).slice(2, 24)}`,
    channelName: 'Test Channel',
    oauth: {
      accessToken: 'fake-access-token',
      refreshToken: 'fake-refresh-token',
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    },
  });
  const video = await Video.create({
    userId: user._id,
    channelId: channel._id,
    title: 'My Draft Video',
    status: 'draft',
    ...videoOverrides,
  });
  return { user, channel, video };
};

const fakeStagedFile = () => ({
  gcsPath: `staging/${Math.random()}/video.mp4`,
  bucket: 'test-bucket',
  size: 12345,
  mimeType: 'video/mp4',
});

const inOneHour = () => new Date(Date.now() + 60 * 60 * 1000);

describe('schedule.service.createSchedule', () => {
  it('creates a schedule + updates the video when a file is staged', async () => {
    const { user, video } = await createFixtures({ stagedFile: fakeStagedFile() });

    const result = await scheduleService.createSchedule(
      user._id.toString(),
      video._id.toString(),
      inOneHour().toISOString()
    );

    expect(result.schedule.status).toBe('pending');

    const dbVideo = await Video.findById(video._id);
    expect(dbVideo.status).toBe('scheduled');
    expect(dbVideo.scheduledAt).toBeTruthy();
  });

  it('rejects scheduling a draft with no staged file', async () => {
    const { user, video } = await createFixtures(); // no stagedFile

    await expect(
      scheduleService.createSchedule(
        user._id.toString(),
        video._id.toString(),
        inOneHour().toISOString()
      )
    ).rejects.toMatchObject({ statusCode: 400 });

    const dbVideo = await Video.findById(video._id);
    expect(dbVideo.status).toBe('draft'); // untouched
  });

  it('rejects a scheduled time that is not in the future', async () => {
    const { user, video } = await createFixtures({ stagedFile: fakeStagedFile() });

    await expect(
      scheduleService.createSchedule(
        user._id.toString(),
        video._id.toString(),
        new Date(Date.now() - 60 * 1000).toISOString()
      )
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('rejects scheduling a video that is not draft/failed/cancelled', async () => {
    const { user, video } = await createFixtures({
      stagedFile: fakeStagedFile(),
      status: 'published',
    });

    await expect(
      scheduleService.createSchedule(
        user._id.toString(),
        video._id.toString(),
        inOneHour().toISOString()
      )
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('replaces a stale (cancelled) schedule for the same video instead of erroring', async () => {
    const { user, video } = await createFixtures({ stagedFile: fakeStagedFile() });
    await scheduleService.createSchedule(
      user._id.toString(),
      video._id.toString(),
      inOneHour().toISOString()
    );
    // Cancelling puts the video back to 'draft' — the old Schedule document
    // (now status 'cancelled') is still in the DB until a fresh schedule
    // request comes in and replaces it.
    await scheduleService.cancelSchedule(user._id.toString(), video._id.toString());

    const newTime = new Date(Date.now() + 2 * 60 * 60 * 1000);
    await scheduleService.createSchedule(
      user._id.toString(),
      video._id.toString(),
      newTime.toISOString()
    );

    const schedules = await Schedule.find({ videoId: video._id });
    expect(schedules).toHaveLength(1);
    expect(schedules[0].status).toBe('pending');
    expect(schedules[0].scheduledAt.getTime()).toBe(newTime.getTime());
  });
});

describe('schedule.service.cancelSchedule', () => {
  it('cancels the schedule and reverts the video to draft, keeping its staged file', async () => {
    const stagedFile = fakeStagedFile();
    const { user, video } = await createFixtures({ stagedFile });
    await scheduleService.createSchedule(
      user._id.toString(),
      video._id.toString(),
      inOneHour().toISOString()
    );

    await scheduleService.cancelSchedule(user._id.toString(), video._id.toString());

    const dbVideo = await Video.findById(video._id);
    expect(dbVideo.status).toBe('draft');
    expect(dbVideo.scheduledAt).toBeFalsy();
    expect(dbVideo.stagedFile.gcsPath).toBe(stagedFile.gcsPath); // not cleared

    const dbSchedule = await Schedule.findOne({ videoId: video._id });
    expect(dbSchedule.status).toBe('cancelled');
  });
});

describe('schedule.service.reschedule', () => {
  it('updates scheduledAt on both the schedule and the video', async () => {
    const { user, video } = await createFixtures({ stagedFile: fakeStagedFile() });
    await scheduleService.createSchedule(
      user._id.toString(),
      video._id.toString(),
      inOneHour().toISOString()
    );

    const newTime = new Date(Date.now() + 3 * 60 * 60 * 1000);
    const result = await scheduleService.reschedule(
      user._id.toString(),
      video._id.toString(),
      newTime.toISOString()
    );

    expect(result.schedule.scheduledAt.getTime()).toBe(newTime.getTime());
    const dbVideo = await Video.findById(video._id);
    expect(dbVideo.scheduledAt.getTime()).toBe(newTime.getTime());
    expect(dbVideo.status).toBe('scheduled');
  });

  it('rejects rescheduling to a time that is not in the future', async () => {
    const { user, video } = await createFixtures({ stagedFile: fakeStagedFile() });
    await scheduleService.createSchedule(
      user._id.toString(),
      video._id.toString(),
      inOneHour().toISOString()
    );

    await expect(
      scheduleService.reschedule(
        user._id.toString(),
        video._id.toString(),
        new Date(Date.now() - 60 * 1000).toISOString()
      )
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe('schedule.service.getQueueDashboard', () => {
  it('returns real per-user counts derived from Schedule documents', async () => {
    const { user, video } = await createFixtures({ stagedFile: fakeStagedFile() });
    await scheduleService.createSchedule(
      user._id.toString(),
      video._id.toString(),
      inOneHour().toISOString()
    );

    const { user: otherUser, video: otherVideo } = await createFixtures({
      stagedFile: fakeStagedFile(),
    });
    await Schedule.create({
      userId: otherUser._id,
      channelId: otherVideo.channelId,
      videoId: otherVideo._id,
      scheduledAt: inOneHour(),
      status: 'published',
    });

    const dashboard = await scheduleService.getQueueDashboard(user._id.toString());
    expect(dashboard.stats.delayed).toBe(1); // this user's own pending, not-yet-due schedule
    expect(dashboard.stats.completed).toBe(0); // the published one belongs to a different user
  });
});
