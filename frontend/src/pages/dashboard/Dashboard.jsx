// src/pages/dashboard/Dashboard.jsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { RefreshCw, Plus, Youtube, ArrowRight, Zap, Clock } from 'lucide-react'
import { useAnalytics } from '../../hooks/useAnalytics'
import { useChannelStore } from '../../store/channelStore'
import { useAuthStore } from '../../store/authStore'
import { KPIGrid } from '../../components/features/KPICard'
import { TopVideos } from '../../components/features/TopVideos'
import { AreaLineChart } from '../../components/charts/LineChart'
import { Card, CardHeader } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { analyticsApi } from '../../api/analytics.api'
import { scheduleApi } from '../../api/schedule.api'
import { formatDate, formatNumber, timeAgo } from '../../utils/formatters'
import { PERIODS } from '../../utils/constants'
import { StatusBadge } from '../../components/ui/Badge'
import toast from 'react-hot-toast'

export const Dashboard = () => {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { activeChannel } = useChannelStore()
  const [period, setPeriod] = useState('30d')
  const [syncing, setSyncing] = useState(false)
  const [upcoming, setUpcoming] = useState([])
  const [bestTime, setBestTime] = useState(null)

  const { overview, graphData, topVideos, isLoading, refetch } = useAnalytics(period)

  // Fetch upcoming scheduled videos
  useEffect(() => {
    scheduleApi.getAll({ status: 'pending', limit: 3 })
      .then(res => setUpcoming(res.data.data || []))
      .catch(() => {})
  }, [])

  // Fetch best time
  useEffect(() => {
    if (!activeChannel?._id) return
    scheduleApi.getBestTime(activeChannel._id)
      .then(res => setBestTime(res.data.data))
      .catch(() => {})
  }, [activeChannel?._id])

  const handleSync = async () => {
    if (!activeChannel?._id) return
    setSyncing(true)
    try {
      await analyticsApi.sync(activeChannel._id, 30)
      await refetch()
      toast.success('Analytics synced!')
    } catch {
      toast.error('Sync failed')
    } finally {
      setSyncing(false)
    }
  }

  // No channel connected state
  if (!activeChannel) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="w-20 h-20 bg-brand/10 rounded-3xl flex items-center justify-center mb-6">
          <Youtube size={36} className="text-brand" />
        </div>
        <h2 className="font-display font-bold text-white text-2xl mb-3">
          Connect your YouTube channel
        </h2>
        <p className="text-gray-500 text-sm max-w-sm mb-8">
          Link your YouTube channel to start tracking analytics, scheduling videos and automating engagement.
        </p>
        <Button onClick={() => navigate('/channels')} icon={Plus} size="lg">
          Connect Channel
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">

      {/* Header row */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display font-bold text-white text-2xl">
            Welcome back, {user?.name?.split(' ')[0]} 👋
          </h2>
          <p className="text-gray-500 text-sm mt-0.5">
            {activeChannel.channelName} · {formatNumber(activeChannel.stats?.subscriberCount)} subscribers
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Period selector */}
          <div className="flex items-center glass rounded-xl p-1">
            {PERIODS.slice(0, 3).map(p => (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all
                            ${period === p.value
                              ? 'bg-brand text-white shadow-lg'
                              : 'text-gray-400 hover:text-white'}`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <Button
            variant="ghost"
            size="sm"
            icon={RefreshCw}
            onClick={handleSync}
            loading={syncing}
          >
            Sync
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <KPIGrid overview={overview} loading={isLoading} />

      {/* Main chart + sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Views chart */}
        <Card className="lg:col-span-2">
          <CardHeader
            title="Views Over Time"
            subtitle={`Last ${period === '7d' ? '7' : period === '30d' ? '30' : '90'} days`}
            icon={Zap}
          />
          {isLoading ? (
            <div className="shimmer h-52 rounded-xl" />
          ) : (
            <AreaLineChart
              data={graphData?.data || []}
              dataKey="value"
              label="Views"
              color="#4F46E5"
              height={220}
              xKey="date"
            />
          )}
        </Card>

        {/* Best time to post */}
        <Card>
          <CardHeader title="Best Time to Post" icon={Clock} iconColor="cyan" />
          {bestTime ? (
            <div className="space-y-3">
              {(bestTime.recommendation?.nextOptimalSlots || bestTime.nextOptimalSlots || [])
                .slice(0, 4)
                .map((slot, i) => (
                  <div
                    key={i}
                    className={`flex items-center justify-between p-3 rounded-xl
                                ${i === 0 ? 'bg-emerald/10 border border-emerald/20' : 'glass'}`}
                  >
                    <div>
                      <p className={`text-sm font-medium ${i === 0 ? 'text-emerald' : 'text-white'}`}>
                        {new Date(slot.datetime).toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' })}
                      </p>
                      <p className="text-xs text-gray-500">{slot.time || slot.hour}</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-bold ${i === 0 ? 'text-emerald' : 'text-brand'}`}>
                        {slot.score}/100
                      </p>
                      {i === 0 && <p className="text-2xs text-emerald">Best ⚡</p>}
                    </div>
                  </div>
                ))}

              <Button
                variant="ghost"
                size="sm"
                fullWidth
                onClick={() => navigate('/heatmap')}
              >
                View Full Heatmap
              </Button>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Clock size={28} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">Sync analytics to get recommendations</p>
            </div>
          )}
        </Card>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Top Videos */}
        <TopVideos videos={topVideos} loading={isLoading} />

        {/* Upcoming scheduled */}
        <Card>
          <CardHeader
            title="Upcoming Scheduled"
            subtitle="Next posts"
            icon={Zap}
            iconColor="amber"
            action={
              <Button variant="ghost" size="xs" onClick={() => navigate('/scheduler')}>
                View all
              </Button>
            }
          />

          {upcoming.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500 text-sm mb-4">No upcoming scheduled videos</p>
              <Button
                variant="ghost"
                size="sm"
                icon={Plus}
                onClick={() => navigate('/scheduler')}
              >
                Schedule a video
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {upcoming.map((s) => (
                <div key={s._id} className="flex items-center gap-3 p-3 glass rounded-xl">
                  <div className="w-12 h-8 rounded-lg overflow-hidden bg-base-600 shrink-0">
                    {s.videoId?.thumbnail?.url
                      ? <img src={s.videoId.thumbnail.url} className="w-full h-full object-cover" alt="" />
                      : <div className="w-full h-full bg-brand/20" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">
                      {s.videoId?.title || 'Untitled'}
                    </p>
                    <p className="text-2xs text-gray-500">
                      {formatDate(s.scheduledAt, 'datetime')}
                    </p>
                  </div>
                  <StatusBadge status="scheduled" />
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
