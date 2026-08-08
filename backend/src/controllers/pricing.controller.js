// src/controllers/pricing.controller.js
const pricingService = require('../services/pricing.service');
const { successResponse, errorResponse } = require('../utils/response.utils');

// GET /api/v1/pricing — public, same visibility as the pricing page itself
const getPricing = async (req, res) => {
  try {
    const prices = await pricingService.getAllPrices();
    return successResponse(res, 200, 'Pricing fetched', prices);
  } catch (err) {
    return errorResponse(res, err.statusCode || 500, err.message);
  }
};

module.exports = { getPricing };
