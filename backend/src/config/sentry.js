// src/config/sentry.js
// Production error tracking. Optional — if SENTRY_DSN is unset, everything
// here becomes a no-op so local dev works without a Sentry account.

const logger = require('./logger');

let Sentry = null;
try {
  Sentry = require('@sentry/node');
} catch (err) {
  logger.warn('[sentry] @sentry/node not installed — error tracking disabled');
}

const isConfigured = () => !!(Sentry && process.env.SENTRY_DSN);

const init = () => {
  if (!isConfigured()) {
    logger.warn('[sentry] SENTRY_DSN not set — error tracking disabled');
    return;
  }
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: 0.1, // light perf sampling, keep free-tier quota in check
  });
  logger.info('Sentry error tracking initialized');
};

// Report an error. Safe to call even when Sentry isn't configured.
const captureException = (err, context) => {
  if (!isConfigured()) return;
  Sentry.captureException(err, context ? { extra: context } : undefined);
};

module.exports = { init, captureException, isConfigured };
