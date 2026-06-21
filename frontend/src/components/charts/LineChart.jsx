// src/components/charts/LineChart.jsx
import {
  AreaChart, Area, LineChart as ReLineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'
import { formatNumber } from '../../utils/formatters'

// Custom tooltip
const CustomTooltip = ({ active, payload, label, formatter }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-base-600 border border-white/10 rounded-xl px-4 py-3 shadow-2xl">
      <p className="text-gray-400 text-xs mb-2">{label}</p>
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center gap-2 text-sm">
          <span className="w-2 h-2 rounded-full" style={{ background: entry.color }} />
          <span className="text-gray-300">{entry.name}:</span>
          <span className="text-white font-semibold">
            {formatter ? formatter(entry.value) : formatNumber(entry.value)}
          </span>
        </div>
      ))}
    </div>
  )
}

export const AreaLineChart = ({
  data = [], dataKey = 'value', label = 'Value',
  color = '#4F46E5', height = 220,
  formatter, gradientId = 'chartGrad',
  secondDataKey, secondLabel, secondColor = '#06B6D4',
  xKey = 'date',
}) => (
  <ResponsiveContainer width="100%" height={height}>
    <AreaChart data={data} margin={{ top: 8, right: 4, left: -20, bottom: 0 }}>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="5%" stopColor={color} stopOpacity={0.3} />
          <stop offset="95%" stopColor={color} stopOpacity={0} />
        </linearGradient>
        {secondDataKey && (
          <linearGradient id={`${gradientId}2`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={secondColor} stopOpacity={0.25} />
            <stop offset="95%" stopColor={secondColor} stopOpacity={0} />
          </linearGradient>
        )}
      </defs>

      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />

      <XAxis
        dataKey={xKey}
        tick={{ fill: '#6B7280', fontSize: 11 }}
        axisLine={false}
        tickLine={false}
        tickFormatter={(v) => {
          const d = new Date(v)
          return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })
        }}
      />

      <YAxis
        tick={{ fill: '#6B7280', fontSize: 11 }}
        axisLine={false}
        tickLine={false}
        tickFormatter={(v) => formatNumber(v)}
      />

      <Tooltip
        content={<CustomTooltip formatter={formatter} />}
        cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1 }}
      />

      <Area
        type="monotone"
        dataKey={dataKey}
        name={label}
        stroke={color}
        strokeWidth={2}
        fill={`url(#${gradientId})`}
        dot={false}
        activeDot={{ r: 5, fill: color, stroke: '#06060A', strokeWidth: 2 }}
      />

      {secondDataKey && (
        <Area
          type="monotone"
          dataKey={secondDataKey}
          name={secondLabel}
          stroke={secondColor}
          strokeWidth={2}
          fill={`url(#${gradientId}2)`}
          dot={false}
          activeDot={{ r: 5, fill: secondColor, stroke: '#06060A', strokeWidth: 2 }}
        />
      )}
    </AreaChart>
  </ResponsiveContainer>
)

export const MultiLineChart = ({ data = [], lines = [], height = 220, xKey = 'date' }) => (
  <ResponsiveContainer width="100%" height={height}>
    <ReLineChart data={data} margin={{ top: 8, right: 4, left: -20, bottom: 0 }}>
      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
      <XAxis
        dataKey={xKey}
        tick={{ fill: '#6B7280', fontSize: 11 }}
        axisLine={false}
        tickLine={false}
        tickFormatter={(v) => new Date(v).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
      />
      <YAxis
        tick={{ fill: '#6B7280', fontSize: 11 }}
        axisLine={false}
        tickLine={false}
        tickFormatter={formatNumber}
      />
      <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.08)' }} />
      <Legend
        wrapperStyle={{ paddingTop: '16px', fontSize: '12px', color: '#9CA3AF' }}
      />
      {lines.map(({ key, label, color }) => (
        <Line
          key={key}
          type="monotone"
          dataKey={key}
          name={label}
          stroke={color}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, stroke: '#06060A', strokeWidth: 2 }}
        />
      ))}
    </ReLineChart>
  </ResponsiveContainer>
)
