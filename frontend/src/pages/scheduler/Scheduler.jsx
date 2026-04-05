// src/pages/scheduler/Scheduler.jsx
import { useState, useEffect } from 'react'
import { Plus, Calendar, List, Zap, Clock } from 'lucide-react'
import { useChannelStore } from '../../store/channelStore'
import { scheduleApi } from '../../api/schedule.api'
import { CalendarView } from '../../components/features/CalendarView'
import { BestTimeWidget } from '../../components/features/BestTimeWidget'
import { VideoCard } from '../../components/features/VideoCard'
import { Card, CardHeader } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Badge, StatusBadge } from '../../components/ui/Badge'
import { Modal, ConfirmModal } from '../../components/ui/Modal'
import { formatDate, formatNumber } from '../../utils/formatters'
import { ScheduleForm } from './ScheduleForm'
import toast from 'react-hot-toast'

export const Scheduler = () => {
  const { activeChannel } = useChannelStore()
  const channelId = activeChannel?._id

  const today = new Date()
  const [view, setView] = useState('calendar') // calendar | list
  const [calendar, setCalendar] = useState({})
  const [schedules, setSchedules] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [selectedDay, setSelectedDay] = useState(null)
  const [cancelId, setCancelId] = useState(null)
  const [cancelling, setCancelling] = useState(false)
  const [queueStats, setQueueStats] = useState(null)

  const fetchData = async () => {
    if (!channelId) return
    setLoading(true)
    try {
      const year = today.getFullYear()
      const month = today.getMonth() + 1
      const [calRes, listRes, statsRes] = await Promise.all([
        scheduleApi.getCalendar(year, month),
        scheduleApi.getAll({ status: 'pending', limit: 10, channelId }),
        scheduleApi.getQueueStats(),
      ])
      setCalendar(calRes.data.data?.calendar || {})
      setSchedules(listRes.data.data || [])
      setQueueStats(statsRes.data.data?.stats)
    } catch {
      toast.error('Failed to load schedules')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [channelId])

  const handleCancel = async () => {
    if (!cancelId) return
    setCancelling(true)
    try {
      await scheduleApi.cancel(cancelId)
      toast.success('Schedule cancelled')
      setSchedules(prev => prev.filter(s => s.videoId !== cancelId))
      await fetchData()
    } catch {
      toast.error('Failed to cancel')
    } finally {
      setCancelling(false)
      setCancelId(null)
    }
  }

  const handleDayClick = (cell) => {
    setSelectedDay(cell)
    setShowForm(true)
  }

  if (!channelId) {
    return (
      <div className="text-center py-20 text-gray-500">
        <Calendar size={40} className="mx-auto mb-4 opacity-30" />
        <p>Connect a YouTube channel to use the scheduler</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center glass rounded-xl p-1">
          <button
            onClick={() => setView('calendar')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-all
                        ${view === 'calendar' ? 'bg-brand text-white' : 'text-gray-400 hover:text-white'}`}
          >
            <Calendar size={15} /> Calendar
          </button>
          <button
            onClick={() => setView('list')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-all
                        ${view === 'list' ? 'bg-brand text-white' : 'text-gray-400 hover:text-white'}`}
          >
            <List size={15} /> List
          </button>
        </div>

        <Button icon={Plus} onClick={() => setShowForm(true)}>
          Schedule Video
        </Button>
      </div>

      {/* Queue stats bar */}
      {queueStats && (
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Waiting', value: queueStats.delayed || 0, color: 'brand' },
            { label: 'Active', value: queueStats.active || 0, color: 'cyan', dot: true },
            { label: 'Published', value: queueStats.completed || 0, color: 'emerald' },
            { label: 'Failed', value: queueStats.failed || 0, color: 'rose' },
          ].map(({ label, value, color, dot }) => (
            <div key={label} className="glass p-3 rounded-xl text-center">
              <p className={`font-display font-bold text-xl text-${color}`}>{value}</p>
              <div className="flex items-center justify-center gap-1.5 mt-1">
                {dot && <span className={`w-1.5 h-1.5 rounded-full bg-${color} animate-pulse`} />}
                <p className="text-xs text-gray-500">{label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Main content */}
        <div className="lg:col-span-2">
          {view === 'calendar' ? (
            <Card>
              <CalendarView
                calendar={calendar}
                onDayClick={handleDayClick}
                loading={loading}
              />
            </Card>
          ) : (
            <Card>
              <CardHeader title="Upcoming Schedules" subtitle="Sorted by time" icon={Clock} />
              {loading ? (
                <div className="space-y-3">
                  {Array(5).fill(0).map((_, i) => (
                    <div key={i} className="shimmer h-20 rounded-xl" />
                  ))}
                </div>
              ) : schedules.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Calendar size={32} className="mx-auto mb-3 opacity-30" />
                  <p className="text-sm mb-4">No upcoming scheduled videos</p>
                  <Button variant="ghost" icon={Plus} onClick={() => setShowForm(true)}>
                    Schedule a video
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {schedules.map(s => (
                    <div key={s._id} className="flex items-center gap-3 p-3 glass rounded-xl">
                      <div className="w-16 h-10 rounded-lg overflow-hidden bg-base-600 shrink-0">
                        {s.videoId?.thumbnail?.url
                          ? <img src={s.videoId.thumbnail.url} className="w-full h-full object-cover" alt="" />
                          : <div className="w-full h-full bg-brand/20" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">
                          {s.videoId?.title || 'Untitled'}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <p className="text-2xs text-gray-500">
                            {formatDate(s.scheduledAt, 'datetime')}
                          </p>
                          {s.isAiRecommended && (
                            <Badge variant="cyan" size="xs">
                              <Zap size={9} /> AI
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <StatusBadge status={s.status} />
                        <button
                          onClick={() => setCancelId(s.videoId?._id || s.videoId)}
                          className="text-xs text-gray-600 hover:text-rose transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <BestTimeWidget onSelectTime={(time) => {
            setSelectedDay({ prefilledTime: time })
            setShowForm(true)
          }} />

          {/* Legend */}
          <Card>
            <CardHeader title="How it Works" icon={Zap} iconColor="cyan" />
            <div className="space-y-3 text-sm text-gray-400">
              {[
                { step: '1', text: 'Upload or pick an existing video draft' },
                { step: '2', text: 'Choose a time or use AI recommendation' },
                { step: '3', text: 'Video auto-publishes at the scheduled time' },
              ].map(({ step, text }) => (
                <div key={step} className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-brand/15 text-brand text-xs
                                  flex items-center justify-center font-bold shrink-0 mt-0.5">
                    {step}
                  </div>
                  <p>{text}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {/* Schedule Form Modal */}
      <Modal
        isOpen={showForm}
        onClose={() => { setShowForm(false); setSelectedDay(null) }}
        title="Schedule Video"
        size="lg"
      >
        <ScheduleForm
          prefilledDate={selectedDay?.date}
          prefilledTime={selectedDay?.prefilledTime}
          onSuccess={() => {
            setShowForm(false)
            setSelectedDay(null)
            fetchData()
          }}
          onCancel={() => { setShowForm(false); setSelectedDay(null) }}
        />
      </Modal>

      {/* Cancel confirm */}
      <ConfirmModal
        isOpen={!!cancelId}
        onClose={() => setCancelId(null)}
        onConfirm={handleCancel}
        title="Cancel Schedule"
        message="This will cancel the scheduled post. The video draft will be kept."
        confirmLabel="Cancel Schedule"
        confirmVariant="danger"
        loading={cancelling}
      />
    </div>
  )
}
