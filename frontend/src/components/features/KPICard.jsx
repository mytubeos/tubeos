// src/components/features/KPICard.jsx
import { Eye, Users, Clock, ThumbsUp, MessageCircle, TrendingUp, DollarSign, Zap } from 'lucide-react'
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
    label: 'New Subscribers',
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

export const KPICard = ({ type, value, change, subtitle, loading = false }) => {
  const config = KPI_CONFIG[type] || KPI_CONFIG.views

  return (
    <MetricCard
      label={config.label}
      value={value !== undefined && value !== null ? config.format(value) : '—'}
      change={change}
      icon={config.icon}
      iconColor={config.iconColor}
      subtitle={subtitle}
      loading={loading}
    />
  )
}

export const KPIGrid = ({ overview, loading = false, channelStats = null }) => {
  const metrics = overview?.metrics || {}
  const hasAnalytics = !!overview

  // Subscriber display: period-based "gained" from Analytics API, else total from channel stats
  const subValue    = hasAnalytics ? metrics.subscribers?.net : channelStats?.subscriberCount
  const subSubtitle = hasAnalytics
    ? `+${formatNumber(metrics.subscribers?.gained ?? 0)} gained`
    : 'Total subscribers'

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <KPICard
        type="views"
        value={metrics.views?.value}
        change={metrics.views?.change}
        loading={loading}
      />
      <KPICard
        type="subscribers"
        value={subValue}
        change={metrics.subscribers?.change}
        subtitle={subSubtitle}
        loading={loading}
      />
      <KPICard
        type="watchTime"
        value={metrics.watchTime?.value}
        loading={loading}
      />
      <KPICard
        type="ctr"
        value={metrics.ctr?.value}
        loading={loading}
      />
    </div>
  )
}

