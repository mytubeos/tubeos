const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth.middleware');
const controller = require('../controllers/payment.controller');
router.post('/dodo/webhook', controller.dodoWebhook);
router.post('/dodo/create-checkout-session', protect, controller.createDodoCheckoutSession);
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
      message: 'This payment method has been retired. Please use Dodo checkout.',
    })
  );
}
module.exports = router;
