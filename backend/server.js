// server.js
// TubeOS — Main Entry Point
// Boots up: Config validation → DB → Redis → Express server

require('dotenv').config();

const { validateEnv, config } = require('./src/config/env');
const { connectDB } = require('./src/config/db');
const redisConfig = require('./src/config/redis');
const app = require('./src/app');

// ==================== STARTUP ====================
const startServer = async () => {
  try {
    console.log('\n🚀 Starting TubeOS Server...\n');

    // 1. Validate environment variables
    validateEnv();

    // 2. Connect to MongoDB
    await connectDB();

    // 3. Connect to Redis
    const connectRedisFn = redisConfig.connectRedis || redisConfig.default || redisConfig;
    if (typeof connectRedisFn === 'function') {
      connectRedisFn();
    } else {
      console.warn('⚠️  Redis connectRedis not found, skipping...');
    }

    // 4. Start BullMQ Workers
    const { startWorkers } = require('./src/jobs/index');
    startWorkers();

    // 5. Start Express server
    const PORT = config.port;
    const server = app.listen(PORT, () => {
      console.log(`\n✅ TubeOS Server running!`);
      console.log(`🌐 URL:         http://localhost:${PORT}`);
      console.log(`📡 API:         http://localhost:${PORT}/api/v1`);
      console.log(`❤️  Health:      http://localhost:${PORT}/api/v1/health`);
      console.log(`🏓 Ping:        http://localhost:${PORT}/api/v1/ping`);
      console.log(`🌍 Environment: ${config.nodeEnv}`);
      console.log('\n💀 TubeOS is ready to serve creators!\n');
    });

    // ==================== GRACEFUL SHUTDOWN ====================
    const shutdown = async (signal) => {
      console.log(`\n⚠️  ${signal} received. Graceful shutdown starting...`);

      server.close(async () => {
        console.log('✅ HTTP server closed');

        try {
          const mongoose = require('mongoose');
          await mongoose.connection.close();
          console.log('✅ MongoDB connection closed');
        } catch (err) {
          console.error('Error closing MongoDB:', err);
        }

        console.log('👋 TubeOS shutdown complete');
        process.exit(0);
      });

      // Force shutdown after 10 seconds
      setTimeout(() => {
        console.error('⚠️  Forced shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    // ==================== UNHANDLED ERRORS ====================
    process.on('uncaughtException', (err) => {
      console.error('🚨 Uncaught Exception:', err);
      process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('🚨 Unhandled Rejection at:', promise, 'reason:', reason);
      process.exit(1);
    });

    return server;
  } catch (err) {
    console.error('❌ Failed to start server:', err.message);
    process.exit(1);
  }
};

startServer();
