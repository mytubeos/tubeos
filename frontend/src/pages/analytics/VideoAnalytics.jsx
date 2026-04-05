// src/pages/analytics/VideoAnalytics.jsx
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, ExternalLink, Eye, ThumbsUp, Clock, Zap } from 'lucide-react'
import { analyticsApi } from '../../api/analytics.api'
import { AreaLineChart } from '../../components/charts/LineChart'
import { Card, CardHeader, MetricCard } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { StatusBadge } from '../../components/ui/Badge'
import { formatNumber, formatDate, formatDuration, formatPct, formatWatchTime } from '../../utils/formatters'

export const VideoAnalytics = () => {
  const { videoId } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeMetric, setActiveMetric] = useState('views')

  useEffect(() => {
    if (!videoId) return
    setLoading(true)
    analyticsApi.getVideoBreakdown(videoId)
      .then(res => setData(res.data.data))
      .catch(() => navigate(-1))
      .finally(() => setLoading(false))
  }, [videoId])

  if (loading) {
    return (
      <div className="space-y-5">
        <div className="shimmer h-8 w-48 rounded" />
        <div className="shimmer h-40 rounded-xl" />
        <div className="grid grid-cols-4 gap-4">
          {Array(4).fill(0).map((_, i) => <div key={i} className="shimmer h-24 rounded-xl" />)}
        </div>
      </div>
    )
  }

  if (!data) return null
  const { video, totals, daily } = data

  const METRICS = [
    { key: 'views', label: 'Views', color: '#4F46E5' },
    { key: 'watchTime', label: 'Watch Time', color: '#10B981' },
    { key: 'likes', label: 'Likes', color: '#F59E0B' },
    { key: 'ctr', label: 'CTR', color: '#06B6D4' },
  ]

  return (
    <div className="space-y-5">

      {/* Back + Title */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" icon={ArrowLeft} onClick={() => navigate(-1)}>
          Back
        </Button>
      </div>

      {/* Video header */}
      <div className="glass p-5 rounded-2xl flex items-start gap-5">
        <div className="w-40 h-24 rounded-xl overflow-hidden bg-base-600 shrink-0">
          {video.thumbnail?.url
            ? <img src={video.thumbnail.url} className="w-full h-full object-cover" alt="" />
            : <div className="w-full h-full bg-brand/20 flex items-center justify-center">
                <Eye size={24} className="text-brand/50" />
              </div>
          }
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <h2 className="font-display font-bold text-white text-xl leading-tight">
              {video.title}
            </h2>
            {video.youtubeVideoId && (
              <a
                href={`https://www.youtube.com/watch?v=${video.youtubeVideoId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0"
              >
                <Button variant="ghost" size="sm" icon={ExternalLink}>YouTube</Button>
              </a>
            )}
          </div>
          <div className="flex items-center gap-3 mt-2">
            <p className="text-gray-500 text-sm">
              {video.channel?.channelName} · Published {formatDate(video.publishedAt, 'medium')}
            </p>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Total Views"
          value={formatNumber(totals.views)}
          icon={Eye}
          iconColor="brand"
        />
        <MetricCard
          label="Likes"
          value={formatNumber(totals.likes)}
          icon={ThumbsUp}
          iconColor="amber"
        />
        <MetricCard
          label="Avg View Duration"
          value={formatDuration(totals.avgViewDuration)}
          icon={Clock}
          iconColor="cyan"
        />
        <MetricCard
          label="Click-Through Rate"
          value={formatPct(totals.avgCtr)}
          icon={Zap}
          iconColor="emerald"
        />
      </div>

      {/* Daily chart */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <CardHeader title="Daily Performance" icon={Zap} />
          <div className="flex items-center glass rounded-xl p-1">
            {METRICS.map(m => (
              <button
                key={m.key}
                onClick={() => setActiveMetric(m.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all
                            ${activeMetric === m.key ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'}`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        <AreaLineChart
          data={(daily || []).map(d => ({
            date: d.date,
            value: d[activeMetric] || 0,
          }))}
          dataKey="value"
          label={METRICS.find(m => m.key === activeMetric)?.label}
          color={METRICS.find(m => m.key === activeMetric)?.color || '#4F46E5'}
          height={220}
        />
      </Card>
    </div>
  )
}
