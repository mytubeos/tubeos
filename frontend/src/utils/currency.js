// src/utils/currency.js
//
// Which currency to show/charge a visitor, guessed from their browser
// timezone — zero cost, zero new dependency, no geo-IP API/key. This is a
// heuristic (spoofable, wrong for a VPN user or someone whose OS clock is
// misconfigured), not a legal/billing-grade geolocation — good enough for
// "which price list do we show by default."
//
// Deliberately an allowlist of actual Eurozone IANA zones, not a blunt
// "Europe/*" prefix match — that would wrongly bucket the UK
// (Europe/London, GBP not EUR) and Russia (Europe/Moscow, RUB) as Euro.
const EUROZONE_TIMEZONES = new Set([
  'Europe/Vienna', // Austria
  'Europe/Brussels', // Belgium
  'Europe/Zagreb', // Croatia
  'Asia/Nicosia', // Cyprus (IANA files it under Asia, not Europe)
  'Europe/Tallinn', // Estonia
  'Europe/Helsinki', // Finland
  'Europe/Paris', // France
  'Europe/Berlin', // Germany
  'Europe/Athens', // Greece
  'Europe/Dublin', // Ireland
  'Europe/Rome', // Italy
  'Europe/Riga', // Latvia
  'Europe/Vilnius', // Lithuania
  'Europe/Luxembourg', // Luxembourg
  'Europe/Malta', // Malta
  'Europe/Amsterdam', // Netherlands
  'Europe/Lisbon', // Portugal
  'Europe/Bratislava', // Slovakia
  'Europe/Ljubljana', // Slovenia
  'Europe/Madrid', // Spain
])

const INDIA_TIMEZONES = new Set(['Asia/Calcutta', 'Asia/Kolkata'])

export const detectCurrency = () => {
  let timeZone
  try {
    timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || ''
  } catch {
    return 'USD'
  }

  if (INDIA_TIMEZONES.has(timeZone)) return 'INR'
  if (EUROZONE_TIMEZONES.has(timeZone)) return 'EUR'
  return 'USD'
}

const SYMBOLS = { INR: '₹', EUR: '€', USD: '$' }

// amountMinorUnits is paise (INR) or cents (EUR/USD) — same "smallest unit"
// convention as the backend's PlanPrice.amount.
export const formatPrice = (amountMinorUnits, currency) => {
  const symbol = SYMBOLS[currency] || currency
  const major = amountMinorUnits / 100
  // INR list prices are always whole rupees today; EUR/USD commonly want
  // the .99-style two-decimal display.
  const value = currency === 'INR' ? Math.round(major).toLocaleString('en-IN') : major.toFixed(2)
  return `${symbol}${value}`
}
