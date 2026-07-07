// src/pages/analytics/Analytics.jsx
import { useState, useEffect } from 'react'
import { BarChart3, RefreshCw, TrendingUp, Download } from 'lucide-react'
import { useChannelStore } from '../../store/channelStore'
import { analyticsApi } from '../../api/analytics.api'
import { KPIGrid } from '../../components/features/KPICard'
import { TopVideos } from '../../components/features/TopVideos'
import { TrafficSources } from '../../components/features/TrafficSources'
import { AreaLineChart } from '../../components/charts/LineChart'
import { DayWiseBar } from '../../components/charts/BarChart'
import { Card, CardHeader } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { PERIODS } from '../../utils/constants'
import toast from 'react-hot-toast'

const METRIC_TABS = [
  { key: 'views', label: 'Views', color: '#4F46E5' },
  { key: 'subscribers', label: 'Subscribers', color: '#06B6D4' },
  { key: 'watchTime', label: 'Watch Time', color: '#10B981' },
  { key: 'ctr', label: 'CTR', color: '#F59E0B' },
  { key: 'revenue', label: 'Revenue', color: '#A855F7' },
]

export const Analytics = () => {
  const { activeChannel } = useChannelStore()
  const channelId = activeChannel?._id

  const [period, setPeriod] = useState('30d')
  const [activeMetric, setActiveMetric] = useState('views')
  const [syncing, setSyncing] = useState(false)
  const [exporting, setExporting] = useState(false)

  const [overview, setOverview] = useState(null)
  const [graphData, setGraphData] = useState(null)
  const [dayWise, setDayWise] = useState(null)
  const [topVideos, setTopVideos] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchAll = async () => {
    if (!channelId) return
    setLoading(true)
    try {
      const [ov, gr, dw, tv] = await Promise.all([
        analyticsApi.getOverview(channelId, period),
        analyticsApi.getDailyGraph(channelId, period, activeMetric),
        analyticsApi.getDayWise(channelId, '90d'),
        analyticsApi.getTopVideos(channelId, 8, 'views'),
      ])
      setOverview(ov.data.data)
      setGraphData(gr.data.data)
      setDayWise(dw.data.data)
      setTopVideos(tv.data.data?.videos || [])
    } catch {
      toast.error('Failed to fetch analytics')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAll()
  }, [channelId, period])

  // Refetch only graph when metric changes
  useEffect(() => {
    if (!channelId) return
    analyticsApi
      .getDailyGraph(channelId, period, activeMetric)
      .then((res) => setGraphData(res.data.data))
      .catch(() => {})
  }, [activeMetric, channelId, period])

  // Pull enough history for the selected tab (incl. its previous-period delta where cheap)
  const SYNC_DAYS = { '7d': 60, '30d': 90, '90d': 180, '365d': 365 }

  const handleExport = async (format) => {
    if (!channelId || exporting) return
    setExporting(true)
    try {
      const res = await analyticsApi.exportReport(channelId, period, format)
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url
      const date = new Date().toISOString().slice(0, 10)
      a.download = `tubeos-analytics-${period}-${date}.${format}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success(`${format.toUpperCase()} downloaded!`)
    } catch {
      toast.error('Export failed')
    } finally {
      setExporting(false)
    }
  }

  const handleSync = async () => {
    if (!channelId) return
    setSyncing(true)
    try {
      await analyticsApi.sync(channelId, SYNC_DAYS[period] || 180)
      await fetchAll()
      toast.success('Analytics synced!')
    } catch {
      toast.error('Sync failed')
    } finally {
      setSyncing(false)
    }
  }

  if (!channelId) {
    return (
      <div className="text-center py-20 text-gray-500">
        <BarChart3 size={40} className="mx-auto mb-4 opacity-30" />
        <p>Connect a YouTube channel to view analytics</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center glass rounded-xl p-1">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all
                          ${period === p.value ? 'bg-brand text-white' : 'text-gray-400 hover:text-white'}`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {/* Export dropdown */}
          <div className="relative group">
            <Button variant="ghost" size="sm" icon={Download} loading={exporting}>
              Export
            </Button>
            <div className="absolute right-0 top-full mt-1 hidden group-hover:flex flex-col glass rounded-xl shadow-lg z-20 min-w-[110px] overflow-hidden">
              <button
                onClick={() => handleExport('csv')}
                className="px-4 py-2.5 text-xs text-left text-gray-300 hover:bg-white/10 hover:text-white transition-colors"
              >
                Download CSV
              </button>
              <button
                onClick={() => handleExport('pdf')}
                className="px-4 py-2.5 text-xs text-left text-gray-300 hover:bg-white/10 hover:text-white transition-colors"
              >
                Download PDF
              </button>
            </div>
          </div>

          <Button variant="ghost" size="sm" icon={RefreshCw} onClick={handleSync} loading={syncing}>
            Sync Data
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <KPIGrid overview={overview} loading={loading} period={period} />

      {/* Chart with metric tabs */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <CardHeader title="Performance Over Time" icon={TrendingUp} />
          <div className="flex items-center glass rounded-xl p-1">
            {METRIC_TABS.map((m) => (
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

        {loading ? (
          <div className="shimmer h-56 rounded-xl" />
        ) : (
          <AreaLineChart
            data={graphData?.data || []}
            dataKey="value"
            label={METRIC_TABS.find((m) => m.key === activeMetric)?.label}
            color={METRIC_TABS.find((m) => m.key === activeMetric)?.color || '#4F46E5'}
            height={240}
          />
        )}
      </Card>

      {/* Day-wise + Traffic */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card>
          <CardHeader
            title="Day-wise Performance"
            subtitle="Avg views by day of week"
            icon={BarChart3}
          />
          {loading ? (
            <div className="shimmer h-48 rounded-xl" />
          ) : (
            <>
              <DayWiseBar data={dayWise?.data || []} height={200} />
              {dayWise?.bestDay && (
                <div className="mt-3 flex items-center gap-3">
                  <div className="px-3 py-1.5 bg-emerald/10 border border-emerald/20 rounded-lg">
                    <span className="text-xs text-emerald font-medium">
                      🏆 Best: {dayWise.bestDay.day}
                    </span>
                  </div>
                  {dayWise?.worstDay && (
                    <div className="px-3 py-1.5 bg-rose/10 border border-rose/20 rounded-lg">
                      <span className="text-xs text-rose font-medium">
                        ⚠️ Avoid: {dayWise.worstDay.day}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </Card>

        <TrafficSources channelId={channelId} period={period} />
      </div>

      {/* Top Videos */}
      <TopVideos videos={topVideos} loading={loading} title="Top Performing Videos" />
    </div>
  )
}
