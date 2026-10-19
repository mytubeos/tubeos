const router = require('express').Router();
const { rateLimit } = require('express-rate-limit');
const { protect } = require('../middlewares/auth.middleware');
const { successResponse, errorResponse } = require('../utils/response.utils');
const service = require('../services/play-billing.service');
const { PRODUCTS, PACKAGE, playReady, webReady, webOrigin } = require('../services/billing-config');
const limit = rateLimit({
  windowMs: 60000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
});
router.get('/config', (_req, res) => {
  res.set('Cache-Control', 'no-store');
  return successResponse(res, 200, 'Billing availability', {
    playEnabled: !!playReady(),
    webEnabled: !!webReady(),
    webOrigin: webOrigin(),
    packageName: PACKAGE,
    products: Object.entries(PRODUCTS).map(([productId, plan]) => ({ productId, plan })),
  });
});
const endpoint = (action) => async (req, res) => {
  try {
    return successResponse(res, 200, 'Purchase status verified', await action(req));
  } catch (err) {
    // No provider messages, tokens, request URLs or stack traces in responses.
    return errorResponse(
      res,
      err.statusCode || 503,
      err.statusCode
        ? err.message
        : 'Payment verification needs retry. Please use Restore purchases.'
    );
  }
};
router.post(
  '/verify',
  protect,
  limit,
  endpoint((req) => service.verifyPurchase(req.user.id, req.body.purchaseToken))
);
router.get(
  '/purchases',
  protect,
  endpoint(async (req) => {
    const { PlayPurchase } = require('../models/play-purchase.model');
    return PlayPurchase.find({ userId: req.user.id })
      .select('productId state expiresAt autoRenewing orderId')
      .sort({ updatedAt: -1 })
      .limit(20)
      .lean();
  })
);
router.post(
  '/sync',
  protect,
  limit,
  endpoint((req) => service.syncAccount(req.user.id))
);
router.post(
  '/notifications',
  endpoint((req) => service.handleNotification(req.headers.authorization, req.body))
);
module.exports = router;
