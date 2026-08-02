// src/components/features/GrowthCard.jsx
import { TrendingUp, TrendingDown, Minus, Target, Lightbulb } from 'lucide-react'
import { Card, CardHeader } from '../ui/Card'
import { formatNumber, formatDate } from '../../utils/formatters'

const TrendIcon = ({ direction }) => {
  if (direction === 'growing') return <TrendingUp size={16} className="text-emerald" />
  if (direction === 'declining') return <TrendingDown size={16} className="text-rose" />
  return <Minus size={16} className="text-gray-400" />
}

const MilestoneRow = ({ milestone }) => {
  const hasEstimate = milestone.daysAway != null
  const pct = Math.min(100, milestone.probability || 0)
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-white/5 last:border-0">
      <div className="w-9 h-9 rounded-xl bg-brand/10 flex items-center justify-center shrink-0">
        <Target size={16} className="text-brand" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-medium text-white">{milestone.label} subs</span>
          {hasEstimate && (
            <span className="text-2xs text-gray-500">{milestone.daysAway}d away</span>
          )}
        </div>
        {hasEstimate ? (
          <>
            <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
              <div
                className="h-full bg-brand-gradient rounded-full transition-all duration-700"
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="text-2xs text-gray-600 mt-1">
              {pct}% probability · Est. {formatDate(milestone.estimatedDate, 'medium')}
            </p>
          </>
        ) : (
          <p className="text-2xs text-gray-600 mt-1">
            Not gaining subscribers yet — post more to get an estimate
          </p>
        )}
      </div>
    </div>
  )
}

const SuggestionRow = ({ suggestion }) => {
  const impactColors = {
    high: 'text-rose bg-rose/10',
    medium: 'text-amber bg-amber/10',
    low: 'text-gray-400 bg-white/5',
  }

  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-white/5 last:border-0">
      <div className="w-7 h-7 rounded-lg bg-amber/10 flex items-center justify-center shrink-0 mt-0.5">
        <Lightbulb size={14} className="text-amber" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <p className="text-sm font-medium text-white">{suggestion.title}</p>
          <span
            className={`text-2xs font-medium px-1.5 py-0.5 rounded-md ${impactColors[suggestion.impact]}`}
          >
            {suggestion.impact}
          </span>
        </div>
        <p className="text-xs text-gray-500 leading-relaxed">{suggestion.description}</p>
      </div>
    </div>
  )
}

export const GrowthPredictionCard = ({ data, loading = false }) => {
  if (loading) {
    return (
      <Card>
        <div className="shimmer h-5 w-40 rounded mb-5" />
        <div className="space-y-3">
          {Array(3)
            .fill(0)
            .map((_, i) => (
              <div key={i} className="shimmer h-16 rounded-xl" />
            ))}
        </div>
      </Card>
    )
  }

  if (!data) return null

  const preds = data.predictions || {}

  return (
    <Card>
      <CardHeader
        title="Growth Prediction"
        icon={TrendingUp}
        iconColor={
          data.trendDirection === 'growing'
            ? 'emerald'
            : data.trendDirection === 'declining'
              ? 'rose'
              : 'brand'
        }
        action={
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <TrendIcon direction={data.trendDirection} />
            <span className="capitalize">{data.trendDirection}</span>
          </div>
        }
      />

      {/* Prediction rows — full-width stacked rows read cleaner than 3 cramped columns on mobile */}
      <div className="space-y-2 mb-5">
        {[
          { label: '30 Days', data: preds.thirtyDays, color: 'brand' },
          { label: '90 Days', data: preds.ninetyDays, color: 'cyan' },
          { label: '1 Year', data: preds.oneYear, color: 'emerald' },
        ].map(({ label, data: pd, color }) => (
          <div
            key={label}
            className={`flex items-center justify-between p-3 glass rounded-xl border border-${color}/20`}
          >
            <div>
              <p className="text-xs font-medium text-gray-400">{label}</p>
              {pd?.confidence > 0 && (
                <p className="text-2xs text-gray-600 mt-0.5">{pd.confidence}% confidence</p>
              )}
            </div>
            <div className="text-right">
              <p className={`font-display font-bold text-lg text-${color}`}>
                {pd?.subscribers ? formatNumber(pd.subscribers) : '—'}
              </p>
              {pd?.gain > 0 && (
                <p className="text-2xs text-gray-600">+{formatNumber(pd.gain)} subs</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Milestones */}
      {data.milestones?.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Upcoming Milestones
          </p>
          {data.milestones.slice(0, 3).map((m, i) => (
            <MilestoneRow key={i} milestone={m} />
          ))}
        </div>
      )}
    </Card>
  )
}

export const SuggestionsCard = ({ suggestions = [], loading = false }) => (
  <Card>
    <CardHeader
      title="Performance Tips"
      subtitle="AI recommendations"
      icon={Lightbulb}
      iconColor="amber"
    />
    {loading ? (
      <div className="space-y-3">
        {Array(3)
          .fill(0)
          .map((_, i) => (
            <div key={i} className="shimmer h-14 rounded-xl" />
          ))}
      </div>
    ) : suggestions.length === 0 ? (
      <p className="text-center text-gray-500 text-sm py-6">
        No suggestions yet — sync analytics to get tips
      </p>
    ) : (
      suggestions.slice(0, 4).map((s, i) => <SuggestionRow key={i} suggestion={s} />)
    )}
  </Card>
)
