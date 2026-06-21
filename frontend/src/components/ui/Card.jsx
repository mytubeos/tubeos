// src/components/ui/Card.jsx
export const Card = ({ children, className = '', hover = false, glow = null }) => {
  const glowColors = {
    brand: 'hover:shadow-brand hover:border-brand/30',
    cyan: 'hover:shadow-cyan hover:border-cyan/30',
    rose: 'hover:border-rose/30',
    emerald: 'hover:border-emerald/30',
  }

  return (
    <div className={`glass p-5 transition-all duration-300
                     ${hover ? `cursor-pointer ${glowColors[glow] || 'hover:border-white/15 hover:bg-white/[0.06]'}` : ''}
                     ${className}`}>
      {children}
    </div>
  )
}

export const CardHeader = ({ title, subtitle, action, icon: Icon, iconColor = 'brand' }) => {
  const iconColors = {
    brand: 'text-brand bg-brand/10',
    cyan: 'text-cyan bg-cyan/10',
    rose: 'text-rose bg-rose/10',
    emerald: 'text-emerald bg-emerald/10',
    amber: 'text-amber bg-amber/10',
  }

  return (
    <div className="flex items-start justify-between mb-4">
      <div className="flex items-center gap-3">
        {Icon && (
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${iconColors[iconColor]}`}>
            <Icon size={18} />
          </div>
        )}
        <div>
          <h3 className="font-display font-semibold text-white text-sm">{title}</h3>
          {subtitle && <p className="text-gray-500 text-xs mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

// Metric card with KPI data
export const MetricCard = ({
  label, value, change, trend, icon: Icon,
  iconColor = 'brand', subtitle, loading = false,
}) => {
  const isPositive = change >= 0
  const iconColors = {
    brand: 'text-brand bg-brand/10 shadow-[0_0_20px_rgba(79,70,229,0.2)]',
    cyan: 'text-cyan bg-cyan/10 shadow-[0_0_20px_rgba(6,182,212,0.2)]',
    rose: 'text-rose bg-rose/10 shadow-[0_0_20px_rgba(244,63,94,0.2)]',
    emerald: 'text-emerald bg-emerald/10 shadow-[0_0_20px_rgba(16,185,129,0.2)]',
    amber: 'text-amber bg-amber/10 shadow-[0_0_20px_rgba(245,158,11,0.2)]',
  }

  if (loading) {
    return (
      <div className="glass p-5">
        <div className="shimmer h-4 w-24 rounded mb-4" />
        <div className="shimmer h-8 w-32 rounded mb-2" />
        <div className="shimmer h-3 w-20 rounded" />
      </div>
    )
  }

  return (
    <div className="glass p-5 hover:border-white/12 transition-all duration-300 group">
      <div className="flex items-start justify-between mb-4">
        <p className="text-gray-400 text-sm font-medium">{label}</p>
        {Icon && (
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center
                          transition-transform duration-300 group-hover:scale-110 ${iconColors[iconColor]}`}>
            <Icon size={17} />
          </div>
        )}
      </div>

      <div className="space-y-1">
        <p className="font-display font-bold text-2xl text-white tracking-tight">{value}</p>
        {subtitle && <p className="text-gray-500 text-xs">{subtitle}</p>}
        {change !== undefined && (
          <div className="flex items-center gap-1.5 pt-1">
            <span className={`text-xs font-medium ${isPositive ? 'text-emerald' : 'text-rose'}`}>
              {isPositive ? '↑' : '↓'} {Math.abs(change).toFixed(1)}%
            </span>
            <span className="text-gray-600 text-xs">vs last period</span>
          </div>
        )}
      </div>
    </div>
  )
}
