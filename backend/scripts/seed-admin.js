// scripts/seed-admin.js
// Creates admin account if not exists, or upgrades existing account to admin
// Run: node scripts/seed-admin.js

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/models/user.model');

const ADMIN_EMAIL = 'tubeos.saas@gmail.com';
const ADMIN_NAME = 'TubeOS Admin';
const ADMIN_PASSWORD = 'vibecore4admin';

(async () => {
  if (!process.env.MONGODB_URI) {
    console.error('❌ MONGODB_URI not set in .env file');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ Connected to MongoDB');

  let user = await User.findOne({ email: ADMIN_EMAIL }).select('+isAdmin');

  if (user) {
    // Account already exists — just make it admin
    user.isAdmin = true;
    user.isEmailVerified = true;
    await user.save();
    console.log(`✅ Existing account upgraded to admin: ${ADMIN_EMAIL}`);
  } else {
    // Create fresh admin account
    user = await User.create({
      name: ADMIN_NAME,
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      isAdmin: true,
      isEmailVerified: true,
      emailVerifiedAt: new Date(),
      plan: 'agency',
    });
    console.log(`✅ Admin account created: ${ADMIN_EMAIL}`);
  }

  console.log('');
  console.log('─────────────────────────────────');
  console.log(`  Email    : ${ADMIN_EMAIL}`);
  console.log(`  Password : ${ADMIN_PASSWORD}`);
  console.log(`  Plan     : ${user.plan}`);
  console.log(`  Admin    : true`);
  console.log('─────────────────────────────────');
  console.log('');
  console.log('👉 Login karo aur /admin pe jao');

  process.exit(0);
})().catch((err) => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
