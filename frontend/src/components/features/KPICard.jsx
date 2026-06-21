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

export const KPIGrid = ({ overview, loading = false }) => {
  const metrics = overview?.metrics || {}

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
        value={metrics.subscribers?.net}
        change={metrics.subscribers?.change}
        subtitle={`+${formatNumber(metrics.subscribers?.gained)} gained`}
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

const { formatNumber: fn } = { formatNumber }
