// src/middlewares/auth.middleware.js
// FIXED: JWT authentication middleware with proper error handling
const { verifyAccessToken } = require('../utils/jwt.utils');
const { errorResponse } = require('../utils/response.utils');
const User = require('../models/user.model');
const logger = require('../config/logger');

// Protect route — verify JWT and attach user to request
const protect = async (req, res, next) => {
  try {
    // 1. Get token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return errorResponse(res, 401, 'Access token required. Please login.');
    }

    const token = authHeader.split(' ')[1];

    // 2. Verify token
    let decoded;
    try {
      decoded = verifyAccessToken(token);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return errorResponse(res, 401, 'Access token expired. Please refresh.');
      }
      return errorResponse(res, 401, 'Invalid access token. Please login.');
    }

    // 3. Find user and attach to request
    const user = await User.findById(decoded.id).lean();

    if (!user) {
      return errorResponse(res, 401, 'User no longer exists');
    }

    // 4. Check if user is banned
    if (user.isBanned) {
      return errorResponse(res, 403, 'Account has been suspended');
    }

    // 5. Check if user is active
    if (!user.isActive) {
      return errorResponse(res, 403, 'Account is deactivated');
    }

    // 6. Check if password changed after token was issued
    if (user.passwordChangedAt) {
      const changedTime = Math.floor(user.passwordChangedAt.getTime() / 1000);
      if (decoded.iat < changedTime) {
        return errorResponse(res, 401, 'Password recently changed. Please login again.');
      }
    }

    // 7. Attach user to request object (use .id, not ._id)
    req.user = {
      id: decoded.id,
      email: decoded.email,
      plan: decoded.plan,
    };

    next();
  } catch (err) {
    logger.error('[auth.middleware] Unexpected error', { error: err.message });
    return errorResponse(res, 500, 'Authentication error');
  }
};

// Optional authentication — doesn't fail if no token
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // No token provided - continue as guest
      return next();
    }

    const token = authHeader.split(' ')[1];

    try {
      const decoded = verifyAccessToken(token);
      const user = await User.findById(decoded.id).lean();

      if (user && user.isActive && !user.isBanned) {
        req.user = {
          id: decoded.id,
          email: decoded.email,
          plan: decoded.plan,
        };
      }
    } catch (err) {
      // Token invalid/expired - continue as guest
      logger.debug('[auth.middleware] Optional token invalid, continuing as guest');
    }

    next();
  } catch (err) {
    logger.error('[auth.middleware] Optional auth error', { error: err.message });
    next(); // Continue anyway
  }
};

// Check if user has specific plan or higher
const requirePlan = (requiredPlan) => {
  const planHierarchy = { free: 0, creator: 1, pro: 2, agency: 3 };

  return (req, res, next) => {
    if (!req.user) {
      return errorResponse(res, 401, 'Authentication required');
    }

    const userPlanLevel = planHierarchy[req.user.plan] || 0;
    const requiredLevel = planHierarchy[requiredPlan] || 0;

    if (userPlanLevel < requiredLevel) {
      return errorResponse(
        res,
        403,
        `This feature requires ${requiredPlan} plan or higher. Your current plan: ${req.user.plan}`
      );
    }

    next();
  };
};

// Check if user has exceeded usage limits based on plan
//   type: 'uploads' | 'aiReplies' | 'aiContent' | 'bulkReplies'
const checkUsageLimit = (limitType) => {
  // Legacy alias support
  const aliasMap = { upload: 'uploads', aireply: 'aiReplies', aicontent: 'aiContent' };
  const type = aliasMap[limitType?.toLowerCase()] || limitType;

  return async (req, res, next) => {
    try {
      if (!req.user) return errorResponse(res, 401, 'Authentication required');

      const user = await User.findById(req.user.id);
      if (!user) return errorResponse(res, 401, 'User not found');

      await user.resetMonthlyUsageIfNeeded();

      if (!user.hasUsageLeft(type)) {
        const stats = user.getUsageStats();
        const limit = stats[type]?.limit;
        return errorResponse(
          res,
          429,
          `Monthly ${type} limit reached (${limit}/month on ${user.plan} plan). Upgrade for more.`
        );
      }

      // Attach for downstream controllers/services
      req.usageType = type;
      next();
    } catch (err) {
      logger.error('[checkUsageLimit] error', { error: err.message });
      return errorResponse(res, 500, 'Usage check failed');
    }
  };
};

module.exports = {
  protect,
  optionalAuth,
  requirePlan,
  checkUsageLimit,
};
