// @ts-check
// src/services/dodo-discount.service.js
//
// Admin-facing coupon CRUD, backed entirely by Dodo Payments' own native
// Discount API (docs.dodopayments.com/features/discount-codes) — codes
// created here are enforced by Dodo itself, entered by the customer
// directly on Dodo's hosted checkout page. Nothing is validated or tracked
// locally anymore; Dodo is the single source of truth.
//
// Replaces the old local-Mongo Coupon system for the live checkout path.
// coupon.model.js/coupon.service.js are deliberately left untouched —
// payment.service.js (Razorpay) and stripe.service.js, both orphaned but
// kept in case of a future gateway migration, still import from them.
//
// Two things Dodo has no native concept of are round-tripped through its
// own `metadata` object (which Dodo stores and echoes back verbatim):
//   - coupon "type" (internal/public) and an admin-facing description
//   - a real on/off toggle — Dodo only has expires_at/starts_at, no direct
//     boolean. "Deactivate" stashes the coupon's actual intended expiry (if
//     any) in metadata and force-expires it (sets expires_at a minute in
//     the past); "reactivate" restores that stashed value. isActive is
//     always derived from that pair, never trusted from raw expires_at.

const { config } = require('../config/env');
const { getDodoClient, notConfiguredError } = require('./dodo.service');
const logger = require('../config/logger');

const ALL_PLANS = ['creator', 'pro', 'agency'];

const planToProductId = () => ({
  creator: config.dodo.productIds.creator,
  pro: config.dodo.productIds.pro,
  agency: config.dodo.productIds.agency,
});

const productIdToPlan = () => {
  const map = {};
  for (const [plan, id] of Object.entries(planToProductId())) {
    if (id) map[id] = plan;
  }
  return map;
};

// Dodo's own Discount object -> the shape AdminCoupons.jsx already expects
// (same field names the old local Coupon model used).
const toVezrinShape = (d) => {
  const meta = d.metadata || {};
  const deactivatedAt = meta.vezrinDeactivatedAt || '';
  const realExpiresAt = meta.vezrinRealExpiresAt || null;
  const isActive = !deactivatedAt && (!realExpiresAt || new Date(realExpiresAt) > new Date());

  return {
    _id: d.discount_id,
    code: d.code,
    type: meta.vezrinType === 'internal' ? 'internal' : 'public',
    discountType: 'percent', // the only type Dodo-native coupons support here — see createCoupon
    discountValue: Math.round((d.amount || 0) / 100), // basis points -> whole percent
    validPlans:
      d.restricted_to && d.restricted_to.length
        ? d.restricted_to.map((pid) => productIdToPlan()[pid]).filter(Boolean)
        : ALL_PLANS, // Dodo's own "no restriction" = applies to every product
    maxUses: d.usage_limit ?? null,
    usedCount: d.times_used || 0,
    isActive,
    expiresAt: realExpiresAt,
    description: meta.vezrinDescription || '',
    createdAt: d.created_at,
  };
};

// Builds the Dodo request body shared by create/update, from a Vezrin-shaped
// (partial, already-merged-with-current-for-update) coupon.
const toDodoBody = (c) => {
  const plans = c.validPlans && c.validPlans.length ? c.validPlans : ALL_PLANS;
  const restricted = plans.length < ALL_PLANS.length;
  const productIds = plans.map((p) => planToProductId()[p]).filter(Boolean);

  const deactivated = c.isActive === false;
  const realExpiresAt = c.expiresAt || null;

  return {
    type: 'percentage',
    amount: Math.round(Number(c.discountValue) * 100),
    restricted_to: restricted ? productIds : undefined,
    usage_limit: c.maxUses ? Number(c.maxUses) : null,
    expires_at: deactivated ? new Date(Date.now() - 60 * 1000).toISOString() : realExpiresAt,
    metadata: {
      vezrinType: c.type === 'internal' ? 'internal' : 'public',
      vezrinDescription: c.description || '',
      vezrinRealExpiresAt: realExpiresAt || '',
      vezrinDeactivatedAt: deactivated ? new Date().toISOString() : '',
    },
  };
};

