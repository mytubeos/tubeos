// src/components/charts/HeatmapGrid.jsx
import { useState } from 'react'

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const HOUR_LABELS = Array.from({ length: 24 }, (_, i) => {
  const h = i % 12 || 12
  return i < 12 ? `${h}am` : `${h}pm`
})

const getColor = (score) => {
  if (score >= 80) return 'bg-emerald opacity-90'
  if (score >= 60) return 'bg-emerald opacity-60'
  if (score >= 40) return 'bg-brand opacity-70'
  if (score >= 20) return 'bg-brand opacity-40'
  if (score >= 5)  return 'bg-white opacity-5'
  return 'bg-white opacity-[0.02]'
}

const getInlineColor = (score) => {
  if (score >= 80) return `rgba(16,185,129,${0.3 + (score/100)*0.7})`
  if (score >= 60) return `rgba(16,185,129,${0.2 + (score/100)*0.5})`
  if (score >= 40) return `rgba(79,70,229,${0.3 + (score/100)*0.5})`
  if (score >= 20) return `rgba(79,70,229,${0.15 + (score/100)*0.3})`
  if (score >= 5)  return 'rgba(255,255,255,0.04)'
  return 'rgba(255,255,255,0.02)'
}

export const HeatmapGrid = ({ grid = [], bestSlots = [], className = '' }) => {
  const [tooltip, setTooltip] = useState(null)

  const isBestSlot = (day, hour) =>
    bestSlots.slice(0, 5).some(s => s.day === day && s.hour === hour)

  return (
    <div className={`overflow-x-auto ${className}`}>
      <div className="min-w-[600px]">
        {/* Hour labels */}
        <div className="flex mb-1 pl-10">
          {HOUR_LABELS.map((h, i) => (
            <div key={i} className="flex-1 text-center text-2xs text-gray-600">
              {i % 3 === 0 ? h : ''}
            </div>
          ))}
        </div>

        {/* Grid rows */}
        {DAY_LABELS.map((day, dayIdx) => (
          <div key={dayIdx} className="flex items-center mb-1">
            {/* Day label */}
            <div className="w-9 text-right pr-2 text-2xs text-gray-500 shrink-0">{day}</div>

            {/* Cells */}
            {(grid[dayIdx] || Array(24).fill(0)).map((score, hourIdx) => {
              const best = isBestSlot(dayIdx, hourIdx)
              return (
                <div
                  key={hourIdx}
                  className="flex-1 mx-px"
                  onMouseEnter={() => setTooltip({ day, hour: HOUR_LABELS[hourIdx], score, dayIdx, hourIdx })}
                  onMouseLeave={() => setTooltip(null)}
                >
                  <div
                    className={`h-5 rounded-sm transition-all duration-200 cursor-pointer
                                hover:ring-1 hover:ring-white/20
                                ${best ? 'ring-1 ring-emerald/60' : ''}`}
                    style={{ background: getInlineColor(score) }}
                  />
                </div>
              )
            })}
          </div>
        ))}

        {/* Tooltip */}
        {tooltip && (
          <div className="mt-3 px-3 py-2 glass rounded-lg inline-flex items-center gap-3 text-sm">
            <div
              className="w-3 h-3 rounded-sm"
              style={{ background: getInlineColor(tooltip.score) }}
            />
            <span className="text-gray-400">
              {tooltip.day} at {tooltip.hour}
            </span>
            <span className="text-white font-semibold">
              Score: {tooltip.score}/100
            </span>
            {tooltip.score >= 70 && (
              <span className="text-emerald text-xs">🔥 Peak time</span>
            )}
            {tooltip.score <= 15 && (
              <span className="text-rose text-xs">😴 Low traffic</span>
            )}
          </div>
        )}

        {/* Legend */}
        <div className="flex items-center gap-4 mt-4 pt-3 border-t border-white/5">
          <span className="text-2xs text-gray-600">Activity:</span>
          {[
            { label: 'Low', color: 'rgba(255,255,255,0.04)' },
            { label: 'Medium', color: 'rgba(79,70,229,0.35)' },
            { label: 'High', color: 'rgba(16,185,129,0.5)' },
            { label: 'Peak', color: 'rgba(16,185,129,0.9)' },
          ].map(({ label, color }) => (
            <div key={label} className="flex items-center gap-1.5">
              <div className="w-4 h-3 rounded-sm" style={{ background: color }} />
              <span className="text-2xs text-gray-500">{label}</span>
            </div>
          ))}
          <div className="flex items-center gap-1.5 ml-2">
            <div className="w-4 h-3 rounded-sm ring-1 ring-emerald/60" style={{ background: 'rgba(16,185,129,0.9)' }} />
            <span className="text-2xs text-emerald">Best slots</span>
          </div>
        </div>
      </div>
    </div>
  )
}
