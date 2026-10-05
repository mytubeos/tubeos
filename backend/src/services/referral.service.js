// src/services/referral.service.js
// Referral commissions, stats, payouts.

const User = require('../models/user.model');
const { ReferralEarning, PayoutRequest } = require('../models/referral.model');

const MIN_PAYOUT = 200; // ₹
const MAX_COMMISSION_CYCLES = 6;

// Commission rate based on referrer's total successful referrals
const getCommissionRate = (totalReferrals = 0) => {
  if (totalReferrals >= 50) return 20;
  if (totalReferrals >= 25) return 15;
  if (totalReferrals >= 10) return 12;
  return 10;
};

const getTierName = (count) => {
  if (count >= 50) return 'Legend';
  if (count >= 25) return 'Champion';
  if (count >= 10) return 'Grower';
  return 'Starter';
};

// Credit commission to a referrer when their referred user pays.
// Called from payment.service after successful payment.captured.
const recordEarningFromPayment = async ({
  referredUserId,
  paidAmountPaise,
  plan,
  razorpayPaymentId,
}) => {
  const referredUser = await User.findById(referredUserId);
  if (!referredUser?.referral?.referredBy) return null;

  const referrer = await User.findById(referredUser.referral.referredBy);
  if (!referrer) return null;

  // Has this referrer already earned MAX_COMMISSION_CYCLES from this referee?
  const prior = await ReferralEarning.countDocuments({
    referrerId: referrer._id,
    referredUserId,
    status: 'credited',
  });
  if (prior >= MAX_COMMISSION_CYCLES) return null;

  const rate = getCommissionRate(referrer.referral.totalReferrals || 0);
  const paidAmount = (paidAmountPaise || 0) / 100; // ₹
  const commissionAmount = Math.round((paidAmount * rate) / 100);

  if (commissionAmount <= 0) return null;

  const earning = await ReferralEarning.create({
    referrerId: referrer._id,
    referredUserId,
    plan,
    paidAmount,
    commissionRate: rate,
    commissionAmount,
    razorpayPaymentId: razorpayPaymentId || null,
    billingCycleIndex: prior + 1,
  });

  await User.findByIdAndUpdate(referrer._id, {
    $inc: {
      'wallet.balance': commissionAmount,
      'wallet.totalEarned': commissionAmount,
    },
  });

  return earning;
};

// USD ledger entries and wallet increments share the payment transaction.
const recordUsdEarning = async ({ referredUser, amountCents, paymentId, plan, session }) => {
  if (!referredUser.referral?.referredBy) return;
  const referrer = await User.findById(referredUser.referral.referredBy).session(session);
  if (!referrer || referrer._id.equals(referredUser._id)) return;
  const prior = await ReferralEarning.countDocuments({
    referrerId: referrer._id,
    referredUserId: referredUser._id,
    status: 'credited',
  }).session(session);
  if (prior >= MAX_COMMISSION_CYCLES) return;
  const rate = getCommissionRate(referrer.referral.totalReferrals || 0);
  const commissionCents = Math.round((amountCents * rate) / 100);
  if (commissionCents <= 0) return;
  await ReferralEarning.create(
    [
      {
        referrerId: referrer._id,
        referredUserId: referredUser._id,
        plan,
        currency: 'USD',
        paidAmount: amountCents / 100,
        paidAmountCents: amountCents,
        commissionRate: rate,
        commissionAmount: commissionCents / 100,
        commissionCents,
        dodoPaymentId: paymentId,
        billingCycleIndex: prior + 1,
      },
    ],
    { session }
  );
  await User.updateOne(
    { _id: referrer._id },
    {
      $inc: {
        'usdWallet.balanceCents': commissionCents,
        'usdWallet.totalEarnedCents': commissionCents,
      },
    },
    { session }
  );
};

const configuredMinimum = Number(process.env.REFERRAL_MIN_PAYOUT_CENTS || 500);
const MIN_USD_PAYOUT_CENTS =
  Number.isSafeInteger(configuredMinimum) && configuredMinimum > 0 ? configuredMinimum : 500;

