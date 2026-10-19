const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth.middleware');
const controller = require('../controllers/payment.controller');
router.post('/dodo/webhook', controller.dodoWebhook);
// Only the separate web storefront may start Dodo checkout. The TWA host never
// links to that storefront, even when DGAPI is unavailable. Origin is a browser
// channel boundary, not an authentication mechanism; protect remains mandatory.
router.post('/dodo/create-checkout-session', protect, (req, res, next) => {
  const { webReady, webOrigin } = require('../services/billing-config');
  if (webReady() && req.headers.origin === webOrigin())
    return controller.createDodoCheckoutSession(req, res, next);
  return res.status(403).json({
    success: false,
    message: 'New purchases are temporarily unavailable. Existing plan access is unchanged.',
  });
});
router.get('/history', protect, controller.getPaymentHistory);
router.post('/downgrade', protect, controller.downgradeToFree);
// Explicit retirement prevents old clients from activating plans via legacy processors.
for (const path of [
  '/webhook',
  '/create-order',
  '/verify',
  '/validate-coupon',
  '/stripe/webhook',
  '/stripe/create-checkout-session',
  '/stripe/verify-session',
]) {
  router.post(path, (_req, res) =>
    res.status(410).json({
      success: false,
      message: 'This payment method has been retired. New purchases are temporarily unavailable.',
    })
  );
}
module.exports = router;
