import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'module';
import { createFakeRedisClient } from '../mocks/redis.mock.js';

// See tests/integration/auth.service.test.js for why createRequire is used
// instead of `import` for local project files under test.
const require = createRequire(import.meta.url);
const redisConfig = require('../../src/config/redis.js');

const planLimitService = require('../../src/services/plan-limit.service.js');
const PlanLimit = require('../../src/models/plan-limit.model.js');

// Fresh fake Redis store per test, not just once per file — Mongo is wiped
// after every test (tests/setup.js's global afterEach) but a module-level
// fake client would keep serving a stale plan-limits cache across tests
// after that wipe, since nothing else clears it.
beforeEach(() => {
  redisConfig._setClientForTesting(createFakeRedisClient());
});

describe('plan-limit.service.getAllLimits', () => {
  it('auto-seeds all 4 plans on first read, matching the old hardcoded defaults', async () => {
    expect(await PlanLimit.countDocuments()).toBe(0);

    const all = await planLimitService.getAllLimits();

    expect(Object.keys(all).sort()).toEqual(['agency', 'creator', 'free', 'pro']);
    for (const plan of planLimitService.PLANS) {
      expect(all[plan]).toEqual(planLimitService.DEFAULT_LIMITS[plan]);
    }
    expect(await PlanLimit.countDocuments()).toBe(4);
  });

  it('serves from cache on a second read instead of re-querying Mongo', async () => {
    await planLimitService.getAllLimits();
    await PlanLimit.updateOne({ plan: 'free' }, { aiContent: 999 });

    // Cache is still warm from the first call, so this shouldn't see the
    // direct DB write above.
    const second = await planLimitService.getAllLimits();
    expect(second.free.aiContent).toBe(20);
  });

  it('agency defaults to unlimited (null) on everything except thumbnailGen', async () => {
    const all = await planLimitService.getAllLimits();
    expect(all.agency.uploads).toBeNull();
    expect(all.agency.aiReplies).toBeNull();
    expect(all.agency.aiContent).toBeNull();
    expect(all.agency.bulkReplies).toBeNull();
    expect(all.agency.thumbnailGen).toBe(50);
  });
});

describe('plan-limit.service.getLimitsForPlan', () => {
  it("returns free's limits for an unrecognized plan", async () => {
    const limits = await planLimitService.getLimitsForPlan('enterprise');
    expect(limits).toEqual(planLimitService.DEFAULT_LIMITS.free);
  });
});

describe('plan-limit.service.setLimits', () => {
  it('updates only the fields provided, leaving the rest untouched', async () => {
    await planLimitService.getAllLimits(); // seed a baseline first

    const result = await planLimitService.setLimits('free', { thumbnailGen: 8 });

    expect(result.thumbnailGen).toBe(8);
    expect(result.aiContent).toBe(20); // unchanged

    const row = await PlanLimit.findOne({ plan: 'free' });
    expect(row.thumbnailGen).toBe(8);
  });

  it('invalidates the cache so the next read reflects the write', async () => {
    await planLimitService.getAllLimits(); // warm the cache
    await planLimitService.setLimits('creator', { aiContent: 750 });

    const all = await planLimitService.getAllLimits();
    expect(all.creator.aiContent).toBe(750);
  });

  it('accepts null to mean unlimited', async () => {
    await planLimitService.setLimits('pro', { aiReplies: null });
    const limits = await planLimitService.getLimitsForPlan('pro');
    expect(limits.aiReplies).toBeNull();
  });

  it('records which admin made the change', async () => {
    const adminId = '507f1f77bcf86cd799439011';
    await planLimitService.setLimits('agency', { thumbnailGen: 100 }, adminId);

    const row = await PlanLimit.findOne({ plan: 'agency' });
    expect(row.updatedBy.toString()).toBe(adminId);
  });

  it('rejects a negative or non-numeric value', async () => {
    await expect(planLimitService.setLimits('pro', { uploads: -5 })).rejects.toMatchObject({
      statusCode: 400,
    });
    await expect(
      planLimitService.setLimits('pro', { uploads: 'not-a-number' })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('rejects an unknown plan', async () => {
    await expect(planLimitService.setLimits('enterprise', { uploads: 5 })).rejects.toMatchObject({
      statusCode: 400,
    });
  });
});
