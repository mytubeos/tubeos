import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

// See tests/integration/auth.service.test.js for why createRequire is used
// instead of `import` for local project files under test.
const require = createRequire(import.meta.url);
const { createNotification, touchActivity } = require('../../src/services/notification.service.js');
const Notification = require('../../src/models/notification.model.js');
const User = require('../../src/models/user.model.js');

const createUser = async (overrides = {}) =>
  User.create({
    name: 'Creator',
    email: `creator-${Date.now()}-${Math.random()}@example.com`,
    password: 'password123',
    ...overrides,
  });

describe('notification.service.createNotification', () => {
  it('creates a notification for a default user', async () => {
    const user = await createUser();
    const notification = await createNotification(
      user._id,
      'upload_reminder',
      'test message',
      'nudge'
    );
    expect(notification).toBeTruthy();
    const dbNotification = await Notification.findById(notification._id);
    expect(dbNotification.type).toBe('upload_reminder');
    expect(dbNotification.mood).toBe('nudge');
    expect(dbNotification.read).toBe(false);
  });

  it('does not create a notification when chingariEnabled is false', async () => {
    const user = await createUser({ preferences: { chingariEnabled: false } });
    const result = await createNotification(user._id, 'upload_reminder', 'test message');
    expect(result).toBeNull();
    const count = await Notification.countDocuments({ userId: user._id });
    expect(count).toBe(0);
  });

  it('stops creating notifications once the daily cap is reached', async () => {
    const user = await createUser({ preferences: { maxNudgesPerDay: 2 } });
    const first = await createNotification(user._id, 'upload_reminder', 'one');
    const second = await createNotification(user._id, 'comment_backlog', 'two');
    const third = await createNotification(user._id, 'upload_reminder', 'three');

    expect(first).toBeTruthy();
    expect(second).toBeTruthy();
    expect(third).toBeNull();

    const count = await Notification.countDocuments({ userId: user._id });
    expect(count).toBe(2);
  });
});

describe('notification.service.touchActivity', () => {
  it('sets the streak to 1 on the very first call', async () => {
    const user = await createUser();
    const streak = await touchActivity(user._id);
    expect(streak).toBe(1);

    const dbUser = await User.findById(user._id);
    expect(dbUser.gamification.currentStreak).toBe(1);
    expect(dbUser.gamification.longestStreak).toBe(1);
    expect(dbUser.gamification.lastActiveDate).toBeTruthy();
  });

  it('does not change the streak on a second call the same day', async () => {
    const user = await createUser();
    await touchActivity(user._id);
    const streak = await touchActivity(user._id);
    expect(streak).toBe(1);

    const dbUser = await User.findById(user._id);
    expect(dbUser.gamification.currentStreak).toBe(1);
  });

  it('increments the streak when the last activity was exactly yesterday', async () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const user = await createUser({
      gamification: { currentStreak: 4, longestStreak: 4, lastActiveDate: yesterday },
    });

    const streak = await touchActivity(user._id);
    expect(streak).toBe(5);

    const dbUser = await User.findById(user._id);
    expect(dbUser.gamification.currentStreak).toBe(5);
    expect(dbUser.gamification.longestStreak).toBe(5);
  });

  it('resets the streak to 1 when there is a gap of more than one day', async () => {
    const fourDaysAgo = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000);
    const user = await createUser({
      gamification: { currentStreak: 10, longestStreak: 10, lastActiveDate: fourDaysAgo },
    });

    const streak = await touchActivity(user._id);
    expect(streak).toBe(1);

    const dbUser = await User.findById(user._id);
    expect(dbUser.gamification.currentStreak).toBe(1);
    // Longest streak is a high-water mark — a reset must never lower it.
    expect(dbUser.gamification.longestStreak).toBe(10);
  });

  it('creates a celebratory streak_milestone notification when crossing 3 days', async () => {
    const twoDaysAgoStreak = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const user = await createUser({
      gamification: { currentStreak: 2, longestStreak: 2, lastActiveDate: twoDaysAgoStreak },
    });

    await touchActivity(user._id);

    const notifications = await Notification.find({ userId: user._id });
    expect(notifications).toHaveLength(1);
    expect(notifications[0].type).toBe('streak_milestone');
    expect(notifications[0].mood).toBe('celebrate');
  });

  it('does not create a milestone notification on a non-milestone streak day', async () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const user = await createUser({
      gamification: { currentStreak: 3, longestStreak: 3, lastActiveDate: yesterday },
    });

    await touchActivity(user._id); // becomes streak 4 — not a milestone

    const notifications = await Notification.find({ userId: user._id });
    expect(notifications).toHaveLength(0);
  });
});
