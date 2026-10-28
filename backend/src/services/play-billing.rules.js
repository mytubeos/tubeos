const crypto = require('crypto');
const { PRODUCTS, expectedBasePlanId } = require('./billing-config');
const failure = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });
const tokenHash = (token) => crypto.createHash('sha256').update(token).digest('hex');
const validateToken = (token) => {
  if (typeof token !== 'string' || token.length < 10 || token.length > 4096 || /\s/.test(token))
    throw failure('Invalid purchase token');
};
const encryptionKey = () => {
  if (!/^[a-f0-9]{64}$/i.test(process.env.PLAY_TOKEN_ENCRYPTION_KEY || ''))
    throw failure('Purchase verification is not configured', 503);
  return Buffer.from(process.env.PLAY_TOKEN_ENCRYPTION_KEY, 'hex');
};
const encryptToken = (token) => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const body = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), body].map((v) => v.toString('base64url')).join('.');
};
const decryptToken = (stored) => {
  const [iv, tag, body] = stored.split('.').map((v) => Buffer.from(v, 'base64url'));
  const cipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), iv);
  cipher.setAuthTag(tag);
  return Buffer.concat([cipher.update(body), cipher.final()]).toString('utf8');
};
const subscriptionState = (data, now = new Date()) => {
  // One monthly base plan per product. Multiple offers/base plans are deliberately
  // unsupported by our first release because DGAPI exposes only the first offer.
  if (data.kind !== 'androidpublisher#subscriptionPurchaseV2' || data.lineItems?.length !== 1)
    throw failure('Unsupported Google Play subscription');
  const line = data.lineItems[0];
  if (!PRODUCTS[line.productId] || line.offerDetails?.basePlanId !== expectedBasePlanId(line.productId))
    throw failure('Unknown Google Play plan');
  const expiry = new Date(line.expiryTime);
  const start = new Date(data.startTime);
  const eligible = [
    'SUBSCRIPTION_STATE_ACTIVE',
    'SUBSCRIPTION_STATE_IN_GRACE_PERIOD',
    'SUBSCRIPTION_STATE_CANCELED',
  ].includes(data.subscriptionState);
  const active = eligible && Number.isFinite(expiry.getTime()) && expiry > now;
  if (active && !Number.isFinite(start.getTime())) throw failure('Invalid subscription start time');
  if (data.subscriptionState === 'SUBSCRIPTION_STATE_UNSPECIFIED' || !data.subscriptionState)
    throw failure('Subscription state is unavailable');
  return {
    plan: PRODUCTS[line.productId],
    productId: line.productId,
    active,
    state: data.subscriptionState,
    expiry: Number.isFinite(expiry.getTime()) ? expiry : null,
    start: Number.isFinite(start.getTime()) ? start : null,
    autoRenewing: line.autoRenewingPlan?.autoRenewEnabled === true,
    orderId: line.latestSuccessfulOrderId || data.latestOrderId || null,
  };
};
module.exports = {
  failure,
  tokenHash,
  validateToken,
  encryptToken,
  decryptToken,
  subscriptionState,
};
