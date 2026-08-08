import { describe, it, expect, vi, afterEach } from 'vitest'
import { detectCurrency, formatPrice } from '../../src/utils/currency'

const mockTimeZone = (timeZone) => {
  vi.spyOn(Intl, 'DateTimeFormat').mockReturnValue({
    resolvedOptions: () => ({ timeZone }),
  })
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('detectCurrency', () => {
  it('returns INR for Indian timezones', () => {
    mockTimeZone('Asia/Kolkata')
    expect(detectCurrency()).toBe('INR')
    mockTimeZone('Asia/Calcutta')
    expect(detectCurrency()).toBe('INR')
  })

  it('returns EUR for real Eurozone timezones', () => {
    mockTimeZone('Europe/Berlin')
    expect(detectCurrency()).toBe('EUR')
    mockTimeZone('Europe/Paris')
    expect(detectCurrency()).toBe('EUR')
  })

  it('does not treat non-Euro European countries as EUR (UK, Russia)', () => {
    mockTimeZone('Europe/London')
    expect(detectCurrency()).toBe('USD')
    mockTimeZone('Europe/Moscow')
    expect(detectCurrency()).toBe('USD')
  })

  it('falls back to USD for anything else', () => {
    mockTimeZone('America/New_York')
    expect(detectCurrency()).toBe('USD')
    mockTimeZone('Asia/Tokyo')
    expect(detectCurrency()).toBe('USD')
  })

  it('falls back to USD if Intl throws', () => {
    vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(() => {
      throw new Error('unsupported')
    })
    expect(detectCurrency()).toBe('USD')
  })
})

describe('formatPrice', () => {
  it('formats INR as whole rupees with the ₹ symbol', () => {
    expect(formatPrice(19900, 'INR')).toBe('₹199')
    expect(formatPrice(299900, 'INR')).toBe('₹2,999')
  })

  it('formats EUR/USD as two-decimal amounts', () => {
    expect(formatPrice(499, 'EUR')).toBe('€4.99')
    expect(formatPrice(999, 'USD')).toBe('$9.99')
  })
})
