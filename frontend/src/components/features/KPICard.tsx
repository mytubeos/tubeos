// src/components/features/KPICard.jsx
import {
  Eye,
  Users,
  Clock,
  ThumbsUp,
  MessageCircle,
  TrendingUp,
  DollarSign,
  Zap,
} from 'lucide-react'
import { MetricCard } from '../ui/Card'
import { formatNumber, formatWatchTime, formatCurrency, formatPct } from '../../utils/formatters'

const KPI_CONFIG = {
  views: {
    label: 'Total Views',
    icon: Eye,
    iconColor: 'brand',
    format: formatNumber,
  },
  subscribers: {
    label: 'Total Subscribers',
    icon: Users,
    iconColor: 'cyan',
    format: formatNumber,
  },
  watchTime: {
    label: 'Watch Time',
    icon: Clock,
    iconColor: 'emerald',
    format: formatWatchTime,
  },
  likes: {
    label: 'Likes',
    icon: ThumbsUp,
    iconColor: 'amber',
    format: formatNumber,
  },
  comments: {
    label: 'Comments',
    icon: MessageCircle,
    iconColor: 'brand',
    format: formatNumber,
  },
  ctr: {
    label: 'Click-Through Rate',
    icon: Zap,
    iconColor: 'cyan',
    format: formatPct,
  },
  revenue: {
    label: 'Estimated Revenue',
    icon: DollarSign,
    iconColor: 'emerald',
    format: (v) => formatCurrency(v, 'USD'),
  },
  impressions: {
    label: 'Impressions',
    icon: TrendingUp,
    iconColor: 'amber',
    format: formatNumber,
  },
}

export const KPICard = ({ type, value, change = undefined, subtitle, loading = false }) => {
  const config = KPI_CONFIG[type] || KPI_CONFIG.views

  return (
    <MetricCard
      label={config.label}
      value={value !== undefined && value !== null ? config.format(value) : '—'}
      change={change}
      trend={undefined}
      icon={config.icon}
      iconColor={config.iconColor}
      subtitle={subtitle}
      loading={loading}
    />
  )
}

const PERIOD_LABEL = {
  '7d': 'last 7 days',
  '30d': 'last 30 days',
  '90d': 'last 90 days',
  '365d': 'last 12 months',
}

export const KPIGrid = ({ overview, loading = false, channelStats = null, period = '30d' }) => {
  const metrics = overview?.metrics || {}
  const periodLabel = PERIOD_LABEL[period] || 'this period'

  // Detect basic mode: no daily analytics data, only video aggregate totals
  const isBasicMode = metrics.views?.change == null && !metrics.watchTime?.value

  // Show period-based gained/lost only when we have real Analytics API data
  const hasRealSubData =
    (metrics.subscribers?.gained || 0) > 0 || (metrics.subscribers?.lost || 0) > 0
  // Card is always labeled "Total Subscribers" — always show the real total here,
  // never the period net (gained − lost), which can be negative and isn't a total.
  const subValue = channelStats?.subscriberCount
  const subSubtitle = hasRealSubData
    ? `+${formatNumber(metrics.subscribers?.gained ?? 0)} gained · ${periodLabel}`
    : 'Total subscribers'

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <KPICard
        type="views"
        value={metrics.views?.value}
        change={metrics.views?.change ?? undefined}
        subtitle={isBasicMode ? 'Total views (all videos)' : periodLabel}
        loading={loading}
      />
      <KPICard
        type="subscribers"
        value={subValue}
        change={hasRealSubData ? (metrics.subscribers?.change ?? undefined) : undefined}
        subtitle={subSubtitle}
        loading={loading}
      />
      <KPICard
        type="watchTime"
        value={metrics.watchTime?.value}
        change={metrics.watchTime?.change ?? undefined}
        subtitle={periodLabel}
        loading={loading}
      />
      <KPICard
        type="ctr"
        value={metrics.ctr?.value}
        subtitle={`avg · ${periodLabel}`}
        loading={loading}
      />
    </div>
  )
}
