// src/pages/scheduler/ScheduleForm.jsx
import { useState, useEffect } from 'react'
import { Zap, Search } from 'lucide-react'
import { videoApi } from '../../api/video.api'
import { scheduleApi } from '../../api/schedule.api'
import { useChannelStore } from '../../store/channelStore'
import { Input } from '../../components/ui/Input'
import { Button } from '../../components/ui/Button'
import { BestTimeWidget } from '../../components/features/BestTimeWidget'
import { formatDate } from '../../utils/formatters'
import { StatusBadge } from '../../components/ui/Badge'
import toast from 'react-hot-toast'

export const ScheduleForm = ({ prefilledDate, prefilledTime, onSuccess, onCancel }) => {
  const { activeChannel } = useChannelStore()

  const [videos, setVideos] = useState([])
  const [selectedVideo, setSelectedVideo] = useState(null)
  const [scheduledAt, setScheduledAt] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [search, setSearch] = useState('')

  // Pre-fill datetime
  useEffect(() => {
    if (prefilledTime) {
      const d = new Date(prefilledTime)
      setScheduledAt(d.toISOString().slice(0, 16))
    } else if (prefilledDate) {
      setScheduledAt(`${prefilledDate}T19:00`)
    } else {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      tomorrow.setHours(19, 0, 0, 0)
      setScheduledAt(tomorrow.toISOString().slice(0, 16))
    }
  }, [prefilledDate, prefilledTime])

  // Load draft videos
  useEffect(() => {
    if (!activeChannel?._id) return
    setLoading(true)
    videoApi.getAll({ status: 'draft', channelId: activeChannel._id, limit: 20 })
      .then(res => setVideos(res.data.data || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [activeChannel?._id])

  const filtered = videos.filter(v =>
    v.title.toLowerCase().includes(search.toLowerCase())
  )

  const handleSubmit = async () => {
    if (!selectedVideo) { toast.error('Please select a video'); return }
    if (!scheduledAt) { toast.error('Please set a schedule time'); return }

    const scheduleDate = new Date(scheduledAt)
    if (scheduleDate <= new Date()) {
      toast.error('Schedule time must be in the future')
      return
    }

    setSubmitting(true)
    try {
      await scheduleApi.create({
        videoId: selectedVideo._id,
        scheduledAt: scheduleDate.toISOString(),
      })
      toast.success('Video scheduled!')
      onSuccess?.()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to schedule')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-5">

      {/* Video picker */}
      <div>
        <label className="text-sm font-medium text-gray-300 mb-2 block">Select Video Draft</label>
        <Input
          placeholder="Search videos..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          icon={Search}
          className="mb-3"
        />

        {loading ? (
          <div className="space-y-2">
            {Array(3).fill(0).map((_, i) => <div key={i} className="shimmer h-14 rounded-xl" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p className="text-sm">No draft videos found.</p>
            <p className="text-xs mt-1">Upload a video first to schedule it.</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
            {filtered.map(video => (
              <button
                key={video._id}
                onClick={() => setSelectedVideo(video)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl text-left
                            transition-all
                            ${selectedVideo?._id === video._id
                              ? 'bg-brand/15 border border-brand/30'
                              : 'glass hover:border-white/15'}`}
              >
                <div className="w-14 h-9 rounded-lg overflow-hidden bg-base-600 shrink-0">
                  {video.thumbnail?.url
                    ? <img src={video.thumbnail.url} className="w-full h-full object-cover" alt="" />
                    : <div className="w-full h-full bg-brand/20" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{video.title}</p>
                  <p className="text-2xs text-gray-500 truncate">{video.description?.substring(0, 50) || 'No description'}</p>
                </div>
                <StatusBadge status={video.status} />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Schedule time */}
      <div>
        <label className="text-sm font-medium text-gray-300 mb-2 block">Schedule Date & Time</label>
        <input
          type="datetime-local"
          value={scheduledAt}
          onChange={e => setScheduledAt(e.target.value)}
          className="input-field"
          min={new Date().toISOString().slice(0, 16)}
        />
      </div>

      {/* AI best time */}
      <BestTimeWidget onSelectTime={(time) => {
        setScheduledAt(new Date(time).toISOString().slice(0, 16))
        toast.success('Best time auto-filled!')
      }} />

      {/* Actions */}
      <div className="flex items-center gap-3 pt-2">
        <Button variant="ghost" onClick={onCancel} fullWidth>Cancel</Button>
        <Button
          onClick={handleSubmit}
          loading={submitting}
          disabled={!selectedVideo || !scheduledAt}
          fullWidth
        >
          Schedule Video
        </Button>
      </div>
    </div>
  )
}
