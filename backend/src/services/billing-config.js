const PRODUCTS = Object.freeze({
  vezrin_creator_monthly: 'creator',
  vezrin_pro_monthly: 'pro',
  vezrin_max_monthly: 'agency',
});
const PACKAGE = 'com.vezrin.app';
const BASE_PLAN_ENV = Object.freeze({
  vezrin_creator_monthly: 'PLAY_BASE_PLAN_ID_CREATOR',
  vezrin_pro_monthly: 'PLAY_BASE_PLAN_ID_PRO',
  vezrin_max_monthly: 'PLAY_BASE_PLAN_ID_MAX',
});
const expectedBasePlanId = (productId) =>
  process.env[BASE_PLAN_ENV[productId]] || 'monthly';
const webOrigin = () => {
  try {
    const url = new URL(process.env.DODO_WEB_ORIGIN);
    const app = new URL(process.env.CLIENT_URL || 'https://vezrin.com');
    // Checkout must live outside the TWA host, including its path/query routes.
    if (url.protocol !== 'https:' || url.origin === app.origin || url.hostname === 'vezrin.com')
      return null;
    if (url.username || url.password || url.pathname !== '/' || url.search || url.hash) return null;
    return url.origin;
  } catch {
    return null;
  }
};
const playConfigured = () => {
  try {
    const credentials = JSON.parse(process.env.PLAY_SERVICE_ACCOUNT_JSON);
    return (
      /^[a-f0-9]{64}$/i.test(process.env.PLAY_TOKEN_ENCRYPTION_KEY || '') &&
      credentials.type === 'service_account' &&
      typeof credentials.client_email === 'string' &&
      typeof credentials.private_key === 'string' &&
      credentials.private_key.startsWith('-----BEGIN PRIVATE KEY-----') &&
      new URL(process.env.PLAY_RTDN_AUDIENCE).protocol === 'https:' &&
      !!process.env.PLAY_RTDN_SERVICE_ACCOUNT_EMAIL
    );
  } catch {
    return false;
  }
};
const playReady = () => process.env.PLAY_BILLING_ENABLED === 'true' && playConfigured();
const webReady = () =>
  process.env.DODO_WEB_ENABLED === 'true' &&
  !!webOrigin() &&
  process.env.DODO_REQUIRE_CHECKOUT_INTENT === 'true' &&
  !!process.env.DODO_PAYMENTS_API_KEY &&
  !!process.env.DODO_WEBHOOK_SECRET &&
  ['CREATOR', 'PRO', 'MAX'].every((p) => !!process.env[`DODO_PRODUCT_ID_${p}`]);
module.exports = { PRODUCTS, PACKAGE, expectedBasePlanId, webOrigin, webReady, playReady, playConfigured };
