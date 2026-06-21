// src/components/charts/BarChart.jsx
import {
  BarChart as ReBarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts'
import { formatNumber } from '../../utils/formatters'

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-base-600 border border-white/10 rounded-xl px-4 py-3 shadow-2xl">
      <p className="text-gray-400 text-xs mb-1.5">{label}</p>
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center gap-2 text-sm">
          <span className="w-2 h-2 rounded-sm" style={{ background: entry.fill }} />
          <span className="text-white font-semibold">{formatNumber(entry.value)}</span>
        </div>
      ))}
    </div>
  )
}

export const BarChart = ({
  data = [], dataKey = 'value', xKey = 'label',
  color = '#4F46E5', height = 200,
  highlightIndex = -1, horizontal = false,
  radius = 6,
}) => (
  <ResponsiveContainer width="100%" height={height}>
    <ReBarChart
      data={data}
      layout={horizontal ? 'vertical' : 'horizontal'}
      margin={{ top: 4, right: 4, left: horizontal ? 60 : -20, bottom: 0 }}
      barSize={horizontal ? 10 : undefined}
    >
      <CartesianGrid
        strokeDasharray="3 3"
        stroke="rgba(255,255,255,0.05)"
        horizontal={!horizontal}
        vertical={horizontal}
      />

      {horizontal ? (
        <>
          <XAxis type="number" tick={{ fill: '#6B7280', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={formatNumber} />
          <YAxis type="category" dataKey={xKey} tick={{ fill: '#9CA3AF', fontSize: 12 }} axisLine={false} tickLine={false} width={55} />
        </>
      ) : (
        <>
          <XAxis dataKey={xKey} tick={{ fill: '#9CA3AF', fontSize: 12 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: '#6B7280', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={formatNumber} />
        </>
      )}

      <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />

      <Bar dataKey={dataKey} radius={[radius, radius, 0, 0]} maxBarSize={48}>
        {data.map((_, idx) => (
          <Cell
            key={idx}
            fill={idx === highlightIndex ? '#10B981' : color}
            fillOpacity={highlightIndex >= 0 && idx !== highlightIndex ? 0.4 : 1}
          />
        ))}
      </Bar>
    </ReBarChart>
  </ResponsiveContainer>
)

// Day of week performance bar chart
export const DayWiseBar = ({ data = [], height = 200 }) => {
  const max = Math.max(...data.map(d => d.avgViews || 0))

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ReBarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }} barSize={28}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
        <XAxis dataKey="dayShort" tick={{ fill: '#9CA3AF', fontSize: 12 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: '#6B7280', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={formatNumber} />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
        <Bar dataKey="avgViews" radius={[6, 6, 0, 0]}>
          {data.map((entry, idx) => (
            <Cell
              key={idx}
              fill={entry.avgViews === max ? '#10B981' : '#4F46E5'}
              fillOpacity={entry.avgViews === max ? 1 : 0.6}
            />
          ))}
        </Bar>
      </ReBarChart>
    </ResponsiveContainer>
  )
}
