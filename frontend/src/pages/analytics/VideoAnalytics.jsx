// src/pages/analytics/VideoAnalytics.jsx
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, ExternalLink, Eye, ThumbsUp, Clock, Zap, BarChart2 } from 'lucide-react'
import { analyticsApi } from '../../api/analytics.api'
import { AreaLineChart } from '../../components/charts/LineChart'
import { Card, CardHeader, MetricCard } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { StatusBadge } from '../../components/ui/Badge'
import { formatNumber, formatDate, formatDuration, formatPct } from '../../utils/formatters'
import { useChannel } from '../../hooks/useChannel'

export const VideoAnalytics = () => {
  const { videoId } = useParams()
  const navigate = useNavigate()
  const { upgradeAnalytics } = useChannel()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeMetric, setActiveMetric] = useState('views')
  const [upgrading, setUpgrading] = useState(false)

  useEffect(() => {
    if (!videoId) return
    setLoading(true)
    analyticsApi
      .getVideoBreakdown(videoId)
      .then((res) => setData(res.data.data))
      .catch(() => navigate(-1))
      .finally(() => setLoading(false))
  }, [videoId])

  const handleUpgradeAnalytics = async (channelId) => {
    setUpgrading(true)
    await upgradeAnalytics(channelId)
    setUpgrading(false)
  }

  if (loading) {
    return (
      <div className="space-y-5">
        <div className="shimmer h-8 w-48 rounded" />
        <div className="shimmer h-40 rounded-xl" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array(4)
            .fill(0)
            .map((_, i) => (
              <div key={i} className="shimmer h-24 rounded-xl" />
            ))}
        </div>
      </div>
    )
  }

  if (!data) return null
  const { video, totals, daily } = data

  const hasNoDailyData = !daily || daily.length === 0
  const publishedRecently =
    video.publishedAt &&
    Date.now() - new Date(video.publishedAt).getTime() < 2 * 24 * 60 * 60 * 1000
  const isFullAnalytics = video.channel?.analyticsMode === 'full'

  // Total Views/Likes above come from YouTube's Data API (real-time,
  // authoritative). The Daily Performance chart below is a genuinely
  // different source — YouTube's Analytics API — which only attributes a
  // view to a specific calendar day once it has enough traffic to process;
  // low-view videos routinely end up with a day-by-day sum lower than the
  // real total shown above, sometimes permanently, with no way to make the
  // two reconcile. Not a sync failure — flagged here so a lower daily sum
  // than the headline total isn't mistaken for one.
  // Threshold (not "any gap at all"): live-checked and even a well-trafficked
  // video with a genuinely complete-looking chart had a small, harmless gap
  // between the two APIs — a near-universal Data-API-vs-Analytics-API
  // discrepancy, not something worth a banner every single time. Only
  // surface this when the daily breakdown accounts for under 80% of the
  // real total, i.e. the chart itself would visibly look incomplete.
  const dailyViewsSum = (daily || []).reduce((sum, d) => sum + (d.views || 0), 0)
  const hasIncompleteDaily =
    !hasNoDailyData && totals.views > 0 && dailyViewsSum < totals.views * 0.8

  const METRICS = [
    { key: 'views', label: 'Views', color: '#00A0FD' },
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
          {video.thumbnail?.url ? (
            <img src={video.thumbnail.url} className="w-full h-full object-cover" alt="" />
          ) : (
            <div className="w-full h-full bg-brand/20 flex items-center justify-center">
              <Eye size={24} className="text-brand/50" />
            </div>
          )}
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
                <Button variant="ghost" size="sm" icon={ExternalLink}>
                  YouTube
                </Button>
              </a>
            )}
          </div>
          <div className="flex items-center gap-3 mt-2">
            <StatusBadge status={video.status} />
            <p className="text-gray-500 text-sm">
              {video.channel?.channelName}
              {video.status === 'published' &&
                video.publishedAt &&
                ` · Published ${formatDate(video.publishedAt, 'medium')}`}
              {video.status === 'scheduled' &&
                video.scheduledAt &&
                ` · Scheduled for ${formatDate(video.scheduledAt, 'medium')}`}
            </p>
          </div>
        </div>
      </div>

      {/* Basic-mode notice — detailed per-video breakdown needs the Analytics scope granted */}
      {!isFullAnalytics && (
        <div className="flex items-center gap-3 p-4 rounded-xl border border-amber/20 bg-amber/5">
          <BarChart2 size={18} className="text-amber shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white">
              Limited data — Analytics access not enabled
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              Detailed watch time, CTR, and daily performance for this video need Analytics access
              on this channel. Basic view/like counts still update normally.
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => handleUpgradeAnalytics(video.channel._id)}
            loading={upgrading}
          >
            Enable Analytics
          </Button>
        </div>
      )}

      {/* Full analytics access exists, but this video has no daily breakdown yet */}
      {isFullAnalytics && hasNoDailyData && publishedRecently && (
        <div className="flex items-center gap-3 p-4 rounded-xl border border-cyan/20 bg-cyan/5">
          <Clock size={18} className="text-cyan shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white">Analytics still processing</p>
            <p className="text-xs text-gray-500 mt-0.5">
              This video was published recently — YouTube usually takes 24–48 hours to make detailed
              per-video stats available. Views/likes above will fill in once it's ready.
            </p>
          </div>
        </div>
      )}
      {isFullAnalytics && hasNoDailyData && !publishedRecently && (
        <div className="flex items-center gap-3 p-4 rounded-xl border border-white/10 bg-white/[0.02]">
          <BarChart2 size={18} className="text-gray-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white">No detailed data available yet</p>
            <p className="text-xs text-gray-500 mt-0.5">
              Try clicking Sync on the Dashboard or Analytics page to refresh this video's daily
              breakdown.
            </p>
          </div>
        </div>
      )}
      {hasIncompleteDaily && (
        <div className="flex items-center gap-3 p-4 rounded-xl border border-white/10 bg-white/[0.02]">
          <BarChart2 size={18} className="text-gray-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white">
              Daily chart below may not add up to Total Views
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              Total Views above is YouTube's real, live count — always accurate. The day-by-day
              chart comes from a separate YouTube report that only attributes a view to a specific
              day once the video gets enough traffic, so lower-view videos often show a daily total
              lower than the real count above. This is a YouTube limitation, not a sync issue.
            </p>
          </div>
        </div>
      )}

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
        <div className="flex flex-col gap-3 mb-4 sm:flex-row sm:items-center sm:justify-between">
          <CardHeader title="Daily Performance" icon={Zap} />
          <div className="flex items-center glass rounded-xl p-1 overflow-x-auto">
            {METRICS.map((m) => (
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
          data={(daily || []).map((d) => ({
            date: d.date,
            value: d[activeMetric] || 0,
          }))}
          dataKey="value"
          label={METRICS.find((m) => m.key === activeMetric)?.label}
          color={METRICS.find((m) => m.key === activeMetric)?.color || '#00A0FD'}
          height={220}
        />
      </Card>
    </div>
  )
}
