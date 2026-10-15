import { describe, it, expect, vi, afterEach } from 'vitest';
import { createRequire } from 'module';
import request from 'supertest';
const require = createRequire(import.meta.url);
const app = require('../../src/app');
const User = require('../../src/models/user.model');
const Channel = require('../../src/models/youtube-channel.model');
const Video = require('../../src/models/video.model');
const Schedule = require('../../src/models/schedule.model');
const Session = require('../../src/models/session.model');
const Report = require('../../src/models/content-report.model');
const Payment = require('../../src/models/payment-history.model');
const { ChannelAnalytics } = require('../../src/models/analytics.model');
const { generateTokenPair } = require('../../src/utils/jwt.utils');
const deletion = require('../../src/services/account-deletion.service');
const storage = require('../../src/services/storage.service');
const originalDelete = storage.deleteFile;
afterEach(() => {
  storage.deleteFile = originalDelete;
  vi.unstubAllGlobals();
});
const createUser = async (email = 'creator@example.com', isAdmin = false) => {
  const user = await User.create({
    name: 'Creator',
    email,
    password: 'password123',
    isEmailVerified: true,
    isAdmin,
  });
  return { user, auth: `Bearer ${generateTokenPair(user).accessToken}` };
};

describe('policy safeguards', () => {
  it('requires the current password, then disables access, cancels jobs and clears channel credentials', async () => {
    const { user, auth } = await createUser();
    const other = await createUser('other@example.com');
    const channel = await Channel.create({
      userId: user._id,
      channelId: 'channel1',
      channelName: 'Channel',
      oauth: { accessToken: 'test-access', refreshToken: 'test-refresh', expiresAt: new Date() },
    });
    await Schedule.collection.insertOne({
      userId: user._id,
      channelId: channel._id,
      status: 'pending',
    });
    await Session.collection.insertOne({ _id: 'session1', userId: user._id });
    expect(
      (
        await request(app)
          .post('/api/v1/auth/delete-account')
          .set('Authorization', auth)
          .send({ password: 'wrong' })
      ).status
    ).toBe(400);
    expect((await User.findById(user._id)).isActive).toBe(true);
    expect(
      (
        await request(app)
          .post('/api/v1/auth/delete-account')
          .set('Authorization', auth)
          .send({ password: 'password123' })
      ).status
    ).toBe(200);
    expect((await User.findById(user._id)).isActive).toBe(false);
    expect((await Channel.collection.findOne({ _id: channel._id })).oauth).toBeUndefined();
    expect((await Schedule.findOne({ userId: user._id })).status).toBe('cancelled');
    expect(await Session.countDocuments({ userId: user._id })).toBe(0);
    expect((await request(app).get('/api/v1/auth/me').set('Authorization', auth)).status).toBe(401);
    expect((await User.findById(other.user._id)).isActive).toBe(true);
  });

  it('purges expired associated data only for the deleted account while retaining minimal payment history', async () => {
    const { user } = await createUser();
    const other = await createUser('other@example.com');
    await User.updateOne(
      { _id: user._id },
      { deletedAt: new Date(Date.now() - 31 * 86400000), isActive: false }
    );
    await Video.collection.insertOne({ userId: user._id, title: 'Deleted video' });
    await Video.collection.insertOne({ userId: other.user._id, title: 'Other video' });
    await ChannelAnalytics.collection.insertOne({ userId: user._id });
    await Payment.collection.insertOne({ user: user._id, amount: 100 });
    await deletion.purgeAccountData(user._id);
    expect(await User.findById(user._id)).toBeNull();
    expect(await Video.countDocuments({ userId: user._id })).toBe(0);
    expect(await ChannelAnalytics.countDocuments({ userId: user._id })).toBe(0);
    expect(await Video.countDocuments({ userId: other.user._id })).toBe(1);
    expect(await Payment.countDocuments({ user: user._id })).toBe(1);
  });

  it('never purges an active/recent account and preserves provider references for retry on failure', async () => {
    const { user } = await createUser();
    await deletion.purgeAccountData(user._id);
    expect(await User.findById(user._id)).not.toBeNull();
    await User.updateOne(
      { _id: user._id },
      { deletedAt: new Date(Date.now() - 31 * 86400000), isActive: false }
    );
    await Video.collection.insertOne({
      userId: user._id,
      stagedFile: { gcsPath: 'private/test.mp4' },
    });
    storage.deleteFile = async () => {
      throw new Error('provider unavailable');
    };
    await expect(deletion.purgeAccountData(user._id)).rejects.toThrow('provider unavailable');
    expect((await Video.findOne({ userId: user._id })).stagedFile.gcsPath).toBe('private/test.mp4');
    expect(await User.findById(user._id)).not.toBeNull();
  });

  it('stores reports in app, validates size, and restricts report review to administrators', async () => {
    const { auth } = await createUser();
    const admin = await createUser('admin@example.com', true);
    const submitted = await request(app)
      .post('/api/v1/content-reports')
      .set('Authorization', auth)
      .send({ source: '/ai', reason: 'unsafe', excerpt: 'Unsafe sample output' });
    expect(submitted.status).toBe(201);
    expect(await Report.countDocuments()).toBe(1);
    expect(
      (await request(app).get('/api/v1/admin/content-reports').set('Authorization', auth)).status
    ).toBe(403);
    const list = await request(app)
      .get('/api/v1/admin/content-reports')
      .set('Authorization', admin.auth);
    expect(list.status).toBe(200);
    expect(list.body.data).toHaveLength(1);
    expect(
      (
        await request(app)
          .patch(`/api/v1/admin/content-reports/${submitted.body.data.id}`)
          .set('Authorization', admin.auth)
          .send({ status: 'reviewed' })
      ).status
    ).toBe(200);
    expect(
      (
        await request(app)
          .post('/api/v1/content-reports')
          .set('Authorization', auth)
          .send({ source: '/ai', reason: 'unsafe', excerpt: 'x'.repeat(10001) })
      ).status
    ).toBe(400);
  });

  it('blocks external checkout for normal clients and arbitrary deployment origins', async () => {
    const { auth } = await createUser();
    const res = await request(app)
      .post('/api/v1/payment/dodo/create-checkout-session')
      .set('Authorization', auth)
      .send({ plan: 'pro' });
    expect(res.status).toBe(403);
    expect(res.body.message).toContain('temporarily unavailable');
    const cors = await request(app)
      .get('/api/v1/health')
      .set('Origin', 'https://untrusted-preview.vercel.app');
    expect(cors.headers['access-control-allow-origin']).toBeUndefined();
  });
});
