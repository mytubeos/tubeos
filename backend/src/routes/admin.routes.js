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

module.exports = router;
