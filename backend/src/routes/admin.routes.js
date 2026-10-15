// src/routes/admin.routes.js
const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth.middleware');
const { adminProtect } = require('../middlewares/admin.middleware');
const {
  getUserStats,
  listUsers,
  changeUserPlan,
  toggleBanUser,
  toggleDeleteUser,
  getCouponStats,
  listCoupons,
  createCoupon,
  updateCoupon,
  deleteCoupon,
  getPricing,
  updatePricing,
  getLimits,
  updateLimits,
  getReportSettings,
  updateReportSettings,
  sendTestReport,
} = require('../controllers/admin.controller');

router.use(protect, adminProtect);

// Users
router.get('/users/stats', getUserStats);
router.get('/users', listUsers);
router.patch('/users/:id/plan', changeUserPlan);
router.patch('/users/:id/ban', toggleBanUser);
router.patch('/users/:id/delete', toggleDeleteUser);

// Coupons
router.get('/coupons/stats', getCouponStats);
router.get('/coupons', listCoupons);
router.post('/coupons', createCoupon);
router.patch('/coupons/:id', updateCoupon);
router.delete('/coupons/:id', deleteCoupon);

// Pricing
router.get('/pricing', getPricing);
router.put('/pricing/:plan', updatePricing);

// Plan feature limits
router.get('/limits', getLimits);
router.put('/limits/:plan', updateLimits);

// Weekly/monthly report email schedule + sender
router.get('/report-settings', getReportSettings);
router.put('/report-settings', updateReportSettings);
router.post('/report-settings/test-send', sendTestReport);

// Reports are visible to real admins only. Never include them in public analytics.
router.get('/content-reports', async (_req, res) => {
  try {
    const reports = await require('../models/content-report.model')
      .find({ status: 'open' })
      .sort({ createdAt: 1 })
      .limit(100)
      .lean();
    return res.json({ success: true, data: reports });
  } catch {
    return res.status(503).json({ success: false, message: 'Reports could not be loaded' });
  }
});
router.patch('/content-reports/:id', async (req, res) => {
  if (!['open', 'reviewed'].includes(req.body.status))
    return res.status(400).json({ success: false, message: 'Invalid status' });
  try {
    const report = await require('../models/content-report.model').findByIdAndUpdate(
      req.params.id,
      { status: req.body.status },
      { new: true }
    );
    return res.status(report ? 200 : 404).json({ success: !!report, data: report });
  } catch {
    return res.status(400).json({ success: false, message: 'Invalid report' });
  }
});
module.exports = router;