// GET /referral/stats — per-user dashboard data
const getStats = async (userId) => {
  const user = await User.findById(userId);
  if (!user) {
    const err = new Error('User not found');
    err.statusCode = 404;
    throw err;
  }

  const totalReferrals = user.referral?.totalReferrals || 0;
  const activeReferrals = await User.countDocuments({
    'referral.referredBy': user._id,
    plan: { $ne: 'free' },
  });

  return {
    code: user.referral?.myCode || null,
    tier: getTierName(totalReferrals),
    tierColor:
      totalReferrals >= 50
        ? 'amber'
        : totalReferrals >= 25
          ? 'emerald'
          : totalReferrals >= 10
            ? 'cyan'
            : 'brand',
    commissionRate: getCommissionRate(totalReferrals),
    nextTierAt:
      totalReferrals >= 50 ? null : totalReferrals >= 25 ? 50 : totalReferrals >= 10 ? 25 : 10,
    totalReferrals,
    activeReferrals,
    currency: 'USD',
    wallet: {
      balance: (user.usdWallet?.balanceCents || 0) / 100,
      totalEarned: (user.usdWallet?.totalEarnedCents || 0) / 100,
      totalWithdrawn: (user.usdWallet?.totalWithdrawnCents || 0) / 100,
      pendingPayout: (user.usdWallet?.pendingPayoutCents || 0) / 100,
    },
    legacyBalanceNeedsReconciliation: !!(user.wallet?.balance || user.wallet?.pendingPayout),
    minPayout: MIN_USD_PAYOUT_CENTS / 100,
  };
};

// GET /referral/earnings — paginated list
const listEarnings = async (userId, { page = 1, limit = 20 } = {}) => {
  const skip = (page - 1) * limit;
  const [earnings, total] = await Promise.all([
    ReferralEarning.find({ referrerId: userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('referredUserId', 'name email plan'),
    ReferralEarning.countDocuments({ referrerId: userId }),
  ]);
  return { earnings, pagination: { page, limit, total } };
};

// GET /referral/referrals — list of referred users
const listReferredUsers = async (userId, { page = 1, limit = 20 } = {}) => {
  const skip = (page - 1) * limit;
  const [users, total] = await Promise.all([
    User.find({ 'referral.referredBy': userId })
      .select('name email plan createdAt subscriptionExpiresAt')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    User.countDocuments({ 'referral.referredBy': userId }),
  ]);
  return { users, pagination: { page, limit, total } };
};

// POST /referral/payout — request a withdrawal
const requestPayout = async (userId, { amount, method, upi, bankAccount }) => {
  const amountCents = Math.round(Number(amount) * 100);
  if (
    !Number.isFinite(Number(amount)) ||
    !Number.isSafeInteger(amountCents) ||
    Math.abs(Number(amount) * 100 - amountCents) > 0.000001 ||
    amountCents < MIN_USD_PAYOUT_CENTS
  ) {
    const err = new Error(
      `Minimum payout is $${(MIN_USD_PAYOUT_CENTS / 100).toFixed(2)}. Use at most two decimal places.`
    );
    err.statusCode = 400;
    throw err;
  }
  if (!['upi', 'bank'].includes(method)) {
    const err = new Error('Method must be upi or bank');
    err.statusCode = 400;
    throw err;
  }
  if (method === 'upi' && !upi) {
    const err = new Error('UPI ID is required');
    err.statusCode = 400;
    throw err;
  }
  if (
    method === 'bank' &&
    (!bankAccount?.accountNumber || !bankAccount?.ifsc || !bankAccount?.holderName)
  ) {
    const err = new Error('Bank account number, IFSC, and holder name are required');
    err.statusCode = 400;
    throw err;
  }

  return User.db.transaction(async (session) => {
    const user = await User.findOneAndUpdate(
      { _id: userId, 'usdWallet.balanceCents': { $gte: amountCents } },
      {
        $inc: {
          'usdWallet.balanceCents': -amountCents,
          'usdWallet.pendingPayoutCents': amountCents,
        },
      },
      { new: true, session }
    );
    if (!user) {
      const err = new Error('Insufficient USD balance');
      err.statusCode = 400;
      throw err;
    }
    const [payout] = await PayoutRequest.create(
      [
        {
          userId,
          amount: amountCents / 100,
          amountCents,
          currency: 'USD',
          method,
          upi: method === 'upi' ? upi : null,
          bankAccount: method === 'bank' ? bankAccount : undefined,
        },
      ],
      { session }
    );
    return {
      payout,
      message:
        'USD payout request submitted. Settlement details will be confirmed before transfer.',
    };
  });
};

// GET /referral/payouts — request history
const listPayouts = async (userId, { page = 1, limit = 20 } = {}) => {
  const skip = (page - 1) * limit;
  const [payouts, total] = await Promise.all([
    PayoutRequest.find({ userId }).sort({ createdAt: -1 }).skip(skip).limit(limit),
    PayoutRequest.countDocuments({ userId }),
  ]);
  return { payouts, pagination: { page, limit, total } };
};

module.exports = {
  recordEarningFromPayment,
  recordUsdEarning,
  getStats,
  listEarnings,
  listReferredUsers,
  requestPayout,
  listPayouts,
  getCommissionRate,
  getTierName,
  MIN_PAYOUT,
};
