import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { KPICard, KPIGrid } from '../../src/components/features/KPICard'

describe('KPICard', () => {
  it("formats the value using the KPI type's formatter", () => {
    render(<KPICard type="views" value={1500} />)
    expect(screen.getByText('1.5K')).toBeInTheDocument()
    expect(screen.getByText('Total Views')).toBeInTheDocument()
  })

  it('formats revenue as USD currency regardless of the app default (INR)', () => {
    render(<KPICard type="revenue" value={2500} />)
    expect(screen.getByText('$2.5K')).toBeInTheDocument()
  })

  it('shows an em-dash placeholder when value is null/undefined', () => {
    render(<KPICard type="views" value={null} />)
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('renders 0 as a real value rather than the placeholder', () => {
    render(<KPICard type="views" value={0} />)
    expect(screen.getByText('0')).toBeInTheDocument()
  })

  it('shows the up arrow with emerald styling for positive change', () => {
    const { container } = render(<KPICard type="views" value={100} change={12.3} />)
    const changeEl = screen.getByText(/12\.3%/)
    expect(changeEl.textContent).toContain('↑')
    expect(changeEl.className).toContain('text-emerald')
    expect(container).toBeTruthy()
  })

  it('shows the down arrow with rose styling for negative change', () => {
    const changeEl = render(<KPICard type="views" value={100} change={-5.4} />)
    const el = changeEl.getByText(/5\.4%/)
    expect(el.textContent).toContain('↓')
    expect(el.className).toContain('text-rose')
  })

  it('falls back to the "views" config for an unknown KPI type', () => {
    render(<KPICard type="not-a-real-type" value={2000} />)
    expect(screen.getByText('Total Views')).toBeInTheDocument()
  })
})

describe('KPIGrid', () => {
  it('shows total subscribers when there is no real period-based subscriber data', () => {
    const overview = {
      metrics: {
        views: { value: 1000, change: 5 },
        subscribers: { gained: 0, lost: 0, net: 0 },
        watchTime: { value: 120, change: 2 },
        ctr: { value: 4.5 },
      },
    }
    render(<KPIGrid overview={overview} channelStats={{ subscriberCount: 5000 }} />)

    expect(screen.getByText('5.0K')).toBeInTheDocument()
    expect(screen.getByText('Total subscribers')).toBeInTheDocument()
  })

  it('shows the period net (not the total) as Subscriber Growth when channelStats is absent (Analytics)', () => {
    // Regression test: Analytics.jsx never passes channelStats to KPIGrid, so
    // the old code (which only ever read channelStats?.subscriberCount) left
    // this card blank ("—") on the Analytics page even with real data present.
    const overview = {
      metrics: {
        views: { value: 1000, change: 5 },
        subscribers: { gained: 50, lost: 5, net: 45, change: 10 },
        watchTime: { value: 120, change: 2 },
        ctr: { value: 4.5 },
      },
    }
    render(<KPIGrid overview={overview} period="7d" />)

    expect(screen.getByText('Subscriber Growth')).toBeInTheDocument()
    expect(screen.getByText('+45')).toBeInTheDocument()
    expect(screen.getByText(/50 gained · 5 lost · last 7 days/)).toBeInTheDocument()
  })

  it('shows a negative net subscriber change as a real signed number, not a fake total', () => {
    const overview = {
      metrics: {
        views: { value: 1000, change: 5 },
        subscribers: { gained: 0, lost: 1, net: -1, change: null },
        watchTime: { value: 120, change: 2 },
        ctr: { value: 4.5 },
      },
    }
    render(<KPIGrid overview={overview} period="30d" />)

    expect(screen.getByText('-1')).toBeInTheDocument()
  })

  it('falls back to an absolute view-count delta when the % change is null (previous period had zero)', () => {
    // Regression test: calcChange() on the backend returns null whenever the
    // previous period had zero of a metric, which happens constantly on
    // small/new channels across every period tab (7d/30d/90d) — hiding the
    // change badge entirely even though "0 -> 10" is real, meaningful growth.
    const overview = {
      metrics: {
        views: { value: 10, change: null, delta: 10 },
        subscribers: { gained: 0, lost: 0, net: 0 },
        watchTime: { value: 0, change: null },
        ctr: { value: 0 },
      },
    }
    render(<KPIGrid overview={overview} period="7d" />)

    // Match on the arrow to target the change badge specifically — the
    // headline value ("10") renders as separate, unmarked text nearby.
    const changeEl = screen.getByText(/↑\s*10/)
    expect(changeEl.textContent).not.toContain('%')
  })
})
