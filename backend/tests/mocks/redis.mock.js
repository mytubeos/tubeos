// tests/mocks/redis.mock.js
// A minimal in-memory stand-in for the ioredis client, injected directly
// into src/config/redis.js via its `_setClientForTesting` test seam.
//
// Why not vi.mock('../../src/config/redis')? Vitest's mock interception only
// reliably covers modules reached through this test file's own ESM import
// graph — a plain CommonJS file's *internal* require() of the same module
// (e.g. auth.service.js's `require('../config/redis')`) resolves through
// Node's native require cache and never sees the vi.mock() replacement
// (confirmed via a minimal repro). Injecting a fake client into the real,
// unmocked module sidesteps that entirely.
//
// Usage:
//   import redisConfig from '../../src/config/redis.js';
//   import { createFakeRedisClient } from '../mocks/redis.mock.js';
//   redisConfig._setClientForTesting(createFakeRedisClient());

export const createFakeRedisClient = () => {
  const store = new Map();
  return {
    set: async (key, value) => {
      store.set(key, String(value));
      return 'OK';
    },
    setex: async (key, _ttl, value) => {
      store.set(key, String(value));
      return 'OK';
    },
    get: async (key) => (store.has(key) ? store.get(key) : null),
    del: async (key) => (store.delete(key) ? 1 : 0),
    exists: async (key) => (store.has(key) ? 1 : 0),
  };
};
