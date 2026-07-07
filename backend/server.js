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

    // 4. Job scheduling — BullMQ if Redis supports evalsha, setInterval cron as fallback.
    //    BullMQ ensures only ONE instance processes each job (safe for multi-instance Render).
    //    setInterval fallback runs on every instance (acceptable for single-instance free plan).
    let bullmqRunning = false;
    try {
      const { startWorkers } = require('./src/jobs/index');
      await startWorkers();
      bullmqRunning = true;
      logger.info('Job scheduling: BullMQ active (distributed, multi-instance safe)');
    } catch (err) {
      logger.warn('BullMQ unavailable — falling back to in-process setInterval cron', {
        reason: err.message,
        note: 'Upgrade to Upstash Pay-As-You-Go or a dedicated Redis to enable BullMQ',
      });
    }

    if (!bullmqRunning) {
      try {
        const { startCron } = require('./src/jobs/cron');
        startCron();
        logger.info('Job scheduling: setInterval cron active (single-instance only)');
      } catch (err) {
        logger.warn('In-process cron failed to start', { error: err.message });
      }
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

      // Stop BullMQ workers first so no new jobs start during drain
      if (bullmqRunning) {
        try {
          const { stopWorkers } = require('./src/jobs/index');
          await stopWorkers();
        } catch (err) {
          logger.warn('BullMQ shutdown error', { error: err.message });
        }
      } else {
        try {
          const { stopCron } = require('./src/jobs/cron');
          stopCron();
        } catch {
          /* ignore */
        }
      }

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
      logger.error('Unhandled Rejection', {
        reason: reason instanceof Error ? reason.message : String(reason),
      });
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
