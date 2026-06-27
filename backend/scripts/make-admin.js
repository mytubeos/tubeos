// scripts/make-admin.js
// Run: node scripts/make-admin.js your@email.com
// Makes a user admin in the database

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/models/user.model');

const email = process.argv[2];
if (!email) {
  console.error('Usage: node scripts/make-admin.js your@email.com');
  process.exit(1);
}

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const user = await User.findOneAndUpdate(
    { email: email.toLowerCase() },
    { isAdmin: true },
    { new: true }
  ).select('+isAdmin');

  if (!user) {
    console.error(`User not found: ${email}`);
    process.exit(1);
  }

  console.log(`✅ Admin access granted to: ${user.email} (${user.name})`);
  process.exit(0);
})().catch(err => {
  console.error(err.message);
  process.exit(1);
});
