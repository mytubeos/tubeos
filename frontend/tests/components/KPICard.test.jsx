import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { KPICard, KPIGrid } from '../../src/components/features/KPICard'

describe('KPICard', () => {
  it("formats the value using the KPI type's formatter", () => {
    render(<KPICard type="views" value={1500} />)
    expect(screen.getByText('1.5K')).toBeInTheDocument()
    expect(screen.getByText('Views')).toBeInTheDocument()
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
    expect(screen.getByText('Views')).toBeInTheDocument()
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

  it('shows gained/lost subscriber data when real Analytics API data is present', () => {
    const overview = {
      metrics: {
        views: { value: 1000, change: 5 },
        subscribers: { gained: 50, lost: 5, net: 45, change: 10 },
        watchTime: { value: 120, change: 2 },
        ctr: { value: 4.5 },
      },
    }
    render(<KPIGrid overview={overview} period="7d" />)

    expect(screen.getByText(/gained · last 7 days/)).toBeInTheDocument()
  })
})
