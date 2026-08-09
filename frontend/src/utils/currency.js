// src/utils/currency.js
//
// Vezrin charges the same USD price worldwide via Dodo Payments — no
// region-based currency detection. formatPrice still needs to handle
// INR/EUR though: existing PaymentHistory rows from before this migration
// (Razorpay/Stripe) are still displayed on the Billing History page in
// whatever currency they were actually charged in at the time.
const SYMBOLS = { INR: '₹', EUR: '€', USD: '$' }

// amountMinorUnits is paise (INR) or cents (EUR/USD) — same "smallest unit"
// convention as the backend's PlanPrice.amount / PaymentHistory.amount.
export const formatPrice = (amountMinorUnits, currency) => {
  const symbol = SYMBOLS[currency] || currency
  const major = amountMinorUnits / 100
  // INR amounts are always whole rupees; EUR/USD use the .99-style
  // two-decimal display.
  const value = currency === 'INR' ? Math.round(major).toLocaleString('en-IN') : major.toFixed(2)
  return `${symbol}${value}`
}
