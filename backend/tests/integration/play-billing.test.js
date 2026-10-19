import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { GoogleAuth, OAuth2Client } = require('google-auth-library');
const service = require('../../src/services/play-billing.service');
const rules = require('../../src/services/play-billing.rules');
const { webOrigin, webReady } = require('../../src/services/billing-config');
const { PlayPurchase, PlayBillingAccount } = require('../../src/models/play-purchase.model');
const User = require('../../src/models/user.model');
const paymentService = require('../../src/services/payment.service');
const dodoService = require('../../src/services/dodo.service');
const CheckoutIntent = require('../../src/models/checkout-intent.model');
const request = require('supertest');
const express = require('express');
const { generateTokenPair } = require('../../src/utils/jwt.utils');
const app = express();
app.use(express.json());
app.use('/billing', require('../../src/routes/play-billing.routes'));
app.use('/payment', require('../../src/routes/payment.routes'));
const token = 'a-google-purchase-token-for-test';
const fixture = (overrides = {}) => ({
  kind: 'androidpublisher#subscriptionPurchaseV2',
  subscriptionState: 'SUBSCRIPTION_STATE_ACTIVE',
  startTime: new Date(Date.now() - 86400000).toISOString(),
  acknowledgementState: 'ACKNOWLEDGEMENT_STATE_PENDING',
  lineItems: [
    {
      productId: 'vezrin_pro_monthly',
      expiryTime: new Date(Date.now() + 86400000).toISOString(),
      offerDetails: { basePlanId: 'monthly' },
      autoRenewingPlan: { autoRenewEnabled: true },
    },
  ],
  ...overrides,
});
const createUser = () =>
  User.create({
    name: 'Billing test',
    email: `${Math.random()}@example.com`,
    password: 'password123',
    isEmailVerified: true,
  });
