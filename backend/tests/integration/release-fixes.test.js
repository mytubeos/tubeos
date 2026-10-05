import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const User = require('../../src/models/user.model');
const PaymentHistory = require('../../src/models/payment-history.model');
const Notification = require('../../src/models/notification.model');
const { ReferralEarning, PayoutRequest } = require('../../src/models/referral.model');
const { activatePlanFromPayload } = require('../../src/services/dodo.service');
const { requestPayout } = require('../../src/services/referral.service');
const { createNotification } = require('../../src/services/notification.service');
const auth = require('../../src/services/auth.service');
const { generateTokenPair, verifyAccessToken } = require('../../src/utils/jwt.utils');
const createUser = (extra = {}) =>
  User.create({
    name: 'Creator',
    email: `${Math.random()}@example.com`,
    password: 'password123',
    isEmailVerified: true,
    ...extra,
  });
const payload = (user, extra = {}) => ({
  metadata: { userId: user._id.toString(), plan: 'pro' },
  currency: 'USD',
  total_amount: 999,
  ...extra,
});

describe('Dodo transaction and USD referral accounting', () => {
  it('attributes historical mixed-case referral codes and generates uppercase codes', async () => {
    const referrer = await createUser({ referral: { myCode: 'CREabc123' } });
    const result = await auth.register({
      name: 'New Creator',
      email: 'new-creator@example.com',
      password: 'password123',
      referralCode: ' creABC123 ',
    });
    const user = await User.findById(result.userId);
    expect(user.referral.referredBy.toString()).toBe(referrer._id.toString());
    expect(user.referral.myCode).toBe(user.referral.myCode.toUpperCase());
    expect((await User.findById(referrer._id)).referral.totalReferrals).toBe(1);
  });
  it('credits cents once under concurrent delivery and leaves historical INR untouched', async () => {
    const referrer = await createUser({ wallet: { balance: 123 } });
    const user = await createUser({ referral: { referredBy: referrer._id } });
    await Promise.all([
      activatePlanFromPayload(payload(user), 'same-payment'),
      activatePlanFromPayload(payload(user), 'same-payment'),
    ]);
    const first = await User.findById(user._id);
    await activatePlanFromPayload(payload(user), 'same-payment');
    const again = await User.findById(user._id);
    expect(again.subscriptionExpiresAt.getTime()).toBe(first.subscriptionExpiresAt.getTime());
    const wallet = await User.findById(referrer._id);
    expect(wallet.usdWallet.balanceCents).toBe(100);
    expect(wallet.wallet.balance).toBe(123);
    expect(await ReferralEarning.countDocuments({ dodoPaymentId: 'same-payment' })).toBe(1);
    expect(await PaymentHistory.countDocuments({ dodoPaymentId: 'same-payment' })).toBe(1);
    expect(await Notification.countDocuments({ userId: user._id, type: 'plan_activated' })).toBe(1);
  });
  it('rejects wrong currency before changing the plan', async () => {
    const user = await createUser();
    await expect(
      activatePlanFromPayload(payload(user, { currency: 'INR' }), 'bad-currency')
    ).rejects.toThrow('Invalid USD');
    expect((await User.findById(user._id)).plan).toBe('free');
  });
  it('rolls back plan and receipt on invalid tax', async () => {
    const user = await createUser();
    await expect(
      activatePlanFromPayload(payload(user, { tax: 2000 }), 'bad-tax')
    ).rejects.toThrow();
    expect((await User.findById(user._id)).plan).toBe('free');
    expect(await PaymentHistory.countDocuments({ dodoPaymentId: 'bad-tax' })).toBe(0);
  });
  it('prevents concurrent withdrawals from overspending and keeps cents', async () => {
    const user = await createUser({ usdWallet: { balanceCents: 1000 } });
    const results = await Promise.allSettled([
      requestPayout(user._id, { amount: 7.25, method: 'upi', upi: 'user@upi' }),
      requestPayout(user._id, { amount: 7.25, method: 'upi', upi: 'user@upi' }),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const updated = await User.findById(user._id);
    expect(updated.usdWallet.balanceCents).toBe(275);
    expect(updated.usdWallet.pendingPayoutCents).toBe(725);
    expect(await PayoutRequest.countDocuments({ userId: user._id, currency: 'USD' })).toBe(1);
  });
});

describe('sessions and account notifications', () => {
  it('logout-all revokes old refresh tokens immediately, even in the same second', async () => {
    const user = await createUser();
    const old = generateTokenPair(user);
    await auth.logoutAll(user._id);
    await expect(auth.refreshToken(old.refreshToken)).rejects.toThrow();
    const fresh = generateTokenPair(await User.findById(user._id));
    await expect(auth.refreshToken(fresh.refreshToken)).resolves.toHaveProperty('accessToken');
  });
  it('single-session logout leaves another device signed in', async () => {
    const user = await createUser();
    const a = generateTokenPair(user);
    const b = generateTokenPair(user);
    await auth.logout(user._id, a.refreshToken, verifyAccessToken(a.accessToken).sid);
    await expect(auth.refreshToken(a.refreshToken)).rejects.toThrow();
    await expect(auth.refreshToken(b.refreshToken)).resolves.toHaveProperty('accessToken');
  });
  it('delivers account alerts even with nudges muted and daily cap exhausted', async () => {
    const user = await createUser({ preferences: { chingariEnabled: false, maxNudgesPerDay: 0 } });
    expect(await createNotification(user._id, 'plan_activated', 'Paid')).toBeTruthy();
    expect(await createNotification(user._id, 'subscription_expired', 'Expired')).toBeTruthy();
    expect(await createNotification(user._id, 'upload_reminder', 'Upload')).toBeNull();
  });
});
