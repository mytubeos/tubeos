// scripts/seed-plan-prices.js
// Creates the 9 plan+currency price rows if they don't exist yet, using
// pricing.service.js's DEFAULT_PRICES. Not strictly required — getPrice()
// auto-seeds a missing row the first time it's read — but useful to
// pre-populate everything at once and see the starting numbers before
// they're live.
// Run: node scripts/seed-plan-prices.js

require('dotenv').config();
const mongoose = require('mongoose');
const { PLANS, CURRENCIES, getPrice } = require('../src/services/pricing.service');

(async () => {
  if (!process.env.MONGODB_URI) {
    console.error('❌ MONGODB_URI not set in .env file');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ Connected to MongoDB');
  console.log('');

  for (const plan of PLANS) {
    for (const currency of CURRENCIES) {
      const row = await getPrice(plan, currency);
      console.log(
        `${plan.padEnd(8)} ${currency}  amount=${row.amount}  regular=${row.regularAmount}`
      );
    }
  }

  console.log('');
  console.log('👉 These are placeholder starting numbers — edit them from /admin/pricing');

  process.exit(0);
})().catch((err) => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
