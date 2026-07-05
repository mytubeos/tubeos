import { describe, it, expect } from 'vitest';
import jwt from 'jsonwebtoken';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  generateTokenPair,
} from '../../src/utils/jwt.utils.js';

describe('jwt.utils', () => {
  const payload = { id: '507f1f77bcf86cd799439011', email: 'a@b.com', plan: 'pro' };

  it('generates an access token that verifies back to the same payload', () => {
    const token = generateAccessToken(payload);
    const decoded = verifyAccessToken(token);
    expect(decoded.id).toBe(payload.id);
    expect(decoded.email).toBe(payload.email);
    expect(decoded.plan).toBe(payload.plan);
  });

  it('generates a refresh token that verifies back to the same payload', () => {
    const token = generateRefreshToken({ id: payload.id });
    const decoded = verifyRefreshToken(token);
    expect(decoded.id).toBe(payload.id);
  });

  it('rejects an access token verified with the refresh secret', () => {
    const token = generateAccessToken(payload);
    expect(() => verifyRefreshToken(token)).toThrow();
  });

  it('rejects a refresh token verified with the access secret', () => {
    const token = generateRefreshToken({ id: payload.id });
    expect(() => verifyAccessToken(token)).toThrow();
  });

  it('rejects a tampered token', () => {
    const token = generateAccessToken(payload);
    const tampered = token.slice(0, -2) + (token.endsWith('a') ? 'bb' : 'aa');
    expect(() => verifyAccessToken(tampered)).toThrow();
  });

  it('rejects an expired token', () => {
    // Sign directly with jsonwebtoken using the same secret, with a negative expiry
    const expired = jwt.sign(payload, process.env.JWT_ACCESS_SECRET, {
      expiresIn: -10,
      issuer: 'tubeos',
      audience: 'tubeos-client',
    });
    expect(() => verifyAccessToken(expired)).toThrow(/expired/i);
  });

  it('generateTokenPair accepts a user object and produces a valid pair', () => {
    const user = { _id: payload.id, email: payload.email, plan: payload.plan };
    const { accessToken, refreshToken } = generateTokenPair(user);
    expect(verifyAccessToken(accessToken).id).toBe(payload.id);
    expect(verifyRefreshToken(refreshToken).id).toBe(payload.id);
  });

  it('generateTokenPair also accepts the legacy (id, email, plan) call signature', () => {
    const { accessToken } = generateTokenPair(payload.id, payload.email, payload.plan);
    const decoded = verifyAccessToken(accessToken);
    expect(decoded.email).toBe(payload.email);
    expect(decoded.plan).toBe(payload.plan);
  });
});
