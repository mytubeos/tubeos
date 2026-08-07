import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

// See tests/integration/auth.service.test.js for why createRequire is used
// instead of `import` for local project files under test.
const require = createRequire(import.meta.url);
const stripeService = require('../../src/services/stripe.service.js');
const paymentService = require('../../src/services/payment.service.js');
const User = require('../../src/models/user.model.js');
const Coupon = require('../../src/models/coupon.model.js');
const Referral = require('../../src/models/referral.model.js');
const PaymentHistory = require('../../src/models/payment-history.model.js');

const createTestUser = async (overrides = {}) =>
  User.create({
    name: 'Test Creator',
    email: `user-${Date.now()}-${Math.random()}@example.com`,
    password: 'password123',
    isEmailVerified: true,
    ...overrides,
  });

// Shape of a Stripe Checkout Session at payment_status: 'paid' — only the
// fields activatePlanFromSession actually reads.
const buildSession = ({ id, paymentIntent, userId, plan, couponCode, amountTotal }) => ({
  id,
  payment_intent: paymentIntent,
  payment_status: 'paid',
  amount_total: amountTotal,
  metadata: { userId, plan, couponCode: couponCode || '' },
});

describe('stripe.service.activatePlanFromSession', () => {
  it('activates the plan from a paid session', async () => {
    const user = await createTestUser();
    const session = buildSession({
      id: 'cs_test1',
      paymentIntent: 'pi_test1',
      userId: user._id.toString(),
      plan: 'pro',
      amountTotal: 49900,
    });

    const result = await stripeService.activatePlanFromSession(session);

    expect(result.plan).toBe('pro');
    expect(result.subscriptionExpiresAt).toBeTruthy();

    const dbUser = await User.findById(user._id);
    expect(dbUser.plan).toBe('pro');
  });

  it('records a payment-history entry tagged gateway: stripe', async () => {
    const user = await createTestUser();
    const session = buildSession({
      id: 'cs_test2',
      paymentIntent: 'pi_test2',
      userId: user._id.toString(),
      plan: 'creator',
      amountTotal: 19900,
    });

    await stripeService.activatePlanFromSession(session);

    const entry = await PaymentHistory.findOne({ stripePaymentIntentId: 'pi_test2' });
    expect(entry).toBeTruthy();
    expect(entry.gateway).toBe('stripe');
    expect(entry.amount).toBe(19900);
    expect(entry.stripeSessionId).toBe('cs_test2');
    expect(entry.razorpayPaymentId).toBeUndefined();
  });

  it('redeems the coupon when a couponCode is present in metadata', async () => {
    const user = await createTestUser();
    await Coupon.create({
      code: 'STRIPE50',
      type: 'public',
      discountType: 'percent',
      discountValue: 50,
      validPlans: ['pro'],
    });
    const session = buildSession({
      id: 'cs_test3',
      paymentIntent: 'pi_test3',
      userId: user._id.toString(),
      plan: 'pro',
      couponCode: 'STRIPE50',
      amountTotal: 24950,
    });

    await stripeService.activatePlanFromSession(session);

    const coupon = await Coupon.findOne({ code: 'STRIPE50' });
    expect(coupon.usedCount).toBe(1);
  });

  it('credits the referrer wallet when the paying user was referred', async () => {
    const referrer = await createTestUser();
    const referredUser = await createTestUser({
      referral: { referredBy: referrer._id, myCode: 'REFCODE2' },
    });
    const session = buildSession({
      id: 'cs_test4',
      paymentIntent: 'pi_test4',
      userId: referredUser._id.toString(),
      plan: 'pro', // ₹499 → 10% default commission = ₹50
      amountTotal: 49900,
    });

    await stripeService.activatePlanFromSession(session);

    const updatedReferrer = await User.findById(referrer._id);
    expect(updatedReferrer.wallet.balance).toBe(50);

    const earning = await Referral.ReferralEarning.findOne({ referrerId: referrer._id });
    expect(earning).toBeTruthy();
    expect(earning.commissionAmount).toBe(50);
  });

  it('does not create a duplicate history entry when called twice for the same session (client-verify + webhook both firing)', async () => {
    const user = await createTestUser();
    const session = buildSession({
      id: 'cs_test5',
      paymentIntent: 'pi_test5',
      userId: user._id.toString(),
      plan: 'creator',
      amountTotal: 19900,
    });

    await stripeService.activatePlanFromSession(session);
    await stripeService.activatePlanFromSession(session);

    const count = await PaymentHistory.countDocuments({ stripePaymentIntentId: 'pi_test5' });
    expect(count).toBe(1);
  });

  it('returns null and touches nothing for a session missing userId/plan metadata', async () => {
    const result = await stripeService.activatePlanFromSession({
      id: 'cs_bad',
      payment_intent: 'pi_bad',
      payment_status: 'paid',
      metadata: {},
    });

    expect(result).toBeNull();
    const entry = await PaymentHistory.findOne({ stripePaymentIntentId: 'pi_bad' });
    expect(entry).toBeNull();
  });

  // Regression test for a real bug caught while building this: `stripePaymentIntentId`/
  // `razorpayPaymentId` used to have `default: null`, which — combined with a sparse
  // unique index — meant every row from the OTHER gateway got a literal `null` there
  // instead of the field being genuinely absent, and a second row of either gateway
  // collided on the sparse index (E11000 on a `null` dup key). Fixed by dropping the
  // `default: null` on both fields (see payment-history.model.js).
  it('a Razorpay row and multiple Stripe rows can coexist without unique-index collisions', async () => {
    const user = await createTestUser();

    await PaymentHistory.create({
      user: user._id,
      plan: 'creator',
      amount: 19900,
      originalAmount: 19900,
      razorpayPaymentId: 'pay_coexist1',
    });

    const sessionA = buildSession({
      id: 'cs_coexist_a',
      paymentIntent: 'pi_coexist_a',
      userId: user._id.toString(),
      plan: 'pro',
      amountTotal: 49900,
    });
    const sessionB = buildSession({
      id: 'cs_coexist_b',
      paymentIntent: 'pi_coexist_b',
      userId: user._id.toString(),
      plan: 'agency',
      amountTotal: 299900,
    });

    await expect(stripeService.activatePlanFromSession(sessionA)).resolves.toBeTruthy();
    await expect(stripeService.activatePlanFromSession(sessionB)).resolves.toBeTruthy();

    expect(await PaymentHistory.countDocuments({ user: user._id })).toBe(3);
  });
});

describe('stripe.service and payment.service share the same PLAN_PRICES', () => {
  it('exports the identical object, not a second hardcoded copy', () => {
    // Guards against a future price change being made in one place and
    // silently missed in the other.
    expect(paymentService.PLAN_PRICES).toBeTruthy();
    expect(paymentService.PLAN_PRICES.pro.amount).toBe(49900);
  });
});
