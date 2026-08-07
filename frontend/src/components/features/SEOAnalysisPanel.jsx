// src/components/features/SEOAnalysisPanel.jsx
import { useState } from 'react'
import { Search, Sparkles } from 'lucide-react'
import { aiApi } from '../../api/ai.api'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import toast from 'react-hot-toast'

const scoreVariant = (n) => (n >= 80 ? 'emerald' : n >= 50 ? 'amber' : 'rose')
// Tailwind's JIT scanner needs literal class strings in source — can't
// interpolate `bg-${variant}/15` at runtime, so map through this instead
// (same constraint as AIContent.jsx's standalone SEO Analysis tab).
const SCORE_CIRCLE_CLASS = {
  emerald: 'bg-emerald/15 text-emerald',
  amber: 'bg-amber/15 text-amber',
  rose: 'bg-rose/15 text-rose',
}

// Inline SEO scoring for the Upload page — reads the form's current
// title/description/tags as props (no duplicate input state) so it always
// analyzes exactly what's about to be published.
export const SEOAnalysisPanel = ({ title, description, tags }) => {
  const [analyzing, setAnalyzing] = useState(false)
  const [result, setResult] = useState(null)

  const handleAnalyze = async () => {
    if (!title?.trim()) {
      toast.error('Enter a title first')
      return
    }
    setAnalyzing(true)
    try {
      const res = await aiApi.analyzeSEO({
        title,
        description,
        tags: (tags || '')
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
      })
      setResult(res.data.data)
    } catch (err) {
      toast.error(err.response?.data?.message || 'SEO analysis failed')
    } finally {
      setAnalyzing(false)
    }
  }

  return (
    <div className="glass p-4 rounded-xl space-y-3">
      <div className="flex items-center gap-2">
        <Search size={15} className="text-emerald" />
        <p className="text-sm font-semibold text-white">SEO Analysis</p>
      </div>

      <Button
        fullWidth
        variant="ghost"
        size="sm"
        icon={Sparkles}
        loading={analyzing}
        onClick={handleAnalyze}
      >
        {result ? 'Re-analyze SEO' : 'Analyze SEO'}
      </Button>

      {result && (
        <div className="space-y-3 pt-1">
          <div className="flex items-center gap-3">
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0
                          ${SCORE_CIRCLE_CLASS[scoreVariant(result.score)]}`}
            >
              <span className="text-lg font-display font-bold">{result.score}</span>
            </div>
            <div>
              <p className="text-xs font-medium text-white">Overall SEO Score</p>
              <p className="text-2xs text-gray-500">out of 100</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <Badge variant={scoreVariant(result.titleScore)} size="xs">
              Title {result.titleScore}
            </Badge>
            <Badge variant={scoreVariant(result.descriptionScore)} size="xs">
              Description {result.descriptionScore}
            </Badge>
            <Badge variant={scoreVariant(result.tagsScore)} size="xs">
              Tags {result.tagsScore}
            </Badge>
          </div>

          {result.suggestions?.length > 0 && (
            <div className="space-y-2">
              {result.suggestions.map((s, i) => (
                <div key={i} className="p-2.5 bg-base-600 rounded-lg">
                  <Badge variant="gray" size="xs">
                    {s.area}
                  </Badge>
                  <p className="text-xs text-white mt-1">{s.issue}</p>
                  <p className="text-2xs text-gray-500 mt-0.5">→ {s.fix}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
