import { describe, it, expect, vi } from 'vitest';
import { createRequire } from 'module';

// See tests/integration/auth.service.test.js for why createRequire is used
// instead of `import` for local project files under test.
const require = createRequire(import.meta.url);
const { protect, optionalAuth } = require('../../src/middlewares/auth.middleware.js');
const { generateTokenPair } = require('../../src/utils/jwt.utils.js');
const User = require('../../src/models/user.model.js');

const createReq = (token) => ({
  headers: { authorization: token ? `Bearer ${token}` : undefined },
});

const createRes = () => {
  const res = {};
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  return res;
};

const createUser = async (overrides = {}) => {
  return User.create({
    name: 'Creator',
    email: `creator-${Date.now()}-${Math.random()}@example.com`,
    password: 'password123',
    plan: 'free',
    ...overrides,
  });
};

describe('auth.middleware.protect — plan read freshness', () => {
  // Regression test: protect() already re-fetches the user from Mongo on
  // every request (to check isBanned/isActive/passwordChangedAt), but used
  // to throw that fresh document away and attach `decoded.plan` (the JWT's
  // plan claim, frozen at whichever moment the token was issued) to
  // req.user instead. requirePlan() reads req.user.plan, so any plan change
  // -- a real upgrade, an admin change, or the expired-subscription cron
  // job's own downgrade -- silently had zero effect on gated routes until
  // the access token happened to expire and get refreshed (up to its full
  // TTL later). Reproduced live: /auth/me showed the new plan instantly,
  // gated routes kept 403ing with the old one.
  it('attaches the current DB plan, not the plan embedded in the JWT at issue time', async () => {
    const user = await createUser({ plan: 'free' });
    const { accessToken } = generateTokenPair(user); // embeds plan: 'free'

    // Plan changes after the token was already issued.
    await User.findByIdAndUpdate(user._id, { plan: 'agency' });

    const req = createReq(accessToken);
    const res = createRes();
    const next = vi.fn();

    await protect(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
    expect(req.user.plan).toBe('agency');
  });

  it('still rejects a request with no token', async () => {
    const req = createReq(null);
    const res = createRes();
    const next = vi.fn();

    await protect(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });
});

describe('auth.middleware.optionalAuth — plan read freshness', () => {
  it('attaches the current DB plan too, not the stale JWT claim', async () => {
    const user = await createUser({ plan: 'free' });
    const { accessToken } = generateTokenPair(user);

    await User.findByIdAndUpdate(user._id, { plan: 'pro' });

    const req = createReq(accessToken);
    const res = createRes();
    const next = vi.fn();

    await optionalAuth(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(req.user.plan).toBe('pro');
  });

  it('continues as guest (no req.user) when no token is present', async () => {
    const req = createReq(null);
    const res = createRes();
    const next = vi.fn();

    await optionalAuth(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(req.user).toBeUndefined();
  });
});
