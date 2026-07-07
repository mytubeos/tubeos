// src/config/env.js
// Validates all required environment variables at startup
// App will crash with clear message if any are missing

const logger = require('./logger');

const requiredEnvVars = [
  'MONGODB_URI',
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
  'REDIS_URL',
  'CLIENT_URL',
  'YOUTUBE_CLIENT_ID',
  'YOUTUBE_CLIENT_SECRET',
  'YOUTUBE_REDIRECT_URI',
];

const validateEnv = () => {
  const missing = requiredEnvVars.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    logger.error('Missing required environment variables', { missing });
    logger.error('Copy .env.example to .env and fill in the values');
    process.exit(1);
  }
  logger.info('Environment variables validated');
};

const config = {
  port: process.env.PORT || 8080,
  nodeEnv: process.env.NODE_ENV || 'development',
  isDev: process.env.NODE_ENV !== 'production',

  mongodb: {
    uri: process.env.MONGODB_URI,
  },

  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES || '7d',
  },

  redis: {
    url: process.env.REDIS_URL,
  },

  cors: {
    clientUrl: process.env.CLIENT_URL || 'http://localhost:3000',
    // Comma-separated extra allowed origins (e.g. alternate local dev ports,
    // a staging frontend). Unset in dev falls back to the two Vite/CRA dev
    // ports so local dev keeps working out of the box; unset in production
    // means no extra origins (only CLIENT_URL / FRONTEND_URL / VERCEL_URL).
    extraOrigins: (
      process.env.CORS_EXTRA_ORIGINS ??
      (process.env.NODE_ENV !== 'production' ? 'http://localhost:3000,http://localhost:5173' : '')
    )
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
  },

  email: {
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
    from: process.env.EMAIL_FROM,
  },

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  },

  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID,
    keySecret: process.env.RAZORPAY_KEY_SECRET,
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET,
  },

  youtube: {
    clientId: process.env.YOUTUBE_CLIENT_ID,
    clientSecret: process.env.YOUTUBE_CLIENT_SECRET,
    redirectUri: process.env.YOUTUBE_REDIRECT_URI,
  },

  // YouTube PubSubHubbub webhooks
  // BACKEND_URL: public URL of this server (e.g. https://tubeos-api.onrender.com)
  // Required for YouTube to call our webhook endpoint. If unset, subscriptions are skipped.
  webhook: {
    backendUrl: process.env.BACKEND_URL || '',
    verifyToken: process.env.WEBHOOK_VERIFY_TOKEN || '',
  },

  // Google Cloud Storage — used to stage video uploads instead of RAM.
  // Optional: if bucket is unset, uploads fall back to in-memory (dev only).
  gcs: {
    bucket: process.env.GCS_BUCKET,
    projectId: process.env.GCS_PROJECT_ID,
  },
};

module.exports = { config, validateEnv };
