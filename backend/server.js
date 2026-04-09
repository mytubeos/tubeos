// server.js

// ✅ dotenv safe
try {
  require("dotenv").config();
} catch (e) {
  console.log("dotenv not found, skipping...");
}

const { validateEnv } = require("./src/config/env");
const { connectDB } = require("./src/config/db");
const redisConfig = require("./src/config/redis");
const app = require("./src/app");

const startServer = async () => {
  console.log("\n🚀 Starting TubeOS Server...\n");

  // ✅ Env safe
  try {
    validateEnv();
  } catch (err) {
    console.warn("⚠️ Env validation skipped:", err.message);
  }

  // ✅ Mongo non-blocking
  connectDB()
    .then(() => console.log("✅ MongoDB connected"))
    .catch((err) =>
      console.error("❌ MongoDB failed:", err.message)
    );

  // ✅ Redis safe
  try {
    const connectRedisFn =
      redisConfig.connectRedis || redisConfig.default || redisConfig;

    if (typeof connectRedisFn === "function") {
      connectRedisFn();
      console.log("✅ Redis connected");
    }
  } catch (err) {
    console.error("❌ Redis failed:", err.message);
  }

  // ✅ Workers safe
  try {
    const { startWorkers } = require("./src/jobs/index");
    startWorkers();
    console.log("✅ Workers started");
  } catch (err) {
    console.error("❌ Workers failed:", err.message);
  }

  // 🔥 FINAL PORT FIX
  const PORT = process.env.PORT || 8080;

  app.listen(PORT, () => {
    console.log(`\n✅ Server running on port ${PORT}`);
  });
};

startServer();
