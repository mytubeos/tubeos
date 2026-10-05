// tests/globalSetup.js — runs ONCE for the whole Vitest run (not per test
// file), unlike tests/setup.js. Starts a single shared MongoMemoryReplSet so
// N test files don't each spin up their own (which was slow and caused
// resource-contention flakiness — 6 files means 6 separate mongod instances
// starting/stopping concurrently otherwise).

import { MongoMemoryReplSet } from 'mongodb-memory-server';

export default async function () {
  const mongod = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  process.env.MONGO_MEMORY_URI = mongod.getUri();

  return async () => {
    await mongod.stop();
  };
}
