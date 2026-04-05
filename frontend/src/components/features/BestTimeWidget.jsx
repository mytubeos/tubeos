// src/components/features/BestTimeWidget.jsx
import { useState, useEffect } from 'react'
import { Zap, Clock } from 'lucide-react'
import { scheduleApi } from '../../api/schedule.api'
import { useChannelStore } from '../../store/channelStore'
import { Button } from '../ui/Button'

export const BestTimeWidget = ({ onSelectTime }) => {
  const { activeChannel } = useChannelStore()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!activeChannel?._id) return
    setLoading(true)
    scheduleApi.getBestTime(activeChannel._id)
      .then(res => setData(res.data.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [activeChannel?._id])

  if (loading) return <div className="shimmer h-32 rounded-xl" />

  const slots = data?.recommendation?.nextOptimalSlots || data?.nextOptimalSlots || []
  const bestSlot = slots[0]

  if (!bestSlot) return (
    <div className="glass p-4 rounded-xl text-center">
      <Clock size={20} className="mx-auto mb-2 text-gray-600" />
      <p className="text-xs text-gray-500">Sync analytics for AI time recommendations</p>
    </div>
  )

  return (
    <div className="glass p-4 rounded-xl border border-emerald/20 bg-emerald/5">
      <div className="flex items-center gap-2 mb-3">
        <Zap size={15} className="text-emerald" />
        <p className="text-xs font-semibold text-emerald">AI Best Time</p>
      </div>

      <div className="space-y-2 mb-3">
        {slots.slice(0, 3).map((slot, i) => (
          <button
            key={i}
            onClick={() => onSelectTime?.(slot.datetime)}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg
                        text-left transition-all
                        ${i === 0
                          ? 'bg-emerald/15 border border-emerald/25 hover:bg-emerald/20'
                          : 'hover:bg-white/5'}`}
          >
            <div>
              <p className={`text-xs font-medium ${i === 0 ? 'text-emerald' : 'text-gray-300'}`}>
                {new Date(slot.datetime).toLocaleDateString('en-IN', {
                  weekday: 'short', month: 'short', day: 'numeric'
                })}
              </p>
              <p className="text-2xs text-gray-500">{slot.time}</p>
            </div>
            <span className={`text-xs font-bold ${i === 0 ? 'text-emerald' : 'text-gray-500'}`}>
              {slot.score}/100
            </span>
          </button>
        ))}
      </div>

      <p className="text-2xs text-gray-600 text-center">
        {data?.message || 'Click a time to auto-fill schedule'}
      </p>
    </div>
  )
}
