import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
import crypto from 'crypto';

// See tests/integration/auth.service.test.js for why createRequire is used
// instead of `import` for local project files under test.
const require = createRequire(import.meta.url);
const paymentService = require('../../src/services/payment.service.js');
const User = require('../../src/models/user.model.js');
const Coupon = require('../../src/models/coupon.model.js');
const Referral = require('../../src/models/referral.model.js');
const PaymentHistory = require('../../src/models/payment-history.model.js');

const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;
const WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET;

const createTestUser = async (overrides = {}) =>
  User.create({
    name: 'Test Creator',
    email: `user-${Date.now()}-${Math.random()}@example.com`,
    password: 'password123',
    isEmailVerified: true,
    ...overrides,
  });

const signOrderPayment = (orderId, paymentId, secret = KEY_SECRET) =>
  crypto.createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex');

const signWebhookBody = (rawBody, secret = WEBHOOK_SECRET) =>
  crypto.createHmac('sha256', secret).update(rawBody).digest('hex');

describe('payment.service.verifyPayment', () => {
  it('activates the plan when the signature is correct', async () => {
    const user = await createTestUser();
    const razorpayOrderId = 'order_test123';
    const razorpayPaymentId = 'pay_test456';
    const razorpaySignature = signOrderPayment(razorpayOrderId, razorpayPaymentId);

    const result = await paymentService.verifyPayment(user._id.toString(), {
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
      plan: 'pro',
    });

    expect(result.plan).toBe('pro');
    expect(result.subscriptionExpiresAt).toBeTruthy();

    const dbUser = await User.findById(user._id);
    expect(dbUser.plan).toBe('pro');
    expect(dbUser.razorpaySubscriptionId).toBe(razorpayPaymentId);
  });

  it('rejects a tampered/incorrect signature with 400 and does NOT change the plan', async () => {
    const user = await createTestUser();

    await expect(
      paymentService.verifyPayment(user._id.toString(), {
        razorpayOrderId: 'order_test123',
        razorpayPaymentId: 'pay_test456',
        razorpaySignature: 'clearly-forged-signature',
        plan: 'agency',
      })
    ).rejects.toMatchObject({ statusCode: 400 });

    const dbUser = await User.findById(user._id);
    expect(dbUser.plan).toBe('free'); // unchanged
  });

  it('rejects a signature computed with the wrong secret (e.g. a stolen order id replayed)', async () => {
    const user = await createTestUser();
    const razorpayOrderId = 'order_test123';
    const razorpayPaymentId = 'pay_test456';
    // Signed with a different secret than the server actually uses
    const razorpaySignature = signOrderPayment(razorpayOrderId, razorpayPaymentId, 'wrong_secret');

    await expect(
      paymentService.verifyPayment(user._id.toString(), {
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature,
        plan: 'pro',
      })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('rejects an invalid plan name with 400 even with a valid signature', async () => {
    const user = await createTestUser();
    const razorpayOrderId = 'order_test123';
    const razorpayPaymentId = 'pay_test456';
    const razorpaySignature = signOrderPayment(razorpayOrderId, razorpayPaymentId);

    await expect(
      paymentService.verifyPayment(user._id.toString(), {
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature,
        plan: 'not-a-real-plan',
      })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('redeems the coupon (increments usedCount) when a couponCode is supplied', async () => {
    const user = await createTestUser();
    await Coupon.create({
      code: 'LAUNCH50',
      type: 'public',
      discountType: 'percent',
      discountValue: 50,
      validPlans: ['pro'],
    });

    const razorpayOrderId = 'order_coupon';
    const razorpayPaymentId = 'pay_coupon';
    const razorpaySignature = signOrderPayment(razorpayOrderId, razorpayPaymentId);

    await paymentService.verifyPayment(user._id.toString(), {
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
      plan: 'pro',
      couponCode: 'launch50', // lowercase — service uppercases before lookup
    });

    const coupon = await Coupon.findOne({ code: 'LAUNCH50' });
    expect(coupon.usedCount).toBe(1);
  });

  it('credits the referrer wallet when the paying user was referred', async () => {
    const referrer = await createTestUser();
    const referredUser = await createTestUser({
      referral: { referredBy: referrer._id, myCode: 'REFCODE1' },
    });

    const razorpayOrderId = 'order_ref';
    const razorpayPaymentId = 'pay_ref';
    const razorpaySignature = signOrderPayment(razorpayOrderId, razorpayPaymentId);

    await paymentService.verifyPayment(referredUser._id.toString(), {
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
      plan: 'pro', // ₹499 → 10% default commission rate = ₹50
    });

    const updatedReferrer = await User.findById(referrer._id);
    expect(updatedReferrer.wallet.balance).toBe(50);

    const earning = await Referral.ReferralEarning.findOne({ referrerId: referrer._id });
    expect(earning).toBeTruthy();
    expect(earning.commissionAmount).toBe(50);
  });
});

describe('payment.service.handleWebhook', () => {
  const buildCapturedEvent = (userId, plan, paymentId = 'pay_webhook1') =>
    JSON.stringify({
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: paymentId,
            notes: { userId, plan },
          },
        },
      },
    });

  it('activates the plan when the webhook signature is correct', async () => {
    const user = await createTestUser();
    const rawBody = buildCapturedEvent(user._id.toString(), 'agency');
    const signature = signWebhookBody(rawBody);

    await paymentService.handleWebhook(rawBody, signature);

    const dbUser = await User.findById(user._id);
    expect(dbUser.plan).toBe('agency');
  });

  it('rejects a forged webhook signature with 400 and does NOT change the plan', async () => {
    const user = await createTestUser();
    const rawBody = buildCapturedEvent(user._id.toString(), 'agency');

    await expect(paymentService.handleWebhook(rawBody, 'forged-signature')).rejects.toMatchObject({
      statusCode: 400,
    });

    const dbUser = await User.findById(user._id);
    expect(dbUser.plan).toBe('free');
  });

  it('ignores events other than payment.captured without error', async () => {
    const user = await createTestUser();
    const rawBody = JSON.stringify({
      event: 'payment.failed',
      payload: { payment: { entity: { id: 'pay_x', notes: { userId: user._id.toString() } } } },
    });
    const signature = signWebhookBody(rawBody);

    await expect(paymentService.handleWebhook(rawBody, signature)).resolves.toBeUndefined();

    const dbUser = await User.findById(user._id);
    expect(dbUser.plan).toBe('free'); // untouched
  });
});

describe('payment.service payment history', () => {
  it('verifyPayment records a history entry at full list price when no coupon is used', async () => {
    const user = await createTestUser();
    const razorpayOrderId = 'order_hist1';
    const razorpayPaymentId = 'pay_hist1';
    const razorpaySignature = signOrderPayment(razorpayOrderId, razorpayPaymentId);

    await paymentService.verifyPayment(user._id.toString(), {
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
      plan: 'pro',
    });

    const entry = await PaymentHistory.findOne({ razorpayPaymentId });
    expect(entry).toBeTruthy();
    expect(entry.amount).toBe(49900); // ₹499 in paise
    expect(entry.originalAmount).toBe(49900);
    expect(entry.couponCode).toBeNull();
  });

  it('verifyPayment records the discounted amount when a coupon is used', async () => {
    const user = await createTestUser();
    await Coupon.create({
      code: 'HALFOFF',
      type: 'public',
      discountType: 'percent',
      discountValue: 50,
      validPlans: ['pro'],
    });

    const razorpayOrderId = 'order_hist2';
    const razorpayPaymentId = 'pay_hist2';
    const razorpaySignature = signOrderPayment(razorpayOrderId, razorpayPaymentId);

    await paymentService.verifyPayment(user._id.toString(), {
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
      plan: 'pro',
      couponCode: 'HALFOFF',
    });

    const entry = await PaymentHistory.findOne({ razorpayPaymentId });
    expect(entry.amount).toBe(25000); // 50% off ₹499 → ₹250 → 25000 paise
    expect(entry.originalAmount).toBe(49900);
    expect(entry.couponCode).toBe('HALFOFF');
  });

  it('handleWebhook records a history entry using the amount in the payload', async () => {
    const user = await createTestUser();
    const rawBody = JSON.stringify({
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: 'pay_webhook_hist',
            order_id: 'order_webhook_hist',
            amount: 299900,
            notes: { userId: user._id.toString(), plan: 'agency' },
          },
        },
      },
    });
    const signature = signWebhookBody(rawBody);

    await paymentService.handleWebhook(rawBody, signature);

    const entry = await PaymentHistory.findOne({ razorpayPaymentId: 'pay_webhook_hist' });
    expect(entry).toBeTruthy();
    expect(entry.amount).toBe(299900);
    expect(entry.plan).toBe('agency');
  });

  it('does not create a duplicate history entry when verify and webhook fire for the same payment', async () => {
    const user = await createTestUser();
    const razorpayOrderId = 'order_dupe';
    const razorpayPaymentId = 'pay_dupe';
    const razorpaySignature = signOrderPayment(razorpayOrderId, razorpayPaymentId);

    await paymentService.verifyPayment(user._id.toString(), {
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
      plan: 'creator',
    });

    // Simulate the webhook firing for the same payment afterwards
    const rawBody = JSON.stringify({
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: razorpayPaymentId,
            order_id: razorpayOrderId,
            amount: 19900,
            notes: { userId: user._id.toString(), plan: 'creator' },
          },
        },
      },
    });
    const signature = signWebhookBody(rawBody);

    await expect(paymentService.handleWebhook(rawBody, signature)).resolves.toBeUndefined();

    const count = await PaymentHistory.countDocuments({ razorpayPaymentId });
    expect(count).toBe(1);
  });

  it('getPaymentHistory returns entries newest-first, paginated', async () => {
    const user = await createTestUser();
    for (const [i, paymentId] of ['pay_p1', 'pay_p2', 'pay_p3'].entries()) {
      await PaymentHistory.create({
        user: user._id,
        plan: 'creator',
        amount: 19900,
        originalAmount: 19900,
        razorpayPaymentId: paymentId,
        createdAt: new Date(Date.now() + i * 1000),
      });
    }

    const result = await paymentService.getPaymentHistory(user._id.toString(), {
      page: 1,
      limit: 2,
    });

    expect(result.total).toBe(3);
    expect(result.history).toHaveLength(2);
    expect(result.history[0].razorpayPaymentId).toBe('pay_p3'); // newest first
  });
});

describe('payment.service.downgradeToFree', () => {
  it('switches the plan to free and clears the expiry date', async () => {
    const user = await createTestUser({
      plan: 'pro',
      subscriptionExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });

    const result = await paymentService.downgradeToFree(user._id.toString());
    expect(result.plan).toBe('free');

    const dbUser = await User.findById(user._id);
    expect(dbUser.plan).toBe('free');
    expect(dbUser.subscriptionExpiresAt).toBeNull();
  });
});
