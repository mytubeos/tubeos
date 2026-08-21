import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

// See tests/integration/auth.service.test.js for why createRequire is used
// instead of `import` for local project files under test.
const require = createRequire(import.meta.url);
const dodoService = require('../../src/services/dodo.service.js');
const pricingService = require('../../src/services/pricing.service.js');
const User = require('../../src/models/user.model.js');
const PaymentHistory = require('../../src/models/payment-history.model.js');

const createTestUser = async (overrides = {}) =>
  User.create({
    name: 'Test Creator',
    email: `user-${Date.now()}-${Math.random()}@example.com`,
    password: 'password123',
    isEmailVerified: true,
    ...overrides,
  });

// Shape of a Dodo `payment.succeeded` webhook's `data` object — only the
// fields activatePlanFromPayload actually reads. `discounts` mirrors Dodo's
// own payload shape for a payment that had a Dodo-native discount code
// applied at checkout (see dodo-discount.service.js) — no longer anything
// Vezrin validates or redeems itself, just recorded for reporting.
const buildPayload = ({ userId, plan, couponCode, totalAmount }) => ({
  total_amount: totalAmount,
  metadata: { userId, plan },
  ...(couponCode ? { discounts: [{ code: couponCode }] } : {}),
});

describe('dodo.service.activatePlanFromPayload', () => {
  it('activates the plan from a succeeded payment', async () => {
    const user = await createTestUser();
    const payload = buildPayload({ userId: user._id.toString(), plan: 'pro', totalAmount: 999 });

    const result = await dodoService.activatePlanFromPayload(payload, 'pay_test1');

    expect(result.plan).toBe('pro');
    expect(result.subscriptionExpiresAt).toBeTruthy();

    const dbUser = await User.findById(user._id);
    expect(dbUser.plan).toBe('pro');
  });

  it('records a payment-history entry tagged gateway: dodo, currency USD', async () => {
    const user = await createTestUser();
    const payload = buildPayload({
      userId: user._id.toString(),
      plan: 'creator',
      totalAmount: 499,
    });

    await dodoService.activatePlanFromPayload(payload, 'pay_test2');

    const entry = await PaymentHistory.findOne({ dodoPaymentId: 'pay_test2' });
    expect(entry).toBeTruthy();
    expect(entry.gateway).toBe('dodo');
    expect(entry.currency).toBe('USD');
    expect(entry.amount).toBe(499);
    expect(entry.razorpayPaymentId).toBeUndefined();
    expect(entry.stripePaymentIntentId).toBeUndefined();
  });

  it('records which Dodo-native discount code was used, straight from the webhook payload', async () => {
    const user = await createTestUser();
    const payload = buildPayload({
      userId: user._id.toString(),
      plan: 'pro',
      couponCode: 'DODO50',
      totalAmount: 500,
    });

    await dodoService.activatePlanFromPayload(payload, 'pay_test3');

    const entry = await PaymentHistory.findOne({ dodoPaymentId: 'pay_test3' });
    expect(entry.couponCode).toBe('DODO50');
  });

  it('leaves couponCode null when no discount was applied', async () => {
    const user = await createTestUser();
    const payload = buildPayload({
      userId: user._id.toString(),
      plan: 'creator',
      totalAmount: 499,
    });

    await dodoService.activatePlanFromPayload(payload, 'pay_test3b');

    const entry = await PaymentHistory.findOne({ dodoPaymentId: 'pay_test3b' });
    expect(entry.couponCode).toBeNull();
  });

  it('does not create a duplicate history entry when the webhook is delivered twice', async () => {
    const user = await createTestUser();
    const payload = buildPayload({
      userId: user._id.toString(),
      plan: 'creator',
      totalAmount: 499,
    });

    await dodoService.activatePlanFromPayload(payload, 'pay_test4');
    await dodoService.activatePlanFromPayload(payload, 'pay_test4');

    const count = await PaymentHistory.countDocuments({ dodoPaymentId: 'pay_test4' });
    expect(count).toBe(1);
  });

  it('returns null and touches nothing for a payload missing userId/plan metadata', async () => {
    const result = await dodoService.activatePlanFromPayload({ metadata: {} }, 'pay_bad');

    expect(result).toBeNull();
    const entry = await PaymentHistory.findOne({ dodoPaymentId: 'pay_bad' });
    expect(entry).toBeNull();
  });

  it('a Razorpay row, a Stripe row, and a Dodo row can coexist without unique-index collisions', async () => {
    const user = await createTestUser();

    await PaymentHistory.create({
      user: user._id,
      plan: 'creator',
      amount: 19900,
      originalAmount: 19900,
      razorpayPaymentId: 'pay_coexist_rzp',
    });
    await PaymentHistory.create({
      user: user._id,
      plan: 'pro',
      amount: 49900,
      originalAmount: 49900,
      currency: 'EUR',
      gateway: 'stripe',
      stripePaymentIntentId: 'pi_coexist_stripe',
    });

    const payload = buildPayload({
      userId: user._id.toString(),
      plan: 'agency',
      totalAmount: 3999,
    });
    await expect(
      dodoService.activatePlanFromPayload(payload, 'pay_coexist_dodo')
    ).resolves.toBeTruthy();

    expect(await PaymentHistory.countDocuments({ user: user._id })).toBe(3);
  });
});

describe('dodo.service reads prices from pricing.service, not a hardcoded copy', () => {
  it('activatePlanFromPayload records the current admin-set USD price, not a stale constant', async () => {
    const user = await createTestUser();
    await pricingService.setPrices('pro', { USD: { amount: 1234, regularAmount: null } });

    const payload = buildPayload({ userId: user._id.toString(), plan: 'pro', totalAmount: 1234 });
    await dodoService.activatePlanFromPayload(payload, 'pay_price_test');

    const entry = await PaymentHistory.findOne({ dodoPaymentId: 'pay_price_test' });
    expect(entry.originalAmount).toBe(1234);
    expect(entry.currency).toBe('USD');
  });
});
