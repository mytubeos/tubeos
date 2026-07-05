// src/middlewares/admin.middleware.js
const User = require('../models/user.model');
const { errorResponse } = require('../utils/response.utils');
const logger = require('../config/logger');

const adminProtect = async (req, res, next) => {
  try {
    if (!req.user) return errorResponse(res, 401, 'Authentication required');

    const user = await User.findById(req.user.id).select('+isAdmin');
    if (!user || !user.isAdmin) {
      return errorResponse(res, 403, 'Admin access required');
    }

    next();
  } catch (err) {
    logger.error('[admin.middleware] Authorization error', { error: err.message });
    return errorResponse(res, 500, 'Authorization error');
  }
};

module.exports = { adminProtect };
