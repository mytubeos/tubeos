const crypto = require('crypto');
const { GoogleAuth, OAuth2Client } = require('google-auth-library');
const User = require('../models/user.model');
const { PlayPurchase, PlayBillingAccount } = require('../models/play-purchase.model');
const { PACKAGE, playConfigured } = require('./billing-config');
const {
  failure,
  tokenHash,
  validateToken,
  encryptToken,
  decryptToken,
  subscriptionState,
} = require('./play-billing.rules');
const logger = require('../config/logger');

const publisherRequest = async (path, method = 'GET') => {
  const auth = new GoogleAuth({
    credentials: JSON.parse(process.env.PLAY_SERVICE_ACCOUNT_JSON),
    scopes: ['https://www.googleapis.com/auth/androidpublisher'],
  });
  const client = await auth.getClient();
  try {
    const result = await client.request({
      url: `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PACKAGE}/${path}`,
      method,
      timeout: 12000,
      retry: false,
      ...(method === 'POST' ? { data: {} } : {}),
    });
    return result.data;
  } catch {
    // Provider error objects contain the token in the request URL. Never log or
    // return them; return only an actionable bounded failure.
    throw failure(
      'Google Play verification is temporarily unavailable. Use Restore purchases to retry.',
      503
    );
  }
};

const withAccountLock = async (userId, action) => {
  const lockId = crypto.randomUUID();
  let account;
  try {
    account = await PlayBillingAccount.findOneAndUpdate(
      { _id: userId, $or: [{ lockUntil: null }, { lockUntil: { $lt: new Date() } }] },
      { $set: { lockId, lockUntil: new Date(Date.now() + 120000) } },
      { upsert: true, new: true }
    );
  } catch (err) {
    if (err.code === 11000)
      throw failure('Another payment update is running. Please retry shortly.', 409);
    throw err;
  }
  try {
    return await action(account);
  } finally {
    await PlayBillingAccount.updateOne(
      { _id: userId, lockId },
      { $unset: { lockId: 1, lockUntil: 1 } }
    );
  }
};

const verifyPurchase = async (userId, token, { background = false } = {}) => {
  if (!playConfigured()) throw failure('Google Play purchases are not available yet.', 503);
  validateToken(token);
  const hash = tokenHash(token);
  return withAccountLock(userId, async (account) => {
    const owned = await PlayPurchase.findById(hash);
    if (owned && String(owned.userId) !== String(userId))
      throw failure(
        'This purchase belongs to another Vezrin account. Sign in to that account.',
        409
      );
    const data = await publisherRequest(
      `purchases/subscriptionsv2/tokens/${encodeURIComponent(token)}`
    );
    const state = subscriptionState(data);
    // Keep license-test transactions out of production unless explicitly enabled.
    if (data.testPurchase && process.env.PLAY_ALLOW_TEST_PURCHASES !== 'true')
      throw failure('Test purchases are disabled on this server', 403);
    const linked = data.linkedPurchaseToken ? tokenHash(data.linkedPurchaseToken) : null;
    const prior = linked ? await PlayPurchase.findById(linked) : null;
    if (prior && String(prior.userId) !== String(userId))
      throw failure('The replaced subscription belongs to another Vezrin account.', 409);

    const result = await User.db.transaction(async (session) => {
      const user = await User.findById(userId).session(session);
      if (!user || !user.isActive || user.deletedAt || user.isBanned)
        throw failure('This account cannot receive a subscription.', 403);
      const existing = await PlayPurchase.findById(hash).session(session);
      if (existing && String(existing.userId) !== String(userId))
        throw failure('Purchase ownership mismatch', 409);
      // Do not replace a still-valid purchase from a different processor/token.
      // The client offers Restore/Manage rather than selling a second plan.
      const different = account.currentTokenHash && account.currentTokenHash !== hash;
      const replacesCurrent = linked === account.currentTokenHash;
      const paidElsewhere = user.plan !== 'free' && user.subscriptionProvider !== 'google-play';
      const hasPaidTime = user.subscriptionExpiresAt && user.subscriptionExpiresAt > new Date();
      const superseded = existing?.superseded || (different && !replacesCurrent && background);
      if (
        state.active &&
        !superseded &&
        hasPaidTime &&
        (paidElsewhere || (different && !replacesCurrent))
      )
        throw failure(
          'An existing paid plan is still active. Contact support before buying another plan.',
          409
        );

      await PlayPurchase.updateOne(
        { _id: hash },
        {
          $set: {
            productId: state.productId,
            state: state.state,
            expiresAt: state.expiry,
            autoRenewing: state.autoRenewing,
            orderId: state.orderId,
            checkedAt: new Date(),
          },
          $setOnInsert: { userId, encryptedToken: encryptToken(token) },
        },
        { upsert: true, session }
      );
      if (state.active && !superseded) {
        if (prior) await PlayPurchase.updateOne({ _id: linked }, { superseded: true }, { session });
        user.plan = state.plan;
        user.subscriptionProvider = 'google-play';
        user.subscriptionStartedAt = state.start;
        user.subscriptionExpiresAt = state.expiry;
        await PlayBillingAccount.updateOne(
          { _id: userId },
          { currentTokenHash: hash },
          { session }
        );
      } else if (account.currentTokenHash === hash && user.subscriptionProvider === 'google-play') {
        user.plan = 'free';
        user.subscriptionExpiresAt = state.expiry;
      }
      await user.save({ session });
      return {
        plan: user.plan,
        subscriptionExpiresAt: user.subscriptionExpiresAt,
        active: state.active && !superseded,
        state: state.state,
        autoRenewing: state.autoRenewing,
      };
    });
    // Acknowledge only after durable entitlement delivery. An API failure keeps
    // the token stored for restore/RTDN/background retry; never consume subscriptions.
    if (result.active && data.acknowledgementState === 'ACKNOWLEDGEMENT_STATE_PENDING') {
      await publisherRequest(
        `purchases/subscriptions/${encodeURIComponent(state.productId)}/tokens/${encodeURIComponent(token)}:acknowledge`,
        'POST'
      );
    }
    return result;
  });
};

