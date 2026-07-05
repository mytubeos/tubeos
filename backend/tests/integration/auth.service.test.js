import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
import { createFakeRedisClient } from '../mocks/redis.mock.js';

// auth.service.js (plain CommonJS) is loaded through Node's native require()
// mechanism, which is a *separate* module registry from this file's own ESM
// import graph — an `import`-ed copy of a local file is a different instance
// with its own closure state than a `require()`-d copy (confirmed via a
// minimal repro: `import` and `require()` of the same file are `!==`).
// vi.mock() also only reaches the ESM-import world, so it can't intercept
// auth.service.js's internal `require('../config/redis')` either. Instead,
// grab the exact instance auth.service.js's require() resolves to (via
// createRequire) and inject a fake client directly into it.
const require = createRequire(import.meta.url);
const redisConfig = require('../../src/config/redis.js');
redisConfig._setClientForTesting(createFakeRedisClient());

const authService = require('../../src/services/auth.service.js');
const User = require('../../src/models/user.model.js');

const VALID_USER = {
  name: 'Test Creator',
  email: 'creator@example.com',
  password: 'password123',
};

// register()/resendOTP() never return the raw OTP (only emailed) — read it
// back from Redis the same way verifyEmail() does.
const getOtpFor = async (userId) => redisConfig.getCache(`email_otp:${userId}`);

const registerAndVerify = async (overrides = {}) => {
  const user = { ...VALID_USER, ...overrides };
  const { userId } = await authService.register(user);
  const otp = await getOtpFor(userId);
  await authService.verifyEmail(otp, userId);
  return user;
};

describe('auth.service.register + verifyEmail (OTP flow)', () => {
  it('verifies successfully with the OTP from the very first registration email', async () => {
    // Regression test: register() used to store the OTP via a raw Redis
    // client call without JSON-encoding it, while verifyEmail() always reads
    // through getCache() (which JSON.parses). A bare 6-digit OTP string like
    // "482913" round-trips through JSON.parse as the *number* 482913, which
    // never strictly-equals the string OTP from the request body — so the
    // very first OTP after signup always failed verification. Only a
    // subsequent "Resend OTP" (which does go through setCache) ever worked.
    const { userId } = await authService.register(VALID_USER);
    const otp = await getOtpFor(userId);
    expect(typeof otp).toBe('string');

    const result = await authService.verifyEmail(otp, userId);
    expect(result.user.isEmailVerified).toBe(true);
    expect(result.tokens.accessToken).toBeTruthy();
    expect(result.tokens.refreshToken).toBeTruthy();
  });

  it('rejects a duplicate email with 409', async () => {
    await authService.register(VALID_USER);
    await expect(authService.register(VALID_USER)).rejects.toMatchObject({ statusCode: 409 });
  });

  it('rejects a password shorter than 8 characters with 400', async () => {
    await expect(authService.register({ ...VALID_USER, password: 'short' })).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it('rejects an incorrect OTP with 400', async () => {
    const { userId } = await authService.register(VALID_USER);
    await expect(authService.verifyEmail('000000', userId)).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it('rejects verification once the OTP has already been consumed', async () => {
    const { userId } = await authService.register(VALID_USER);
    const otp = await getOtpFor(userId);

    await authService.verifyEmail(otp, userId);
    await expect(authService.verifyEmail(otp, userId)).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe('auth.service.login', () => {
  it('blocks login before email verification with 403', async () => {
    await authService.register(VALID_USER);
    await expect(
      authService.login({ email: VALID_USER.email, password: VALID_USER.password })
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('logs in successfully with correct credentials after verification', async () => {
    const user = await registerAndVerify();
    const result = await authService.login({ email: user.email, password: user.password });
    expect(result.accessToken).toBeTruthy();
    expect(result.refreshToken).toBeTruthy();
    expect(result.user.email).toBe(user.email);
  });

  it('rejects an incorrect password with 401', async () => {
    const user = await registerAndVerify();
    await expect(
      authService.login({ email: user.email, password: 'wrongpassword' })
    ).rejects.toMatchObject({ statusCode: 401 });
  });

  it('rejects a nonexistent email with 401 (not 404 — avoids account enumeration)', async () => {
    await expect(
      authService.login({ email: 'nobody@example.com', password: 'password123' })
    ).rejects.toMatchObject({ statusCode: 401 });
  });

  it('blocks a banned user with 403', async () => {
    const user = await registerAndVerify({ email: 'banned@example.com' });
    await User.findOneAndUpdate({ email: user.email }, { isBanned: true });
    await expect(
      authService.login({ email: user.email, password: user.password })
    ).rejects.toMatchObject({ statusCode: 403 });
  });
});

describe('auth.service.forgotPassword + resetPassword', () => {
  it('does not reveal whether an email exists', async () => {
    const result = await authService.forgotPassword('nobody@example.com');
    expect(result.message).toMatch(/if an account exists/i);
  });

  it('lets a user reset their password with a valid token, and the old password stops working', async () => {
    const user = await registerAndVerify();

    // forgotPassword() only ever returns a generic message (by design, to
    // avoid leaking account existence) — the real raw token only ever goes
    // out via email, so generate one the same way the model itself does and
    // save it, mirroring what forgotPassword() does internally.
    const dbUser = await User.findOne({ email: user.email });
    const rawToken = dbUser.generatePasswordResetToken();
    await dbUser.save();

    await authService.resetPassword(rawToken, 'brandNewPassword123');

    await expect(
      authService.login({ email: user.email, password: user.password })
    ).rejects.toMatchObject({ statusCode: 401 });

    const result = await authService.login({
      email: user.email,
      password: 'brandNewPassword123',
    });
    expect(result.accessToken).toBeTruthy();
  });

  it('rejects an invalid/unknown reset token with 400', async () => {
    await expect(
      authService.resetPassword('not-a-real-token', 'anotherPassword123')
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('rejects a new password shorter than 8 characters with 400', async () => {
    await expect(authService.resetPassword('sometoken', 'short')).rejects.toMatchObject({
      statusCode: 400,
    });
  });
});
