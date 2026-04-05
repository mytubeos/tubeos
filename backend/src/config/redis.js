// src/config/redis.js
// Redis connection using ioredis (Upstash compatible)

const Redis = require('ioredis');
const { config } = require('./env');

let redisClient = null;

const connectRedis = () => {
  try {
    redisClient = new Redis(config.redis.url, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        const delay = Math.min(times * 500, 2000);
        return delay;
      },
      reconnectOnError(err) {
        console.warn('⚠️  Redis reconnect on error:', err.message);
        return true;
      },
      lazyConnect: false,
      tls: config.redis.url.startsWith('rediss://') ? {} : undefined,
    });

    redisClient.on('connect', () => {
      console.log('✅ Redis Connected');
    });

    redisClient.on('error', (err) => {
      console.error('❌ Redis error:', err.message);
    });

    redisClient.on('reconnecting', () => {
      console.warn('🔄 Redis reconnecting...');
    });

    return redisClient;
  } catch (error) {
    console.error('❌ Redis connection failed:', error.message);
    throw error;
  }
};

const getRedisClient = () => {
  if (!redisClient) {
    throw new Error('Redis not initialized. Call connectRedis() first.');
  }
  return redisClient;
};

// Helper: Set value with expiry
const setCache = async (key, value, ttlSeconds = 3600) => {
  try {
    await redisClient.setex(key, ttlSeconds, JSON.stringify(value));
  } catch (err) {
    console.error('Redis setCache error:', err.message);
  }
};

// Helper: Get value
const getCache = async (key) => {
  try {
    const data = await redisClient.get(key);
    return data ? JSON.parse(data) : null;
  } catch (err) {
    console.error('Redis getCache error:', err.message);
    return null;
  }
};

// Helper: Delete key
const deleteCache = async (key) => {
  try {
    await redisClient.del(key);
  } catch (err) {
    console.error('Redis deleteCache error:', err.message);
  }
};

// Helper: Check if key exists
const existsCache = async (key) => {
  try {
    return await redisClient.exists(key);
  } catch (err) {
    console.error('Redis existsCache error:', err.message);
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
};
