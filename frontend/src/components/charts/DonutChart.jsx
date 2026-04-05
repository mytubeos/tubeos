// src/components/charts/DonutChart.jsx
import {
  PieChart, Pie, Cell, Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { formatNumber } from '../../utils/formatters'

const COLORS = ['#4F46E5', '#06B6D4', '#10B981', '#F59E0B', '#F43F5E', '#A855F7', '#6B7280']

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null
  const { name, value, payload: p } = payload[0]
  return (
    <div className="bg-base-600 border border-white/10 rounded-xl px-4 py-3 shadow-2xl">
      <p className="text-gray-300 text-sm font-medium">{name}</p>
      <p className="text-white font-bold text-lg">{formatNumber(value)}</p>
      {p.percentage !== undefined && (
        <p className="text-gray-500 text-xs">{p.percentage}% of total</p>
      )}
    </div>
  )
}

export const DonutChart = ({
  data = [], nameKey = 'name', valueKey = 'value',
  height = 200, innerRadius = 55, outerRadius = 80,
}) => (
  <ResponsiveContainer width="100%" height={height}>
    <PieChart>
      <Pie
        data={data}
        cx="50%"
        cy="50%"
        innerRadius={innerRadius}
        outerRadius={outerRadius}
        dataKey={valueKey}
        nameKey={nameKey}
        strokeWidth={0}
        paddingAngle={3}
      >
        {data.map((_, idx) => (
          <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
        ))}
      </Pie>
      <Tooltip content={<CustomTooltip />} />
    </PieChart>
  </ResponsiveContainer>
)

// Traffic sources with legend
export const TrafficDonut = ({ data = [] }) => {
  const total = data.reduce((s, d) => s + (d.value || 0), 0)

  return (
    <div className="flex items-center gap-6">
      <div className="shrink-0">
        <DonutChart data={data} height={180} />
      </div>

      <div className="flex-1 space-y-2.5 min-w-0">
        {data.slice(0, 6).map((item, idx) => (
          <div key={item.name} className="flex items-center gap-2.5">
            <div
              className="w-2.5 h-2.5 rounded-sm shrink-0"
              style={{ background: COLORS[idx % COLORS.length] }}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-gray-400 text-xs truncate">{item.name}</span>
                <span className="text-white text-xs font-medium shrink-0">
                  {item.percentage || Math.round((item.value / total) * 100)}%
                </span>
              </div>
              <div className="h-1 bg-white/5 rounded-full mt-1 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${item.percentage || Math.round((item.value / total) * 100)}%`,
                    background: COLORS[idx % COLORS.length],
                  }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
