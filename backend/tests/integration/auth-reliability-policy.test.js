import { describe, it, expect, afterEach, vi } from 'vitest';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const User = require('../../src/models/user.model');
const Session = require('../../src/models/session.model');
const { generateTokenPair } = require('../../src/utils/jwt.utils');
const sessionService = require('../../src/services/session.service');
const authService = require('../../src/services/auth.service');
afterEach(() => vi.restoreAllMocks());
describe('auth policy reliability', () => {
  it('accepts plus-addresses and long domains and normalizes login email case/spaces', async () => {
    const user = await User.create({
      name: 'Creator',
      email: 'creator+review@example.technology',
      password: 'password123',
      isEmailVerified: true,
    });
    const result = await authService.login({
      email: ' CREATOR+REVIEW@EXAMPLE.TECHNOLOGY ',
      password: 'password123',
    });
    expect(result.user._id.toString()).toBe(user._id.toString());
  });
  it('does not turn a secondary session-history write failure into login failure', async () => {
    const user = await User.create({
      name: 'Creator',
      email: 'test@example.com',
      password: 'password123',
    });
    const tokens = generateTokenPair(user);
    vi.spyOn(Session, 'updateOne').mockRejectedValueOnce(new Error('device history unavailable'));
    await expect(sessionService.remember(tokens.refreshToken, 'Android')).resolves.toBeUndefined();
  });
  it('rejects missing email sender configuration instead of silently claiming delivery', async () => {
    const modulePath = require.resolve('../../src/utils/email.utils');
    const cached = require.cache[modulePath];
    delete require.cache[modulePath];
    try {
      const sender = require(modulePath);
      await expect(
        sender.sendOTPEmail('test@example.com', 'Creator', '123456')
      ).rejects.toMatchObject({ statusCode: 503 });
      await expect(
        sender.sendPasswordResetEmail('test@example.com', 'Creator', 'test-token')
      ).rejects.toMatchObject({ statusCode: 503 });
    } finally {
      require.cache[modulePath] = cached;
    }
  });
});
