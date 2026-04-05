// src/utils/jwt.utils.js
// JWT token generation and verification utilities

const jwt = require('jsonwebtoken');
const { config } = require('../config/env');

// Generate access token (short-lived: 15 minutes)
const generateAccessToken = (payload) => {
  return jwt.sign(payload, config.jwt.accessSecret, {
    expiresIn: config.jwt.accessExpiresIn,
    issuer: 'tubeos',
    audience: 'tubeos-client',
  });
};

// Generate refresh token (long-lived: 7 days)
const generateRefreshToken = (payload) => {
  return jwt.sign(payload, config.jwt.refreshSecret, {
    expiresIn: config.jwt.refreshExpiresIn,
    issuer: 'tubeos',
    audience: 'tubeos-client',
  });
};

// Verify access token
const verifyAccessToken = (token) => {
  try {
    return jwt.verify(token, config.jwt.accessSecret, {
      issuer: 'tubeos',
      audience: 'tubeos-client',
    });
  } catch (error) {
    throw error;
  }
};

// Verify refresh token
const verifyRefreshToken = (token) => {
  try {
    return jwt.verify(token, config.jwt.refreshSecret, {
      issuer: 'tubeos',
      audience: 'tubeos-client',
    });
  } catch (error) {
    throw error;
  }
};

// Generate both tokens for a user
const generateTokenPair = (user) => {
  const payload = {
    id: user._id,
    email: user.email,
    plan: user.plan,
    role: user.role || 'user',
  };

  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken({ id: user._id });

  return { accessToken, refreshToken };
};

// Cookie options for refresh token
const getRefreshTokenCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: '/api/v1/auth',
});

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  generateTokenPair,
  getRefreshTokenCookieOptions,
};
