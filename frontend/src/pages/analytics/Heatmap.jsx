// src/pages/analytics/Heatmap.jsx
import { useState, useEffect } from 'react'
import { Flame, RefreshCw, Clock, AlertTriangle, Zap, Calendar } from 'lucide-react'
import { useChannelStore } from '../../store/channelStore'
import { analyticsApi } from '../../api/analytics.api'
import { HeatmapGrid } from '../../components/charts/HeatmapGrid'
import { Card, CardHeader } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { scheduleApi } from '../../api/schedule.api'
import { formatDate } from '../../utils/formatters'
import toast from 'react-hot-toast'

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export const Heatmap = () => {
  const { activeChannel } = useChannelStore()
  const channelId = activeChannel?._id

  const [heatmap, setHeatmap] = useState(null)
  const [bestSlots, setBestSlots] = useState(null)
  const [lowTraffic, setLowTraffic] = useState(null)
  const [loading, setLoading] = useState(true)
  const [rebuilding, setRebuilding] = useState(false)

  const fetchData = async () => {
    if (!channelId) return
    setLoading(true)
    try {
      const [hm, bs, lt] = await Promise.all([
        analyticsApi.getHeatmap(channelId),
        analyticsApi.getBestTime(channelId, 6),
        analyticsApi.getLowTraffic(channelId),
      ])
      setHeatmap(hm.data.data)
      setBestSlots(bs.data.data)
      setLowTraffic(lt.data.data)
    } catch {
      toast.error('Failed to load heatmap')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [channelId])

  const handleRebuild = async () => {
    if (!channelId) return
    setRebuilding(true)
    try {
      await analyticsApi.rebuildHeatmap(channelId)
      await fetchData()
      toast.success('Heatmap rebuilt!')
    } catch {
      toast.error('Rebuild failed')
    } finally {
      setRebuilding(false)
    }
  }

  if (!channelId) {
    return (
      <div className="text-center py-20 text-gray-500">
        <Flame size={40} className="mx-auto mb-4 opacity-30" />
        <p>Connect a YouTube channel to view time intelligence</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-gray-500 text-sm">Audience activity analysis for {activeChannel.channelName}</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          icon={RefreshCw}
          onClick={handleRebuild}
          loading={rebuilding}
        >
          Rebuild
        </Button>
      </div>

      {/* Confidence badge */}
      {heatmap && (
        <div className={`flex items-center gap-3 p-4 rounded-xl border
                         ${heatmap.confidence === 'high'
                           ? 'bg-emerald/5 border-emerald/20'
                           : heatmap.confidence === 'medium'
                           ? 'bg-amber/5 border-amber/20'
                           : 'bg-white/5 border-white/10'}`}>
          <Zap size={18} className={
            heatmap.confidence === 'high' ? 'text-emerald'
            : heatmap.confidence === 'medium' ? 'text-amber'
            : 'text-gray-400'
          } />
          <div>
            <p className="text-sm font-medium text-white capitalize">
              {heatmap.confidence} confidence · {heatmap.dataPoints} data points
            </p>
            <p className="text-xs text-gray-500">
              {heatmap.confidence === 'low'
                ? 'Sync more analytics data for personalized insights'
                : `Based on ${heatmap.basedOnDays} days of audience data`}
            </p>
          </div>
          {heatmap.calculatedAt && (
            <span className="ml-auto text-2xs text-gray-600">
              Updated {formatDate(heatmap.calculatedAt, 'medium')}
            </span>
          )}
        </div>
      )}

      {/* Heatmap grid */}
      <Card>
        <CardHeader
          title="7×24 Audience Activity Heatmap"
          subtitle="When your audience is most active"
          icon={Flame}
          iconColor="rose"
        />
        {loading ? (
          <div className="shimmer h-48 rounded-xl" />
        ) : (
          <HeatmapGrid
            grid={heatmap?.grid || []}
            bestSlots={heatmap?.bestSlots || []}
          />
        )}
      </Card>

      {/* Best time slots + Low traffic */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Best slots */}
        <Card>
          <CardHeader title="Best Times to Post" subtitle="Highest audience activity" icon={Clock} iconColor="emerald" />
          {loading ? (
            <div className="space-y-3">
              {Array(5).fill(0).map((_, i) => <div key={i} className="shimmer h-14 rounded-xl" />)}
            </div>
          ) : (
            <div className="space-y-2">
              {(bestSlots?.nextOptimalSlots || []).map((slot, i) => (
                <div
                  key={i}
                  className={`flex items-center justify-between p-3 rounded-xl transition-all
                              ${i === 0
                                ? 'bg-emerald/10 border border-emerald/25'
                                : 'glass hover:bg-white/[0.06]'}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm
                                    ${i === 0 ? 'bg-emerald/20' : 'bg-white/5'}`}>
                      {i === 0 ? '⚡' : `#${i + 1}`}
                    </div>
                    <div>
                      <p className={`text-sm font-medium ${i === 0 ? 'text-emerald' : 'text-white'}`}>
                        {new Date(slot.datetime).toLocaleDateString('en-IN', {
                          weekday: 'long', month: 'short', day: 'numeric'
                        })}
                      </p>
                      <p className="text-xs text-gray-500">{slot.time}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-bold ${i === 0 ? 'text-emerald' : 'text-brand'}`}>
                      {slot.score}/100
                    </p>
                  </div>
                </div>
              ))}

              {(!bestSlots?.nextOptimalSlots?.length) && (
                <p className="text-center text-gray-500 text-sm py-4">
                  Sync analytics to get personalized recommendations
                </p>
              )}
            </div>
          )}
        </Card>

        {/* Avoid times */}
        <Card>
          <CardHeader
            title="Low Traffic Hours"
            subtitle="Avoid posting at these times"
            icon={AlertTriangle}
            iconColor="rose"
          />
          {loading ? (
            <div className="space-y-3">
              {Array(4).fill(0).map((_, i) => <div key={i} className="shimmer h-12 rounded-xl" />)}
            </div>
          ) : (
            <div className="space-y-2">
              {(lowTraffic?.avoidSlots || []).map((slot, i) => (
                <div key={i} className="flex items-center justify-between p-3 glass rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-rose/10 flex items-center justify-center text-sm">
                      😴
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">
                        {DAY_NAMES[slot.day]} at {slot.label}
                      </p>
                      <p className="text-xs text-gray-600">Activity score: {slot.score}/100</p>
                    </div>
                  </div>
                  <Badge variant="rose" size="xs">Avoid</Badge>
                </div>
              ))}

              {lowTraffic?.avoidDays?.length > 0 && (
                <div className="mt-3 p-3 bg-rose/5 border border-rose/15 rounded-xl">
                  <p className="text-xs text-gray-400 mb-1.5">Worst days overall:</p>
                  <div className="flex flex-wrap gap-2">
                    {lowTraffic.avoidDays.map(d => (
                      <Badge key={d} variant="rose" size="xs">{d}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