const wrapDodoError = (err, fallbackMessage) => {
  logger.error('[dodo-discount] request failed', { error: err.response?.data || err.message });
  const wrapped = new Error(err.response?.data?.message || fallbackMessage);
  wrapped.statusCode =
    err.response?.status && err.response.status < 500 ? err.response.status : 500;
  return wrapped;
};

// ==================== ADMIN CRUD ====================

/**
 * @param {{page?: number, limit?: number, type?: string, status?: string, search?: string}} [opts]
 */
const listCoupons = async ({ page = 1, limit = 20, type, status, search } = {}) => {
  const client = getDodoClient();
  if (!client) throw notConfiguredError();

  const params = { page_size: 100, page_number: 0 };
  if (search) params.code = search;

  const { data } = await client.get('/discounts', { params }).catch((err) => {
    throw wrapDodoError(err, 'Could not load discount codes');
  });

  let items = (data.items || []).map(toVezrinShape);

  if (type && ['internal', 'public'].includes(type)) {
    items = items.filter((c) => c.type === type);
  }
  if (status === 'active') items = items.filter((c) => c.isActive);
  if (status === 'inactive') items = items.filter((c) => !c.isActive);

  const total = items.length;
  const start = (page - 1) * limit;
  const coupons = items.slice(start, start + limit);

  return { coupons, total, page, limit };
};

const createCoupon = async (data) => {
  const client = getDodoClient();
  if (!client) throw notConfiguredError();

  const { code, discountValue, validPlans, maxUses, expiresAt, description, isActive, type } = data;

  if (!code || !discountValue) {
    const err = new Error('Code and discountValue are required');
    err.statusCode = 400;
    throw err;
  }
  if (Number(discountValue) < 1 || Number(discountValue) > 100) {
    const err = new Error('Discount percent must be between 1 and 100');
    err.statusCode = 400;
    throw err;
  }

  const body = {
    code: code.toUpperCase().trim(),
    ...toDodoBody({ discountValue, validPlans, maxUses, expiresAt, description, isActive, type }),
  };

  const { data: created } = await client.post('/discounts', body).catch((err) => {
    throw wrapDodoError(err, 'Could not create discount code');
  });

  return toVezrinShape(created);
};

const updateCoupon = async (id, data) => {
  const client = getDodoClient();
  if (!client) throw notConfiguredError();

  const { data: current } = await client.get(`/discounts/${id}`).catch((err) => {
    if (err.response?.status === 404) {
      const e = new Error('Coupon not found');
      e.statusCode = 404;
      throw e;
    }
    throw wrapDodoError(err, 'Could not load discount code');
  });

  const merged = { ...toVezrinShape(current), ...data };
  const body = toDodoBody(merged);
  if (data.code) body.code = data.code.toUpperCase().trim();

  const { data: updated } = await client.patch(`/discounts/${id}`, body).catch((err) => {
    throw wrapDodoError(err, 'Could not update discount code');
  });

  return toVezrinShape(updated);
};

const deleteCoupon = async (id) => {
  const client = getDodoClient();
  if (!client) throw notConfiguredError();

  await client.delete(`/discounts/${id}`).catch((err) => {
    if (err.response?.status === 404) {
      const e = new Error('Coupon not found');
      e.statusCode = 404;
      throw e;
    }
    throw wrapDodoError(err, 'Could not delete discount code');
  });
};

const getStats = async () => {
  const client = getDodoClient();
  if (!client) throw notConfiguredError();

  const { data } = await client
    .get('/discounts', { params: { page_size: 100, page_number: 0 } })
    .catch((err) => {
      throw wrapDodoError(err, 'Could not load discount stats');
    });

  const items = (data.items || []).map(toVezrinShape);
  const active = items.filter((c) => c.isActive).length;
  const internal = items.filter((c) => c.type === 'internal').length;
  const totalUses = items.reduce((sum, c) => sum + (c.usedCount || 0), 0);

  return {
    total: items.length,
    active,
    inactive: items.length - active,
    internal,
    public: items.length - internal,
    totalUses,
  };
};

module.exports = {
  listCoupons,
  createCoupon,
  updateCoupon,
  deleteCoupon,
  getStats,
};
