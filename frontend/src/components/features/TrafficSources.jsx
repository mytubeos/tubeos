// src/components/features/TrafficSources.jsx
import { useState, useEffect } from 'react'
import { Radio } from 'lucide-react'
import { Card, CardHeader } from '../ui/Card'
import { TrafficDonut } from '../charts/DonutChart'
import { analyticsApi } from '../../api/analytics.api'
import { useChannelStore } from '../../store/channelStore'

export const TrafficSources = ({ channelId, period = '30d' }) => {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!channelId) return
    setLoading(true)
    analyticsApi.getTrafficSources(channelId, period)
      .then(res => setData(res.data.data?.sources || []))
      .catch(() => setData([]))
      .finally(() => setLoading(false))
  }, [channelId, period])

  return (
    <Card>
      <CardHeader title="Traffic Sources" subtitle="Where viewers find you" icon={Radio} />
      {loading ? (
        <div className="flex items-center gap-6">
          <div className="shimmer w-44 h-44 rounded-full" />
          <div className="flex-1 space-y-3">
            {Array(5).fill(0).map((_, i) => (
              <div key={i} className="shimmer h-4 rounded" style={{ width: `${60 + i * 8}%` }} />
            ))}
          </div>
        </div>
      ) : data.length === 0 ? (
        <p className="text-center text-gray-500 text-sm py-8">No traffic data yet</p>
      ) : (
        <TrafficDonut data={data} />
      )}
    </Card>
  )
}
