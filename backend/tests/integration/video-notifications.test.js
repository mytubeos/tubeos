import { it, expect } from 'vitest';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const User = require('../../src/models/user.model');
const Notification = require('../../src/models/notification.model');
const { notifyVideo } = require('../../src/services/notification.service');

it('honours operational preferences independently of mascot nudges', async () => {
  const user = await User.create({
    name: 'Creator',
    email: 'creator@example.com',
    password: 'password123',
    preferences: { chingariEnabled: false, uploadAlerts: false, publishAlerts: true },
  });
  await notifyVideo(user._id, 'upload_failed', 'A video');
  expect(await Notification.countDocuments()).toBe(0);
  await notifyVideo(user._id, 'video_published', 'A video');
  expect(await Notification.countDocuments({ userId: user._id, type: 'video_published' })).toBe(1);
});
