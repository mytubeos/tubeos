// src/utils/formatters.js

// Format large numbers: 1200 → 1.2K
export const formatNumber = (num) => {
  if (!num && num !== 0) return '—'
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`
  return num.toLocaleString('en-IN')
}

// Format compact number: 1234567 → ₹12.3L or $1.2M
export const formatCurrency = (num, currency = 'INR') => {
  if (!num && num !== 0) return '—'
  if (currency === 'INR') {
    if (num >= 10_000_000) return `₹${(num / 10_000_000).toFixed(1)}Cr`
    if (num >= 100_000) return `₹${(num / 100_000).toFixed(1)}L`
    if (num >= 1_000) return `₹${(num / 1_000).toFixed(1)}K`
    return `₹${num.toFixed(2)}`
  }
  if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(1)}M`
  if (num >= 1_000) return `$${(num / 1_000).toFixed(1)}K`
  return `$${num.toFixed(2)}`
}

// Format watch time (minutes)
export const formatWatchTime = (minutes) => {
  if (!minutes) return '0 min'
  if (minutes >= 1440) return `${(minutes / 1440).toFixed(1)} days`
  if (minutes >= 60) return `${(minutes / 60).toFixed(1)} hrs`
  return `${Math.round(minutes)} min`
}

// Format seconds to MM:SS
export const formatDuration = (seconds) => {
  if (!seconds) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

// Format date: 2024-03-27 → Mar 27
export const formatDate = (date, format = 'short') => {
  if (!date) return '—'
  const d = new Date(date)
  if (format === 'short') {
    return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })
  }
  if (format === 'medium') {
    return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })
  }
  if (format === 'time') {
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
  }
  if (format === 'datetime') {
    return `${formatDate(date, 'short')} · ${formatDate(date, 'time')}`
  }
  return d.toISOString()
}

// Relative time: "2 hours ago"
export const timeAgo = (date) => {
  if (!date) return ''
  const seconds = Math.floor((new Date() - new Date(date)) / 1000)
  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  if (seconds < 2592000) return `${Math.floor(seconds / 86400)}d ago`
  if (seconds < 31536000) return `${Math.floor(seconds / 2592000)}mo ago`
  return `${Math.floor(seconds / 31536000)}y ago`
}

// Format percentage change: +12.5% ↑
export const formatChange = (change) => {
  if (change === null || change === undefined) return null
  const isPositive = change >= 0
  return {
    value: `${isPositive ? '+' : ''}${change.toFixed(1)}%`,
    isPositive,
    color: isPositive ? 'text-emerald' : 'text-rose',
  }
}

// Format percentage
export const formatPct = (num) => {
  if (!num && num !== 0) return '—'
  return `${num.toFixed(1)}%`
}

// Truncate text
export const truncate = (str, length = 50) => {
  if (!str) return ''
  return str.length > length ? `${str.substring(0, length)}...` : str
}

// Get initials from name
export const getInitials = (name) => {
  if (!name) return 'U'
  return name
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .substring(0, 2)
}

// Format file size
export const formatFileSize = (bytes) => {
  if (!bytes) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

// clsx helper
export const cn = (...classes) => classes.filter(Boolean).join(' ')
