// server.js
// TubeOS — Main Entry Point
// Boots up: Config validation → DB → Redis → Express server

require('dotenv').config();

// Initialize Sentry before anything else so early startup crashes are captured too.
const sentry = require('./src/config/sentry');
sentry.init();

const { validateEnv, config } = require('./src/config/env');
const { connectDB } = require('./src/config/db');
const redisConfig = require('./src/config/redis');
const app = require('./src/app');
const logger = require('./src/config/logger');

// ==================== STARTUP ====================
const startServer = async () => {
  try {
    logger.info('Starting TubeOS Server...');

    // 1. Validate environment variables
    validateEnv();

    // 2. Connect to MongoDB
    await connectDB();

    // 3. Connect to Redis
    const connectRedisFn = redisConfig.connectRedis || redisConfig.default || redisConfig;
    if (typeof connectRedisFn === 'function') {
      connectRedisFn();
    } else {
      logger.warn('Redis connectRedis not found, skipping...');
    }

    // 4. Start BullMQ Workers (skip if Upstash free plan blocks evalsha)
    try {
      const { startWorkers } = require('./src/jobs/index');
      startWorkers();
    } catch (err) {
      logger.warn('BullMQ workers skipped (Upstash free plan limitation)', { error: err.message });
    }

    // 4b. Start in-process cron (always — replaces BullMQ where stubbed)
    try {
      const { startCron } = require('./src/jobs/cron');
      startCron();
    } catch (err) {
      logger.warn('In-process cron failed to start', { error: err.message });
    }

    // 5. Start Express server
    const PORT = config.port;
    const server = app.listen(PORT, '0.0.0.0', () => {
      logger.info('TubeOS Server running!', {
        url: `http://localhost:${PORT}`,
        api: `http://localhost:${PORT}/api/v1`,
        environment: config.nodeEnv,
      });
    });

    // ==================== GRACEFUL SHUTDOWN ====================
    const shutdown = async (signal) => {
      logger.info(`${signal} received. Graceful shutdown starting...`);

      server.close(async () => {
        logger.info('HTTP server closed');

        try {
          const mongoose = require('mongoose');
          await mongoose.connection.close();
          logger.info('MongoDB connection closed');
        } catch (err) {
          logger.error('Error closing MongoDB', { error: err.message });
        }

        logger.info('TubeOS shutdown complete');
        process.exit(0);
      });

      // Force shutdown after 10 seconds
      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    // ==================== UNHANDLED ERRORS ====================
    process.on('uncaughtException', (err) => {
      logger.error('Uncaught Exception', { error: err.message, stack: err.stack });
      sentry.captureException(err);
      process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection', { reason: reason instanceof Error ? reason.message : String(reason) });
      sentry.captureException(reason instanceof Error ? reason : new Error(String(reason)));
      process.exit(1);
    });

    return server;
  } catch (err) {
    logger.error('Failed to start server', { error: err.message });
    sentry.captureException(err);
    process.exit(1);
  }
};

startServer();
