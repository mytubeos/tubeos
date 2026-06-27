// src/routes/admin.routes.js
const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth.middleware');
const { adminProtect } = require('../middlewares/admin.middleware');
const {
  getCouponStats, listCoupons, createCoupon, updateCoupon, deleteCoupon,
} = require('../controllers/admin.controller');

// All admin routes require auth + admin role
router.use(protect, adminProtect);

router.get('/coupons/stats',  getCouponStats);
router.get('/coupons',        listCoupons);
router.post('/coupons',       createCoupon);
router.patch('/coupons/:id',  updateCoupon);
router.delete('/coupons/:id', deleteCoupon);

module.exports = router;
