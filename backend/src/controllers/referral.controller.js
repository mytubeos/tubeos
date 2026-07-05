// src/controllers/referral.controller.js
const referralService = require('../services/referral.service');
const { successResponse, errorResponse, paginatedResponse } = require('../utils/response.utils');

const getStats = async (req, res) => {
  try {
    const stats = await referralService.getStats(req.user.id);
    return successResponse(res, 200, 'Referral stats', stats);
  } catch (err) {
    return errorResponse(res, err.statusCode || 500, err.message);
  }
};

const getEarnings = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const result = await referralService.listEarnings(req.user.id, {
      page: parseInt(page),
      limit: parseInt(limit),
    });
    return paginatedResponse(res, 200, 'Earnings fetched', result.earnings, result.pagination);
  } catch (err) {
    return errorResponse(res, err.statusCode || 500, err.message);
  }
};

const getReferredUsers = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const result = await referralService.listReferredUsers(req.user.id, {
      page: parseInt(page),
      limit: parseInt(limit),
    });
    return paginatedResponse(res, 200, 'Referred users', result.users, result.pagination);
  } catch (err) {
    return errorResponse(res, err.statusCode || 500, err.message);
  }
};

const createPayout = async (req, res) => {
  try {
    const { amount, method, upi, bankAccount } = req.body;
    const result = await referralService.requestPayout(req.user.id, {
      amount: parseInt(amount),
      method,
      upi,
      bankAccount,
    });
    return successResponse(res, 201, result.message, result.payout);
  } catch (err) {
    return errorResponse(res, err.statusCode || 500, err.message);
  }
};

const getPayouts = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const result = await referralService.listPayouts(req.user.id, {
      page: parseInt(page),
      limit: parseInt(limit),
    });
    return paginatedResponse(res, 200, 'Payouts fetched', result.payouts, result.pagination);
  } catch (err) {
    return errorResponse(res, err.statusCode || 500, err.message);
  }
};

module.exports = { getStats, getEarnings, getReferredUsers, createPayout, getPayouts };
