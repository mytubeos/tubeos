import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const User = require('../../src/models/user.model');
const Session = require('../../src/models/session.model');
const RevokedSession = require('../../src/models/revoked-session.model');
const sessions = require('../../src/services/session.service');
const auth = require('../../src/services/auth.service');
const jwt = require('../../src/utils/jwt.utils');

const createUser = (email = 'creator@example.com') =>
  User.create({ name: 'Creator', email, password: 'password123', isEmailVerified: true });

describe('device sessions', () => {
  it('lists only current-generation, unexpired, non-revoked sessions belonging to the user', async () => {
    const user = await createUser();
    const other = await createUser('another@example.com');
    const current = jwt.generateTokenPair(user);
    const revoked = jwt.generateTokenPair(user);
    await sessions.remember(current.refreshToken, 'Android Chrome');
    await sessions.remember(revoked.refreshToken, 'Windows Firefox');
    await sessions.remember(jwt.generateTokenPair(other).refreshToken, 'Safari');
    const currentId = jwt.verifyRefreshToken(current.refreshToken).sid;
    const revokedId = jwt.verifyRefreshToken(revoked.refreshToken).sid;
    await RevokedSession.create({ _id: revokedId, expiresAt: new Date('9999-01-01') });
    await Session.create({
      _id: 'old',
      userId: user._id,
      version: 99,
      lastSeenAt: new Date(),
      expiresAt: new Date('2099-01-01'),
    });
    await Session.create({
      _id: 'expired',
      userId: user._id,
      version: 0,
      lastSeenAt: new Date(),
      expiresAt: new Date('2000-01-01'),
    });
    const result = await sessions.list(user._id, currentId);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: currentId,
      current: true,
      device: 'Android · Chrome-compatible browser',
    });
    expect(result[0]).not.toHaveProperty('refreshToken');
  });

  it('revokes other and legacy sessions while replacement credentials remain usable here', async () => {
    const user = await createUser();
    const current = jwt.generateTokenPair(user);
    const other = jwt.generateTokenPair(user);
    const currentId = jwt.verifyRefreshToken(current.refreshToken).sid;
    await sessions.remember(other.refreshToken, 'Windows');
    const replacement = await sessions.logoutOthers(user._id, currentId, 'Android');
    await expect(auth.refreshToken(other.refreshToken)).rejects.toThrow();
    await expect(auth.refreshToken(current.refreshToken)).rejects.toThrow();
    await expect(auth.refreshToken(replacement.refreshToken)).resolves.toHaveProperty(
      'accessToken'
    );
    const savedUser = await User.findById(user._id);
    expect(jwt.verifyAccessToken(other.accessToken).version).not.toEqual(savedUser.sessionVersion);
    expect(jwt.verifyAccessToken(replacement.accessToken).version).toEqual(
      savedUser.sessionVersion
    );
    expect(await sessions.list(user._id, currentId)).toHaveLength(1);
  });

  it('does not track unverified tokens', async () => {
    await expect(sessions.remember('not-a-token')).rejects.toThrow();
    expect(await Session.countDocuments()).toBe(0);
  });
});
