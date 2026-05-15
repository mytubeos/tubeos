// src/middlewares/auth.middleware.js
// FIXED: JWT authentication middleware with proper error handling
const { verifyAccessToken } = require('../utils/jwt.utils');
const { errorResponse } = require('../utils/response.utils');
const User = require('../models/user.model');

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
    console.error('[auth.middleware] Unexpected error:', err.message);
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
      console.log('[auth.middleware] Optional token invalid, continuing as guest');
    }

    next();
  } catch (err) {
    console.error('[auth.middleware] Optional auth error:', err.message);
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

module.exports = {
  protect,
  optionalAuth,
  requirePlan,
};
