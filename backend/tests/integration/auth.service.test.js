import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

// auth.service.js (plain CommonJS) is loaded through Node's native require()
// mechanism -- see tests/integration/analytics.service.test.js for why
// createRequire is used instead of `import` for local project files under
// test. This file no longer touches Redis at all: OTP codes and password-
// reset tokens are stored in Mongo (temp-token.model.js) specifically so
// signup/login/reset don't depend on Redis's own uptime or usage quota.
const require = createRequire(import.meta.url);
const authService = require('../../src/services/auth.service.js');
const User = require('../../src/models/user.model.js');
const TempToken = require('../../src/models/temp-token.model.js');
const crypto = require('crypto');

const VALID_USER = {
  name: 'Test Creator',
  email: 'creator@example.com',
  password: 'password123',
};

// register()/resendOTP() never return the raw OTP (only emailed) — read it
// back from Mongo the same way verifyEmail() does.
const getOtpFor = async (userId) => {
  const doc = await TempToken.findOne({ key: `email_otp:${userId}` });
  return doc?.value ?? null;
};

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
    // client call without JSON-encoding it, while verifyEmail() always read
    // through getCache() (which JSON.parses) — a bare 6-digit OTP string
    // like "482913" round-tripped through JSON.parse as the *number*
    // 482913, which never strictly-equals the string OTP from the request
    // body, so the very first OTP after signup always failed verification.
    // Moot now that both sides go through the same plain Mongo string field
    // (no JSON encode/decode layer at all), but kept as a guard against
    // that whole class of mismatch recurring.
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

  it('rejects an OTP whose expiresAt has passed even if Mongo has not swept it yet', async () => {
    // Regression guard for getTempToken()'s manual expiry check: Mongo's TTL
    // monitor only sweeps expired docs on its own schedule (~60s), not
    // instantly, so a stale-but-not-yet-deleted doc must still be treated
    // as gone on read.
    const { userId } = await authService.register(VALID_USER);
    await TempToken.updateOne(
      { key: `email_otp:${userId}` },
      { expiresAt: new Date(Date.now() - 1000) }
    );

    await expect(authService.verifyEmail('123456', userId)).rejects.toMatchObject({
      statusCode: 400,
    });
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

  it('actually stores a lookup-able token for a real email', async () => {
    const user = await registerAndVerify();
    await authService.forgotPassword(user.email);

    const stored = await TempToken.findOne({ key: { $regex: /^pwd_reset:/ } });
    expect(stored).toBeTruthy();
    expect(stored.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('lets a user reset their password with a valid token, and the old password stops working', async () => {
    const user = await registerAndVerify();
    const dbUser = await User.findOne({ email: user.email });

    // forgotPassword() only ever emails the raw token (never returns it, by
    // design, so it's never sitting in a response body/log anyone but the
    // user can read) — mirror what it does internally to get a valid
    // raw/hashed token pair for this test.
    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
    await TempToken.create({
      key: `pwd_reset:${hashedToken}`,
      value: dbUser._id.toString(),
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    });

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

  it('rejects a reset token that has already been used once', async () => {
    const user = await registerAndVerify({ email: 'onetime@example.com' });
    const dbUser = await User.findOne({ email: user.email });

    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
    await TempToken.create({
      key: `pwd_reset:${hashedToken}`,
      value: dbUser._id.toString(),
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    });

    await authService.resetPassword(rawToken, 'firstNewPassword123');
    await expect(authService.resetPassword(rawToken, 'secondNewPassword123')).rejects.toMatchObject(
      { statusCode: 400 }
    );
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
