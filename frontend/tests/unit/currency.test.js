import { describe, it, expect } from 'vitest'
import { formatPrice } from '../../src/utils/currency'

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
