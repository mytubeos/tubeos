// src/components/features/CalendarView.jsx
import { useState } from 'react'
import { ChevronLeft, ChevronRight, Clock, Zap } from 'lucide-react'
import { formatDate } from '../../utils/formatters'

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']

const StatusDot = ({ status }) => {
  const colors = {
    pending: 'bg-brand',
    published: 'bg-emerald',
    failed: 'bg-rose',
    cancelled: 'bg-gray-500',
  }
  return <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${colors[status] || 'bg-gray-500'}`} />
}

export const CalendarView = ({ calendar = {}, onDayClick, loading = false }) => {
  const today = new Date()
  const [current, setCurrent] = useState(new Date(today.getFullYear(), today.getMonth(), 1))

  const year = current.getFullYear()
  const month = current.getMonth()

  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const prevMonthDays = new Date(year, month, 0).getDate()

  const cells = []

  // Prev month padding
  for (let i = firstDay - 1; i >= 0; i--) {
    cells.push({ day: prevMonthDays - i, currentMonth: false, date: null })
  }

  // Current month
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    cells.push({
      day: d,
      currentMonth: true,
      date: dateStr,
      isToday: d === today.getDate() && month === today.getMonth() && year === today.getFullYear(),
      isSelected: false,
      schedules: calendar[dateStr] || [],
    })
  }

  // Next month padding
  const remaining = 42 - cells.length
  for (let d = 1; d <= remaining; d++) {
    cells.push({ day: d, currentMonth: false, date: null })
  }

  const weeks = []
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7))
  }

  const prevMonth = () => setCurrent(new Date(year, month - 1, 1))
  const nextMonth = () => setCurrent(new Date(year, month + 1, 1))

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display font-semibold text-white text-lg">
          {MONTH_NAMES[month]} {year}
        </h3>
        <div className="flex items-center gap-1">
          <button
            onClick={prevMonth}
            className="w-8 h-8 rounded-lg flex items-center justify-center
                       text-gray-400 hover:text-white hover:bg-white/8 transition-all"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={() => setCurrent(new Date(today.getFullYear(), today.getMonth(), 1))}
            className="px-3 py-1 rounded-lg text-xs text-gray-400 hover:text-white hover:bg-white/8 transition-all"
          >
            Today
          </button>
          <button
            onClick={nextMonth}
            className="w-8 h-8 rounded-lg flex items-center justify-center
                       text-gray-400 hover:text-white hover:bg-white/8 transition-all"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 mb-2">
        {DAY_NAMES.map(d => (
          <div key={d} className="text-center text-2xs font-semibold text-gray-600 uppercase py-2">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      {loading ? (
        <div className="shimmer h-64 rounded-xl" />
      ) : (
        <div className="space-y-1">
          {weeks.map((week, wi) => (
            <div key={wi} className="grid grid-cols-7 gap-1">
              {week.map((cell, di) => (
                <div
                  key={di}
                  onClick={() => cell.currentMonth && cell.date && onDayClick?.(cell)}
                  className={`min-h-[72px] p-1.5 rounded-xl transition-all
                              ${cell.currentMonth
                                ? 'cursor-pointer hover:bg-white/[0.05]'
                                : 'opacity-30'}
                              ${cell.isToday ? 'ring-1 ring-brand/50 bg-brand/5' : 'bg-white/[0.02]'}
                              ${cell.schedules?.length > 0 ? 'border border-white/8' : ''}`}
                >
                  <div className={`text-xs font-medium mb-1.5 w-6 h-6 flex items-center justify-center rounded-full
                                   ${cell.isToday
                                     ? 'bg-brand text-white'
                                     : cell.currentMonth ? 'text-gray-300' : 'text-gray-600'}`}>
                    {cell.day}
                  </div>

                  {/* Schedule dots */}
                  <div className="space-y-0.5">
                    {(cell.schedules || []).slice(0, 2).map((s, i) => (
                      <div key={i} className="flex items-center gap-1 overflow-hidden">
                        <StatusDot status={s.status} />
                        <span className="text-2xs text-gray-400 truncate leading-none">
                          {s.video?.title || 'Video'}
                        </span>
                      </div>
                    ))}
                    {(cell.schedules || []).length > 2 && (
                      <p className="text-2xs text-gray-600">+{cell.schedules.length - 2} more</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 mt-4 pt-3 border-t border-white/5">
        {[
          { color: 'bg-brand', label: 'Scheduled' },
          { color: 'bg-emerald', label: 'Published' },
          { color: 'bg-rose', label: 'Failed' },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${color}`} />
            <span className="text-2xs text-gray-500">{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
