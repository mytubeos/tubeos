import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { GrowthPredictionCard } from '../../src/components/features/GrowthCard'

describe('GrowthPredictionCard — milestones', () => {
  it('shows a clear "not gaining subscribers" message instead of a fake date when daysAway is null', () => {
    // Regression test: the backend used to fall back to an identical
    // hardcoded "999 weeks" estimate for every milestone whenever weekly
    // subscriber gain wasn't positive, so 1K/5K/10K all rendered the exact
    // same days-away/date/probability. The fix makes the backend send
    // daysAway: null in that case -- this test locks in that the component
    // renders an honest message rather than "null d away" or "Est. —".
    const data = {
      trendDirection: 'stable',
      predictions: {},
      milestones: [
        { target: 1000, label: '1K', estimatedDate: null, daysAway: null, probability: 0 },
        { target: 5000, label: '5K', estimatedDate: null, daysAway: null, probability: 0 },
      ],
    }
    render(<GrowthPredictionCard data={data} />)

    expect(screen.getAllByText(/Not gaining subscribers yet/)).toHaveLength(2)
    expect(screen.queryByText(/d away/)).not.toBeInTheDocument()
  })

  it('shows real days-away/date/probability when the estimate is available', () => {
    const data = {
      trendDirection: 'growing',
      predictions: {},
      milestones: [
        {
          target: 1000,
          label: '1K',
          estimatedDate: '2027-01-01T00:00:00.000Z',
          daysAway: 150,
          probability: 80,
        },
      ],
    }
    render(<GrowthPredictionCard data={data} />)

    expect(screen.getByText('150d away')).toBeInTheDocument()
    expect(screen.getByText(/80% probability/)).toBeInTheDocument()
  })
})
