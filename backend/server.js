// server.js
// TubeOS — Main Entry Point

// ✅ dotenv only for local
if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

const { validateEnv, config } = require("./src/config/env");
const { connectDB } = require("./src/config/db");
const redisConfig = require("./src/config/redis");
const app = require("./src/app");

// ==================== STARTUP ====================
const startServer = async () => {
  try {
    console.log("\n🚀 Starting TubeOS Server...\n");

    // ✅ Safe env validation (won't crash server)
    try {
      validateEnv();
    } catch (err) {
      console.warn("⚠️ Env validation skipped:", err.message);
    }

    // ✅ MongoDB (safe)
    try {
      await connectDB();
      console.log("✅ MongoDB connected");
    } catch (err) {
      console.error("❌ MongoDB failed:", err.message);
    }

    // ✅ Redis (safe)
    try {
      const connectRedisFn =
        redisConfig.connectRedis || redisConfig.default || redisConfig;

      if (typeof connectRedisFn === "function") {
        connectRedisFn();
        console.log("✅ Redis connected");
      } else {
        console.warn("⚠️ Redis connectRedis not found, skipping...");
      }
    } catch (err) {
      console.error("❌ Redis failed:", err.message);
    }

    // ✅ Workers (safe)
    try {
      const { startWorkers } = require("./src/jobs/index");
      startWorkers();
      console.log("✅ Workers started");
    } catch (err) {
      console.error("❌ Workers failed:", err.message);
    }

    // ✅ IMPORTANT: Cloud Run port fix
    const PORT = process.env.PORT || config.port || 8080;

    const server = app.listen(PORT, () => {
      console.log(`\n✅ TubeOS Server running!`);
      console.log(`🌐 URL: http://localhost:${PORT}`);
      console.log(`📡 API: http://localhost:${PORT}/api/v1`);
      console.log(`❤️ Health: http://localhost:${PORT}/api/v1/health`);
      console.log(`🏓 Ping: http://localhost:${PORT}/api/v1/ping`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV}`);
      console.log("\n💀 TubeOS is ready to serve creators!\n");
    });

    // ==================== GRACEFUL SHUTDOWN ====================
    const shutdown = async (signal) => {
      console.log(`\n⚠️ ${signal} received. Graceful shutdown starting...`);

      server.close(async () => {
        console.log("✅ HTTP server closed");

        try {
          const mongoose = require("mongoose");
          await mongoose.connection.close();
          console.log("✅ MongoDB connection closed");
        } catch (err) {
          console.error("Error closing MongoDB:", err);
        }

        console.log("👋 TubeOS shutdown complete");
        process.exit(0);
      });

      setTimeout(() => {
        console.error("⚠️ Forced shutdown after timeout");
        process.exit(1);
      }, 10000);
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));

    // ==================== ERROR HANDLING ====================
    process.on("uncaughtException", (err) => {
      console.error("🚨 Uncaught Exception:", err);
      process.exit(1);
    });

    process.on("unhandledRejection", (reason, promise) => {
      console.error("🚨 Unhandled Rejection:", reason);
      process.exit(1);
    });

    return server;
  } catch (err) {
    console.error("❌ Failed to start server:", err.message);
    process.exit(1);
  }
};

startServer();
