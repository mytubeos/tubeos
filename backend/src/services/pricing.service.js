// src/services/pricing.service.js
//
// Single source of truth for what every plan costs, in every currency.
// Admin-editable (see admin.controller.js's pricing endpoints) — nothing in
// this file's own logic is a business decision, the numbers below are only
// a starting point so the app never shows a broken/zero price before an
// admin has touched anything.
const PlanPrice = require('../models/plan-price.model');

const PLANS = ['creator', 'pro', 'agency'];
const CURRENCIES = ['INR', 'EUR', 'USD'];

// Checkout-modal/session display name — not currency- or admin-editable,
// just static product copy. Both payment.service.js (Razorpay) and
// stripe.service.js read this so the two gateways stay consistent.
const PLAN_LABELS = {
  creator: 'Creator Plan',
  pro: 'Pro Plan',
  agency: 'Max Plan',
};

// Smallest currency unit (paise / cents). INR values match the real,
// already-live founders-offer pricing. EUR/USD are placeholder round
// numbers, not a researched conversion — the whole point of this feature
// is that the founder sets the real ones from the admin panel.
const DEFAULT_PRICES = {
  creator: {
    INR: { amount: 19900, regularAmount: 39900 },
    EUR: { amount: 499, regularAmount: 999 },
    USD: { amount: 499, regularAmount: 999 },
  },
  pro: {
    INR: { amount: 49900, regularAmount: 89900 },
    EUR: { amount: 999, regularAmount: 1799 },
    USD: { amount: 999, regularAmount: 1799 },
  },
  agency: {
    INR: { amount: 299900, regularAmount: 599900 },
    EUR: { amount: 3999, regularAmount: 7999 },
    USD: { amount: 3999, regularAmount: 7999 },
  },
};

const assertKnownPlan = (plan) => {
  if (!PLANS.includes(plan)) {
    const err = new Error('Invalid plan');
    err.statusCode = 400;
    throw err;
  }
};

const assertKnownCurrency = (currency) => {
  if (!CURRENCIES.includes(currency)) {
    const err = new Error('Invalid currency');
    err.statusCode = 400;
    throw err;
  }
};

// Get a single plan+currency price, self-seeding with the default above if
// this exact row has never been created — so the feature works correctly
// the moment it deploys, without depending on someone remembering to run
// scripts/seed-plan-prices.js first.
const getPrice = async (plan, currency) => {
  assertKnownPlan(plan);
  assertKnownCurrency(currency);

  const existing = await PlanPrice.findOne({ plan, currency });
  if (existing) return existing;

  return PlanPrice.create({ plan, currency, ...DEFAULT_PRICES[plan][currency] });
};

// All 9 rows, grouped by plan — shape the admin panel and the public
// pricing endpoint both want.
const getAllPrices = async () => {
  const rows = await Promise.all(
    PLANS.flatMap((plan) => CURRENCIES.map((currency) => getPrice(plan, currency)))
  );

  return PLANS.map((plan) => {
    const forPlan = rows.filter((r) => r.plan === plan);
    const byCurrency = {};
    for (const row of forPlan) {
      byCurrency[row.currency] = { amount: row.amount, regularAmount: row.regularAmount };
    }
    return { plan, prices: byCurrency };
  });
};

// Admin write path — upserts all 3 currencies for one plan in a single call
// (matches how the admin UI edits "this plan's pricing" as one unit).
const setPrices = async (plan, pricesByCurrency, adminUserId) => {
  assertKnownPlan(plan);

  const updates = [];
  for (const currency of CURRENCIES) {
    const price = pricesByCurrency[currency];
    if (!price) continue;

    const amount = Number(price.amount);
    if (!Number.isFinite(amount) || amount < 0) {
      const err = new Error(`Invalid amount for ${currency}`);
      err.statusCode = 400;
      throw err;
    }
    const regularAmount =
      price.regularAmount === null || price.regularAmount === undefined
        ? null
        : Number(price.regularAmount);

    updates.push(
      PlanPrice.findOneAndUpdate(
        { plan, currency },
        { amount, regularAmount, updatedBy: adminUserId || null },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      )
    );
  }

  await Promise.all(updates);

  const rows = await PlanPrice.find({ plan });
  const byCurrency = {};
  for (const row of rows) {
    byCurrency[row.currency] = { amount: row.amount, regularAmount: row.regularAmount };
  }
  return { plan, prices: byCurrency };
};

module.exports = {
  PLANS,
  CURRENCIES,
  PLAN_LABELS,
  DEFAULT_PRICES,
  getPrice,
  getAllPrices,
  setPrices,
};