const syncAccount = async (userId) => {
  const account = await PlayBillingAccount.findById(userId);
  if (!account?.currentTokenHash) return null;
  const purchase = await PlayPurchase.findById(account.currentTokenHash).select('+encryptedToken');
  if (!purchase) return null;
  return verifyPurchase(userId, decryptToken(purchase.encryptedToken), { background: true });
};

const handleNotification = async (authorization, body) => {
  if (!playConfigured()) throw failure('Billing notifications are not configured', 503);
  if (!/^Bearer \S+$/.test(authorization || ''))
    throw failure('Notification authentication required', 401);
  let claims;
  try {
    const ticket = await new OAuth2Client().verifyIdToken({
      idToken: authorization.slice(7),
      audience: process.env.PLAY_RTDN_AUDIENCE,
    });
    claims = ticket.getPayload();
  } catch {
    throw failure('Invalid notification identity', 401);
  }
  if (!claims?.email_verified || claims.email !== process.env.PLAY_RTDN_SERVICE_ACCOUNT_EMAIL)
    throw failure('Untrusted notification sender', 403);
  let notification;
  try {
    if (typeof body?.message?.data !== 'string' || body.message.data.length > 24000)
      throw new Error();
    notification = JSON.parse(Buffer.from(body.message.data, 'base64').toString('utf8'));
  } catch {
    throw failure('Invalid notification');
  }
  if (notification.packageName !== PACKAGE) throw failure('Incorrect notification package');
  if (notification.testNotification) return;
  const token =
    notification.subscriptionNotification?.purchaseToken ||
    notification.voidedPurchaseNotification?.purchaseToken;
  if (!token) return;
  validateToken(token);
  const purchase = await PlayPurchase.findById(tokenHash(token));
  // An unclaimed token never grants access through a notification. The signed-in
  // client must claim/restore it first. Retries use Google's current state, not
  // event order or untrusted notification fields.
  if (!purchase || !(await User.exists({ _id: purchase.userId, isActive: true, deletedAt: null })))
    return;
  await verifyPurchase(purchase.userId, token, { background: true });
};

const reconcile = async () => {
  if (!playConfigured()) return;
  // Cursor streams all accounts rather than repeatedly processing only the first page.
  for await (const account of PlayBillingAccount.find({
    currentTokenHash: { $exists: true },
  }).cursor()) {
    try {
      if (await User.exists({ _id: account._id, isActive: true, deletedAt: null }))
        await syncAccount(account._id);
    } catch {
      logger.warn('[play-billing] reconciliation needs retry', { userId: String(account._id) });
    }
  }
};
module.exports = { verifyPurchase, syncAccount, handleNotification, reconcile };
