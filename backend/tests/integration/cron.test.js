import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

// See tests/integration/auth.service.test.js for why createRequire is used
// instead of `import` for local project files under test.
const require = createRequire(import.meta.url);
const { reapPublishedSchedules } = require('../../src/jobs/cron.js');
const Schedule = require('../../src/models/schedule.model.js');
const Video = require('../../src/models/video.model.js');
const User = require('../../src/models/user.model.js');
const YoutubeChannel = require('../../src/models/youtube-channel.model.js');

const createBaseFixtures = async () => {
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
      accessToken: 'x',
      refreshToken: 'x',
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    },
  });
  return { user, channel };
};

describe('cron.reapPublishedSchedules', () => {
  it('flips an overdue pending schedule and its video to published', async () => {
    const { user, channel } = await createBaseFixtures();
    const video = await Video.create({
      userId: user._id,
      channelId: channel._id,
      title: 'Overdue Video',
      status: 'scheduled',
      youtubeVideoId: 'yt123',
    });
    const scheduledAt = new Date(Date.now() - 60 * 1000); // 1 minute ago
    const schedule = await Schedule.create({
      userId: user._id,
      channelId: channel._id,
      videoId: video._id,
      scheduledAt,
    });

    await reapPublishedSchedules();

    const dbSchedule = await Schedule.findById(schedule._id);
    expect(dbSchedule.status).toBe('published');
    expect(dbSchedule.executedAt).toBeTruthy();

    const dbVideo = await Video.findById(video._id);
    expect(dbVideo.status).toBe('published');
    expect(dbVideo.publishedAt).toBeTruthy();
  });

  it('leaves a schedule alone if scheduledAt is still in the future', async () => {
    const { user, channel } = await createBaseFixtures();
    const video = await Video.create({
      userId: user._id,
      channelId: channel._id,
      title: 'Future Video',
      status: 'scheduled',
    });
    const scheduledAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now
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
  });

  it('marks the schedule failed when its linked video record no longer exists', async () => {
    const { user, channel } = await createBaseFixtures();
    const video = await Video.create({
      userId: user._id,
      channelId: channel._id,
      title: 'Will be deleted',
      status: 'scheduled',
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

  it('processes multiple due schedules in a single run and leaves not-yet-due ones untouched', async () => {
    const { user, channel } = await createBaseFixtures();

    const dueVideos = await Promise.all(
      [1, 2].map((i) =>
        Video.create({
          userId: user._id,
          channelId: channel._id,
          title: `Due Video ${i}`,
          status: 'scheduled',
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
