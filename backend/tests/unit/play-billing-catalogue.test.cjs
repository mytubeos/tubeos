const { test } = require('node:test');
const assert = require('node:assert/strict');
const { subscriptionState } = require('../../src/services/play-billing.rules');

const now = new Date('2026-10-28T12:00:00Z');
const purchase = (productId, basePlanId) => ({
  kind: 'androidpublisher#subscriptionPurchaseV2',
  subscriptionState: 'SUBSCRIPTION_STATE_ACTIVE',
  startTime: '2026-10-28T11:00:00Z',
  lineItems: [
    {
      productId,
      expiryTime: '2026-11-28T11:00:00Z',
      offerDetails: { basePlanId },
      autoRenewingPlan: { autoRenewEnabled: true },
    },
  ],
});

test('accepts the observed Creator montly base plan without upgrading its tier', () => {
  const result = subscriptionState(purchase('vezrin_creator_monthly', 'montly'), now);
  assert.equal(result.plan, 'creator');
  assert.equal(result.active, true);
});

for (const [product, plan] of [
  ['creator', 'creator'],
  ['pro', 'pro'],
  ['max', 'agency'],
]) {
  test(`preserves canonical monthly ${product} purchases`, () => {
    const result = subscriptionState(purchase(`vezrin_${product}_monthly`, 'monthly'), now);
    assert.equal(result.plan, plan);
    assert.equal(result.active, true);
  });
}

for (const [product, basePlan] of [
  ['vezrin_pro_monthly', 'montly'],
  ['vezrin_max_monthly', 'montly'],
  ['unknown_product', 'montly'],
  ['unknown_product', 'monthly'],
  ['vezrin_creator_monthly', 'weekly'],
  ['vezrin_creator_monthly', undefined],
]) {
  test(`rejects unapproved catalogue pair ${product}/${basePlan}`, () => {
    assert.throws(
      () => subscriptionState(purchase(product, basePlan), now),
      /Unknown Google Play plan/
    );
  });
}

test('the Creator alias does not activate expired or pending purchases', () => {
  const expired = purchase('vezrin_creator_monthly', 'montly');
  expired.lineItems[0].expiryTime = '2026-10-27T11:00:00Z';
  assert.equal(subscriptionState(expired, now).active, false);
  const pending = purchase('vezrin_creator_monthly', 'montly');
  pending.subscriptionState = 'SUBSCRIPTION_STATE_PENDING';
  assert.equal(subscriptionState(pending, now).active, false);
});
