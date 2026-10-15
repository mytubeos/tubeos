const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth.middleware');
const controller = require('../controllers/payment.controller');
router.post('/dodo/webhook', controller.dodoWebhook);
// Purchases are paused for every client while Play-compliant billing is prepared.
// Keep webhooks/history working for existing purchases; do not gate by reviewer,
// user agent or account. Old installed clients must not bypass the pause.
router.post('/dodo/create-checkout-session', protect, (_req, res) =>
  res.status(403).json({
    success: false,
    message: 'New purchases are temporarily unavailable. Existing plan access is unchanged.',
  })
);
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