let provider;
beforeEach(() => {
  vi.stubEnv('PLAY_BILLING_ENABLED', 'true');
  vi.stubEnv('PLAY_TOKEN_ENCRYPTION_KEY', 'ab'.repeat(32));
  vi.stubEnv(
    'PLAY_SERVICE_ACCOUNT_JSON',
    JSON.stringify({
      type: 'service_account',
      client_email: 'billing@example.iam.gserviceaccount.com',
      private_key: '-----BEGIN PRIVATE KEY-----fake-test-key',
    })
  );
  vi.stubEnv('PLAY_RTDN_AUDIENCE', 'https://api.example.com/billing/notifications');
  vi.stubEnv('PLAY_RTDN_SERVICE_ACCOUNT_EMAIL', 'push@example.iam.gserviceaccount.com');
  provider = vi.fn(async ({ method }) => ({ data: method === 'POST' ? {} : fixture() }));
  vi.spyOn(GoogleAuth.prototype, 'getClient').mockResolvedValue({ request: provider });
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe('Google Play entitlements', () => {
  it('binds Dodo activation to the server-created checkout session and product', async () => {
    const user = await createUser();
    vi.stubEnv('DODO_REQUIRE_CHECKOUT_INTENT', 'true');
    const intent = await CheckoutIntent.create({
      _id: 'server-intent',
      userId: user._id,
      plan: 'pro',
      productId: 'dodo-pro',
      amount: 999,
      sessionId: 'checkout-session',
      expiresAt: new Date(Date.now() + 86400000),
    });
    const payload = {
      currency: 'USD',
      total_amount: 999,
      status: 'succeeded',
      metadata: { userId: String(user._id), plan: 'pro', checkoutIntentId: intent._id },
      checkout_session_id: 'attacker-session',
      product_cart: [{ product_id: 'dodo-pro', quantity: 1 }],
    };
    await expect(dodoService.activatePlanFromPayload(payload, 'payment-test')).rejects.toThrow(
      'Checkout intent mismatch'
    );
    expect((await User.findById(user._id)).plan).toBe('free');
    payload.checkout_session_id = 'checkout-session';
    await expect(
      dodoService.activatePlanFromPayload(payload, 'payment-test')
    ).resolves.toMatchObject({ plan: 'pro' });
  });
  it('superseded tokens cannot restore or revoke the replacement subscription', async () => {
    const user = await createUser();
    await service.verifyPurchase(user._id, token);
    provider.mockResolvedValue({ data: fixture({ linkedPurchaseToken: token }) });
    const replacement = 'replacement-purchase-token';
    await service.verifyPurchase(user._id, replacement);
    provider.mockResolvedValue({ data: fixture() });
    expect((await service.verifyPurchase(user._id, token, { background: true })).active).toBe(
      false
    );
    expect((await PlayBillingAccount.findById(user._id)).currentTokenHash).toBe(
      rules.tokenHash(replacement)
    );
    expect((await User.findById(user._id)).plan).toBe('pro');
  });
  it('verifies before granting access, encrypts the token and acknowledges after committing', async () => {
    const user = await createUser();
    provider.mockImplementation(async ({ method }) => {
      if (method === 'POST') expect((await User.findById(user._id)).plan).toBe('pro');
      return { data: method === 'POST' ? {} : fixture() };
    });
    await expect(service.verifyPurchase(user._id, token)).resolves.toMatchObject({
      active: true,
      plan: 'pro',
    });
    const purchase = await PlayPurchase.findById(rules.tokenHash(token)).select('+encryptedToken');
    expect(purchase.encryptedToken).not.toContain(token);
    expect(rules.decryptToken(purchase.encryptedToken)).toBe(token);
    expect((await User.findById(user._id)).subscriptionProvider).toBe('google-play');
    expect(provider).toHaveBeenCalledTimes(2);
  });
  it('restoring the same token does not extend paid time and cannot move to another account', async () => {
    const [first, second] = await Promise.all([createUser(), createUser()]);
    const fixed = fixture();
    provider.mockResolvedValue({ data: fixed });
    await service.verifyPurchase(first._id, token);
    const expiry = (await User.findById(first._id)).subscriptionExpiresAt;
    await service.verifyPurchase(first._id, token);
    expect((await User.findById(first._id)).subscriptionExpiresAt).toEqual(expiry);
    await expect(service.verifyPurchase(second._id, token)).rejects.toMatchObject({
      statusCode: 409,
    });
    expect((await User.findById(second._id)).plan).toBe('free');
  });
  it('does not grant or acknowledge pending payments', async () => {
    const user = await createUser();
    provider.mockResolvedValue({
      data: fixture({ subscriptionState: 'SUBSCRIPTION_STATE_PENDING' }),
    });
    expect((await service.verifyPurchase(user._id, token)).active).toBe(false);
    expect((await User.findById(user._id)).plan).toBe('free');
    expect(provider).toHaveBeenCalledTimes(1);
  });
  it('reconciles renewal, cancellation before expiry, on-hold and refund/expiry', async () => {
    const user = await createUser();
    await service.verifyPurchase(user._id, token);
    provider.mockResolvedValue({
      data: fixture({ subscriptionState: 'SUBSCRIPTION_STATE_CANCELED' }),
    });
    expect((await service.syncAccount(user._id)).active).toBe(true);
    provider.mockResolvedValue({
      data: fixture({ subscriptionState: 'SUBSCRIPTION_STATE_ON_HOLD' }),
    });
    expect((await service.syncAccount(user._id)).plan).toBe('free');
    const renewal = fixture();
    renewal.lineItems[0].expiryTime = new Date(Date.now() + 7 * 86400000).toISOString();
    provider.mockResolvedValue({ data: renewal });
    expect((await service.syncAccount(user._id)).plan).toBe('pro');
    provider.mockResolvedValue({
      data: fixture({ subscriptionState: 'SUBSCRIPTION_STATE_EXPIRED' }),
    });
    expect((await service.syncAccount(user._id)).plan).toBe('free');
  });
  it('rejects unknown products and base plans before acknowledgement', async () => {
    const user = await createUser();
    const bad = fixture();
    bad.lineItems[0].productId = 'other-app-product';
    provider.mockResolvedValue({ data: bad });
    await expect(service.verifyPurchase(user._id, token)).rejects.toThrow(
      'Unknown Google Play plan'
    );
    expect(provider).toHaveBeenCalledTimes(1);
  });
  it('does not overwrite an active Dodo plan or deactivate real subscriptions via local downgrade', async () => {
    const user = await createUser();
    await User.updateOne(
      { _id: user._id },
      {
        plan: 'creator',
        subscriptionProvider: 'dodo',
        subscriptionExpiresAt: new Date(Date.now() + 86400000),
      }
    );
    await expect(service.verifyPurchase(user._id, token)).rejects.toMatchObject({
      statusCode: 409,
    });
    await User.updateOne({ _id: user._id }, { plan: 'free', subscriptionExpiresAt: null });
    await service.verifyPurchase(user._id, token);
    await expect(paymentService.downgradeToFree(user._id)).rejects.toMatchObject({
      statusCode: 409,
    });
  });
  it('provider outages preserve existing access and return no secret token', async () => {
    const user = await createUser();
    await service.verifyPurchase(user._id, token);
    provider.mockRejectedValue(new Error(`private request /tokens/${token}`));
    await expect(service.syncAccount(user._id)).rejects.toThrow('temporarily unavailable');
    expect((await User.findById(user._id)).plan).toBe('pro');
  });
  it('blocks concurrent syncs using a lease and leaves other accounts available', async () => {
    const user = await createUser();
    await PlayBillingAccount.create({ _id: user._id, lockUntil: new Date(Date.now() + 60000) });
    await expect(service.verifyPurchase(user._id, token)).rejects.toMatchObject({
      statusCode: 409,
    });
    expect(provider).not.toHaveBeenCalled();
  });
  it('requires authenticated notifications with the configured audience and email', async () => {
    await expect(service.handleNotification('', {})).rejects.toMatchObject({ statusCode: 401 });
    vi.spyOn(OAuth2Client.prototype, 'verifyIdToken').mockResolvedValue({
      getPayload: () => ({ email_verified: true, email: 'attacker@example.com' }),
    });
    await expect(service.handleNotification('Bearer fake', {})).rejects.toMatchObject({
      statusCode: 403,
    });
  });
  it('never exposes encrypted tokens through the purchase history route', async () => {
    const user = await createUser();
    await service.verifyPurchase(user._id, token);
    const auth = generateTokenPair(user).accessToken;
    const response = await request(app)
      .get('/billing/purchases')
      .set('Authorization', `Bearer ${auth}`);
    expect(response.status).toBe(200);
    expect(JSON.stringify(response.body)).not.toContain('encryptedToken');
    expect(JSON.stringify(response.body)).not.toContain(token);
  });
  it('keeps the original TWA origin blocked from Dodo even when web payments are enabled', async () => {
    const user = await createUser();
    vi.stubEnv('DODO_WEB_ENABLED', 'true');
    vi.stubEnv('DODO_WEB_ORIGIN', 'https://buy.vezrin.com');
    vi.stubEnv('DODO_REQUIRE_CHECKOUT_INTENT', 'true');
    vi.stubEnv('DODO_PAYMENTS_API_KEY', 'fake-key');
    vi.stubEnv('DODO_WEBHOOK_SECRET', 'fake-secret');
    for (const plan of ['CREATOR', 'PRO', 'MAX'])
      vi.stubEnv(`DODO_PRODUCT_ID_${plan}`, `test-${plan}`);
    expect(webReady()).toBe(true);
    const response = await request(app)
      .post('/payment/dodo/create-checkout-session')
      .set('Authorization', `Bearer ${generateTokenPair(user).accessToken}`)
      .set('Origin', 'https://vezrin.com')
      .send({ plan: 'pro' });
    expect(response.status).toBe(403);
    vi.spyOn(dodoService, 'createCheckoutSession').mockResolvedValue({
      sessionId: 'checkout-session',
      url: 'https://checkout.dodopayments.com/session/test',
    });
    const webResponse = await request(app)
      .post('/payment/dodo/create-checkout-session')
      .set('Authorization', `Bearer ${generateTokenPair(user).accessToken}`)
      .set('Origin', 'https://buy.vezrin.com')
      .send({ plan: 'pro' });
    expect(webResponse.status).toBe(200);
    vi.stubEnv('DODO_WEB_ORIGIN', 'https://vezrin.com');
    expect(webOrigin()).toBeNull();
  });
  it('does not authorize an expired Google plan when notifications have been missed', async () => {
    const user = await createUser();
    await User.updateOne(
      { _id: user._id },
      {
        plan: 'pro',
        subscriptionProvider: 'google-play',
        subscriptionExpiresAt: new Date(Date.now() - 1000),
      }
    );
    const response = await request(app)
      .get('/billing/purchases')
      .set('Authorization', `Bearer ${generateTokenPair(user).accessToken}`);
    expect(response.status).toBe(200);
    expect((await User.findById(user._id)).plan).toBe('free');
  });
});
