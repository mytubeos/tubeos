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
import {
  formatNumber,
  formatWatchTime,
  formatCurrency,
  formatPct,
  formatSignedNumber,
} from '../../utils/formatters'

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
  subscriberGrowth: {
    label: 'Subscriber Growth',
    icon: Users,
    iconColor: 'cyan',
    format: formatSignedNumber,
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

export const KPICard = ({
  type,
  value,
  change = undefined,
  changeUnit = '%',
  subtitle,
  loading = false,
}) => {
  const config = KPI_CONFIG[type] || KPI_CONFIG.views

  return (
    <MetricCard
      label={config.label}
      value={value !== undefined && value !== null ? config.format(value) : '—'}
      change={change}
      changeUnit={changeUnit}
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

  // calcChange (backend) returns null whenever the previous period had zero
  // views — common on small/new channels, and it happens on every period tab
  // (7d/30d/90d), not just one — which hides the % badge even though "0 -> N"
  // is real growth. delta is always defined, so fall back to an absolute
  // "+N views" readout instead of showing nothing.
  const viewsChangePct = metrics.views?.change
  const viewsDelta = metrics.views?.delta ?? 0
  const viewsChange = viewsChangePct ?? (viewsDelta !== 0 ? viewsDelta : undefined)
  const viewsChangeUnit = viewsChangePct != null ? '%' : ''

  // Dashboard passes channelStats (the channel's live totals) — that page is
  // the "current state" snapshot, so Subscribers shows the real total there.
  // Analytics doesn't pass it — that page is for picking a period and seeing
  // how much you grew/shrank *within* it, so Subscribers shows the period's
  // net gained-minus-lost instead (always defined, unlike the total which
  // Analytics has no per-period value for).
  const showSubTotal = !!channelStats
  const hasRealSubData =
    (metrics.subscribers?.gained || 0) > 0 || (metrics.subscribers?.lost || 0) > 0
  const netSubs = metrics.subscribers?.net ?? 0

  const subType = showSubTotal ? 'subscribers' : 'subscriberGrowth'
  const subValue = showSubTotal ? channelStats?.subscriberCount : netSubs
  const subSubtitle = showSubTotal
    ? hasRealSubData
      ? `+${formatNumber(metrics.subscribers?.gained ?? 0)} gained · ${periodLabel}`
      : 'Total subscribers'
    : `${formatNumber(metrics.subscribers?.gained ?? 0)} gained · ${formatNumber(metrics.subscribers?.lost ?? 0)} lost · ${periodLabel}`

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
      <KPICard
        type="views"
        value={metrics.views?.value}
        change={viewsChange}
        changeUnit={viewsChangeUnit}
        subtitle={isBasicMode ? 'Total views (all videos)' : periodLabel}
        loading={loading}
      />
      <KPICard
        type={subType}
        value={subValue}
        change={
          showSubTotal && hasRealSubData ? (metrics.subscribers?.change ?? undefined) : undefined
        }
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
