// src/middlewares/auth.middleware.js
// JWT authentication middleware

const { verifyAccessToken } = require('../utils/jwt.utils');
const { errorResponse } = require('../utils/response.utils');
const User = require('../models/user.model');

// Protect route — verify JWT
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

    // 3. Find user
    const user = await User.findById(decoded.id).lean({ virtuals: true });
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
      const changedAt = parseInt(user.passwordChangedAt.getTime() / 1000, 10);
      if (decoded.iat < changedAt) {
        return errorResponse(res, 401, 'Password recently changed. Please login again.');
      }
    }

    // 7. Attach user to request
    req.user = user;
    next();
  } catch (err) {
    console.error('Auth middleware error:', err);
    return errorResponse(res, 500, 'Authentication error');
  }
};

// Plan access control
const requirePlan = (...plans) => {
  return (req, res, next) => {
    if (!req.user) {
      return errorResponse(res, 401, 'Authentication required');
    }

    if (!plans.includes(req.user.plan)) {
      return errorResponse(
        res,
        403,
        `This feature requires ${plans.join(' or ')} plan. Please upgrade.`,
        { requiredPlans: plans, currentPlan: req.user.plan }
      );
    }

    next();
  };
};

// Check usage limits
const checkUsageLimit = (type) => {
  return async (req, res, next) => {
    try {
      const user = await User.findById(req.user._id).lean({ virtuals: true });

      // Reset usage if month has passed
      const now = new Date();
      const resetDate = new Date(user.usage.usageResetDate);
      const monthPassed = now.getMonth() !== resetDate.getMonth() ||
        now.getFullYear() !== resetDate.getFullYear();

      if (monthPassed) {
        await User.findByIdAndUpdate(req.user._id, {
          'usage.aiRepliesUsed': 0,
          'usage.uploadsUsed': 0,
          'usage.usageResetDate': now,
        });
        user.usage.aiRepliesUsed = 0;
        user.usage.uploadsUsed = 0;
      }

      const limits = user.planLimits;

      if (type === 'aiReply') {
        if (limits.aiReplies !== -1 && user.usage.aiRepliesUsed >= limits.aiReplies) {
          return errorResponse(
            res,
            429,
            `Monthly AI reply limit reached (${limits.aiReplies}). Upgrade your plan for more.`,
            {
              used: user.usage.aiRepliesUsed,
              limit: limits.aiReplies,
              plan: user.plan,
            }
          );
        }
      }

      if (type === 'upload') {
        if (limits.uploads !== -1 && user.usage.uploadsUsed >= limits.uploads) {
          return errorResponse(
            res,
            429,
            `Monthly upload limit reached (${limits.uploads}). Upgrade your plan for more.`,
            {
              used: user.usage.uploadsUsed,
              limit: limits.uploads,
              plan: user.plan,
            }
          );
        }
      }

      next();
    } catch (err) {
      console.error('Usage limit check error:', err);
      next();
    }
  };
};

// Optional auth — attach user if token exists, don't fail if not
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);
    const user = await User.findById(decoded.id).lean({ virtuals: true });
    if (user) req.user = user;
    next();
  } catch {
    next(); // Don't fail, just proceed without user
  }
};

module.exports = {
  protect,
  requirePlan,
  checkUsageLimit,
  optionalAuth,
};
