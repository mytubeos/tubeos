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
  return jwt.verify(token, config.jwt.accessSecret, {
    issuer: 'tubeos',
    audience: 'tubeos-client',
  });
};

// Verify refresh token
const verifyRefreshToken = (token) => {
  return jwt.verify(token, config.jwt.refreshSecret, {
    issuer: 'tubeos',
    audience: 'tubeos-client',
  });
};

// Generate both tokens for a user
// Accepts either (user object) or (id, email, plan) for backwards compat
const generateTokenPair = (userOrId, email, plan) => {
  let id, userEmail, userPlan, role;

  if (typeof userOrId === 'object' && userOrId !== null) {
    id = userOrId._id?.toString() || userOrId.id?.toString();
    userEmail = userOrId.email;
    userPlan = userOrId.plan;
    role = userOrId.role || 'user';
  } else {
    id = userOrId;
    userEmail = email;
    userPlan = plan;
    role = 'user';
  }

  const payload = { id, email: userEmail, plan: userPlan, role };
  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken({ id });

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
