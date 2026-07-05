// src/routes/referral.routes.js
const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth.middleware');
const {
  getStats,
  getEarnings,
  getReferredUsers,
  createPayout,
  getPayouts,
} = require('../controllers/referral.controller');

router.use(protect);

router.get('/stats', getStats);
router.get('/earnings', getEarnings);
router.get('/referrals', getReferredUsers);
router.get('/payouts', getPayouts);
router.post('/payout', createPayout);

module.exports = router;
