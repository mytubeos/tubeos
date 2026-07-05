// tests/setup.js — per-test-file Vitest setup: env vars + connects to the
// single shared MongoMemoryServer started once in tests/globalSetup.js.

process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET = 'test-access-secret-at-least-32-characters-long';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-at-least-32-characters-long';
process.env.CLIENT_URL = 'http://localhost:3000';
process.env.MONGODB_URI = 'mongodb://unused/replaced-by-mongodb-memory-server';
process.env.REDIS_URL = 'redis://unused/replaced-by-mock';
process.env.YOUTUBE_CLIENT_ID = 'test-youtube-client-id';
process.env.YOUTUBE_CLIENT_SECRET = 'test-youtube-client-secret';
process.env.YOUTUBE_REDIRECT_URI = 'http://localhost:8080/api/v1/youtube/callback';
process.env.RAZORPAY_KEY_ID = 'rzp_test_key_id';
process.env.RAZORPAY_KEY_SECRET = 'test_razorpay_key_secret';
process.env.RAZORPAY_WEBHOOK_SECRET = 'test_razorpay_webhook_secret';

import { beforeAll, afterEach } from 'vitest';
import mongoose from 'mongoose';
import crypto from 'crypto';

// Note: this file only handles env vars + connecting to the shared in-memory
// Mongo instance. Redis mocking (tests/mocks/redis.mock.js) is NOT
// registered here — Vitest's vi.mock hoisting only reliably applies within
// the test file it's declared in, so each test file that needs it calls
// `vi.mock('../../src/config/redis.js', createRedisMock)` itself.

beforeAll(async () => {
  if (mongoose.connection.readyState === 0) {
    // Vitest runs test files in parallel by default. All files share one
    // mongod process (tests/globalSetup.js), but each gets its own logical
    // database on it — otherwise one file's afterEach `deleteMany({})` wipes
    // data another file's test is still using mid-run.
    await mongoose.connect(process.env.MONGO_MEMORY_URI, {
      dbName: `test-${crypto.randomBytes(6).toString('hex')}`,
    });
  }
}, 30000);

afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key of Object.keys(collections)) {
    await collections[key].deleteMany({});
  }
});

// No afterAll disconnect/dropDatabase here — the Mongo instance is shared
// across every test file in this run (tests/globalSetup.js owns its
// lifecycle) and other files may still be using the connection.
