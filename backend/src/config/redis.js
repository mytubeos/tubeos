// src/config/redis.js
// Redis connection using ioredis (Upstash compatible)

const Redis = require('ioredis');
const { config } = require('./env');
const logger = require('./logger');

let redisClient = null;

const connectRedis = () => {
  try {
    redisClient = new Redis(config.redis.url, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: false,
      retryStrategy(times) {
        const delay = Math.min(times * 500, 2000);
        return delay;
      },
      reconnectOnError(err) {
        logger.warn('Redis reconnect on error', { error: err.message });
        return true;
      },
      lazyConnect: false,
      tls: config.redis.url.startsWith('rediss://') ? {} : undefined,
    });

    redisClient.on('connect', () => {
      logger.info('Redis Connected');
    });

    redisClient.on('error', (err) => {
      logger.error('Redis error', { error: err.message });
    });

    redisClient.on('reconnecting', () => {
      logger.warn('Redis reconnecting...');
    });

    return redisClient;
  } catch (error) {
    logger.error('Redis connection failed', { error: error.message });
    throw error;
  }
};

const getRedisClient = () => {
  if (!redisClient) {
    throw new Error('Redis not initialized. Call connectRedis() first.');
  }
  return redisClient;
};

// Test-only seam: Vitest's vi.mock() can't intercept this module's internal
// require()s from other plain-CommonJS files, so tests inject a fake client
// directly instead. No-op risk in production — nothing calls this outside tests.
const _setClientForTesting = (client) => {
  redisClient = client;
};

// Helper: Set value with expiry
const setCache = async (key, value, ttlSeconds = 3600) => {
  try {
    await redisClient.setex(key, ttlSeconds, JSON.stringify(value));
  } catch (err) {
    logger.error('Redis setCache error', { error: err.message });
  }
};

// Helper: Get value
const getCache = async (key) => {
  try {
    const data = await redisClient.get(key);
    return data ? JSON.parse(data) : null;
  } catch (err) {
    logger.error('Redis getCache error', { error: err.message });
    return null;
  }
};

// Helper: Delete key
const deleteCache = async (key) => {
  try {
    await redisClient.del(key);
  } catch (err) {
    logger.error('Redis deleteCache error', { error: err.message });
  }
};

// Helper: Check if key exists
const existsCache = async (key) => {
  try {
    return await redisClient.exists(key);
  } catch (err) {
    logger.error('Redis existsCache error', { error: err.message });
    return 0;
  }
};

module.exports = {
  connectRedis,
  getRedisClient,
  setCache,
  getCache,
  deleteCache,
  existsCache,
  _setClientForTesting,
};
