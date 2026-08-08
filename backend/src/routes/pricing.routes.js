// src/routes/pricing.routes.js
const express = require('express');
const router = express.Router();
const { getPricing } = require('../controllers/pricing.controller');

// Public — no auth, same visibility as the pricing page itself
router.get('/', getPricing);

module.exports = router;
