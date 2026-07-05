// tests/globalSetup.js — runs ONCE for the whole Vitest run (not per test
// file), unlike tests/setup.js. Starts a single shared MongoMemoryServer so
// N test files don't each spin up their own (which was slow and caused
// resource-contention flakiness — 6 files means 6 separate mongod instances
// starting/stopping concurrently otherwise).

import { MongoMemoryServer } from 'mongodb-memory-server';

export default async function () {
  const mongod = await MongoMemoryServer.create();
  process.env.MONGO_MEMORY_URI = mongod.getUri();

  return async () => {
    await mongod.stop();
  };
}
