import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

// See tests/integration/auth.service.test.js for why createRequire is used
// instead of `import` for local project files under test.
const require = createRequire(import.meta.url);
const pricingService = require('../../src/services/pricing.service.js');
const PlanPrice = require('../../src/models/plan-price.model.js');

describe('pricing.service.getPrice', () => {
  it('auto-seeds the default row the first time a plan+currency is read', async () => {
    expect(await PlanPrice.findOne({ plan: 'creator', currency: 'INR' })).toBeNull();

    const row = await pricingService.getPrice('creator', 'INR');

    expect(row.amount).toBe(pricingService.DEFAULT_PRICES.creator.INR.amount);
    expect(await PlanPrice.countDocuments({ plan: 'creator', currency: 'INR' })).toBe(1);
  });

  it('returns the same row on a second read instead of re-seeding', async () => {
    const first = await pricingService.getPrice('pro', 'USD');
    await PlanPrice.updateOne({ _id: first._id }, { amount: 555 });

    const second = await pricingService.getPrice('pro', 'USD');

    expect(second.amount).toBe(555);
    expect(await PlanPrice.countDocuments({ plan: 'pro', currency: 'USD' })).toBe(1);
  });

  it('rejects an unknown plan', async () => {
    await expect(pricingService.getPrice('enterprise', 'INR')).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it('rejects an unknown currency', async () => {
    await expect(pricingService.getPrice('pro', 'GBP')).rejects.toMatchObject({
      statusCode: 400,
    });
  });
});

describe('pricing.service.getAllPrices', () => {
  it('returns all 3 plans, each with all 3 currencies', async () => {
    const all = await pricingService.getAllPrices();

    expect(all).toHaveLength(3);
    for (const { plan, prices } of all) {
      expect(['creator', 'pro', 'agency']).toContain(plan);
      expect(Object.keys(prices).sort()).toEqual(['EUR', 'INR', 'USD']);
      expect(prices.INR.amount).toBe(pricingService.DEFAULT_PRICES[plan].INR.amount);
    }
  });
});

describe('pricing.service.setPrices', () => {
  it('upserts only the currencies provided, leaving the rest untouched', async () => {
    await pricingService.getPrice('agency', 'EUR'); // seed a baseline first

    await pricingService.setPrices('agency', {
      INR: { amount: 349900, regularAmount: 649900 },
    });

    const inr = await pricingService.getPrice('agency', 'INR');
    const eur = await pricingService.getPrice('agency', 'EUR');
    expect(inr.amount).toBe(349900);
    expect(inr.regularAmount).toBe(649900);
    expect(eur.amount).toBe(pricingService.DEFAULT_PRICES.agency.EUR.amount); // unchanged
  });

  it('records which admin made the change', async () => {
    const adminId = '507f1f77bcf86cd799439011';
    await pricingService.setPrices('creator', { USD: { amount: 599 } }, adminId);

    const row = await PlanPrice.findOne({ plan: 'creator', currency: 'USD' });
    expect(row.updatedBy.toString()).toBe(adminId);
  });

  it('rejects a negative or non-numeric amount', async () => {
    await expect(pricingService.setPrices('pro', { INR: { amount: -100 } })).rejects.toMatchObject({
      statusCode: 400,
    });
    await expect(
      pricingService.setPrices('pro', { INR: { amount: 'not-a-number' } })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('accepts a null regularAmount (no struck-through price)', async () => {
    await pricingService.setPrices('pro', { EUR: { amount: 999, regularAmount: null } });
    const row = await pricingService.getPrice('pro', 'EUR');
    expect(row.regularAmount).toBeNull();
  });
});
