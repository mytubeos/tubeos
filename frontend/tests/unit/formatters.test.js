import { describe, it, expect } from 'vitest'
import {
  formatNumber,
  formatCurrency,
  formatWatchTime,
  formatDuration,
  formatDate,
  timeAgo,
  formatChange,
  formatPct,
  truncate,
  getInitials,
  formatFileSize,
  cn,
} from '../../src/utils/formatters'

describe('formatNumber', () => {
  it('returns em-dash for null/undefined', () => {
    expect(formatNumber(null)).toBe('—')
    expect(formatNumber(undefined)).toBe('—')
  })

  it('renders 0 as a real number, not the empty placeholder', () => {
    expect(formatNumber(0)).toBe('0')
  })

  it('formats thousands with K suffix', () => {
    expect(formatNumber(1200)).toBe('1.2K')
  })

  it('formats millions with M suffix', () => {
    expect(formatNumber(2_500_000)).toBe('2.5M')
  })

  it('formats small numbers via locale string', () => {
    expect(formatNumber(500)).toBe('500')
  })
})

describe('formatCurrency', () => {
  it('returns em-dash for null/undefined', () => {
    expect(formatCurrency(null)).toBe('—')
  })

  it('formats INR in Lakh/Crore units', () => {
    expect(formatCurrency(150000, 'INR')).toBe('₹1.5L')
    expect(formatCurrency(15000000, 'INR')).toBe('₹1.5Cr')
    expect(formatCurrency(5000, 'INR')).toBe('₹5.0K')
    expect(formatCurrency(50, 'INR')).toBe('₹50.00')
  })

  it('formats USD without Lakh/Crore units', () => {
    expect(formatCurrency(1_500_000, 'USD')).toBe('$1.5M')
    expect(formatCurrency(2500, 'USD')).toBe('$2.5K')
    expect(formatCurrency(50, 'USD')).toBe('$50.00')
  })
})

describe('formatWatchTime', () => {
  it('handles zero/falsy minutes', () => {
    expect(formatWatchTime(0)).toBe('0 min')
    expect(formatWatchTime(null)).toBe('0 min')
  })

  it('formats under an hour as minutes', () => {
    expect(formatWatchTime(45)).toBe('45 min')
  })

  it('formats under a day as hours', () => {
    expect(formatWatchTime(120)).toBe('2.0 hrs')
  })

  it('formats a day or more as days', () => {
    expect(formatWatchTime(2880)).toBe('2.0 days')
  })
})

describe('formatDuration', () => {
  it('handles zero seconds', () => {
    expect(formatDuration(0)).toBe('0:00')
  })

  it('pads seconds under 10', () => {
    expect(formatDuration(65)).toBe('1:05')
  })

  it('formats minutes and seconds', () => {
    expect(formatDuration(725)).toBe('12:05')
  })
})

describe('formatDate', () => {
  it('returns em-dash for falsy date', () => {
    expect(formatDate(null)).toBe('—')
  })

  it('formats short date as month + day', () => {
    const result = formatDate('2024-03-27T00:00:00Z', 'short')
    expect(result).toMatch(/Mar/)
    expect(result).toMatch(/27/)
  })

  it('composes datetime from short date + time', () => {
    const result = formatDate('2024-03-27T10:00:00Z', 'datetime')
    expect(result).toContain('·')
  })
})

describe('timeAgo', () => {
  it('returns empty string for falsy date', () => {
    expect(timeAgo(null)).toBe('')
  })

  it('reports "just now" for very recent timestamps', () => {
    expect(timeAgo(new Date())).toBe('just now')
  })

  it('reports minutes ago', () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000)
    expect(timeAgo(fiveMinAgo)).toBe('5m ago')
  })

  it('reports hours ago', () => {
    const twoHrsAgo = new Date(Date.now() - 2 * 3600 * 1000)
    expect(timeAgo(twoHrsAgo)).toBe('2h ago')
  })

  it('reports days ago', () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 86400 * 1000)
    expect(timeAgo(twoDaysAgo)).toBe('2d ago')
  })
})

describe('formatChange', () => {
  it('returns null for null/undefined change', () => {
    expect(formatChange(null)).toBeNull()
    expect(formatChange(undefined)).toBeNull()
  })

  it('marks positive change with a plus sign and emerald color', () => {
    const result = formatChange(12.34)
    expect(result).toEqual({ value: '+12.3%', isPositive: true, color: 'text-emerald' })
  })

  it('marks negative change without a plus sign and rose color', () => {
    const result = formatChange(-5.67)
    expect(result).toEqual({ value: '-5.7%', isPositive: false, color: 'text-rose' })
  })

  it('treats zero as positive', () => {
    expect(formatChange(0).isPositive).toBe(true)
  })
})

describe('formatPct', () => {
  it('returns em-dash for null/undefined', () => {
    expect(formatPct(null)).toBe('—')
  })

  it('renders 0 as a real percentage', () => {
    expect(formatPct(0)).toBe('0.0%')
  })

  it('formats to one decimal place', () => {
    expect(formatPct(12.345)).toBe('12.3%')
  })
})

describe('truncate', () => {
  it('returns empty string for falsy input', () => {
    expect(truncate(null)).toBe('')
  })

  it('leaves short strings untouched', () => {
    expect(truncate('hello', 10)).toBe('hello')
  })

  it('truncates long strings with an ellipsis', () => {
    expect(truncate('a'.repeat(60), 50)).toBe(`${'a'.repeat(50)}...`)
  })
})

describe('getInitials', () => {
  it('defaults to "U" for missing name', () => {
    expect(getInitials(null)).toBe('U')
  })

  it('builds initials from first and last name', () => {
    expect(getInitials('John Doe')).toBe('JD')
  })

  it('caps at two characters for long names', () => {
    expect(getInitials('John Middle Doe')).toBe('JM')
  })
})

describe('formatFileSize', () => {
  it('handles zero bytes', () => {
    expect(formatFileSize(0)).toBe('0 B')
  })

  it('formats KB/MB/GB', () => {
    expect(formatFileSize(1024)).toBe('1 KB')
    expect(formatFileSize(1024 * 1024 * 2.5)).toBe('2.5 MB')
  })
})

describe('cn', () => {
  it('joins truthy class names with a space', () => {
    expect(cn('a', null, undefined, false, 'b')).toBe('a b')
  })
})
