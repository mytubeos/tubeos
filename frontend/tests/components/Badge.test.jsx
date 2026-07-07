import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Badge, PlanBadge, StatusBadge, SentimentBadge } from '../../src/components/ui/Badge'

describe('Badge', () => {
  it('renders its children', () => {
    render(<Badge>New</Badge>)
    expect(screen.getByText('New')).toBeInTheDocument()
  })
})

describe('PlanBadge', () => {
  it('falls back to the Free plan label for an unknown plan', () => {
    render(<PlanBadge plan="nonexistent" />)
    expect(screen.getByText('Free')).toBeInTheDocument()
  })

  it('renders the correct label for a known plan', () => {
    render(<PlanBadge plan="agency" />)
    expect(screen.getByText('Agency')).toBeInTheDocument()
  })
})

describe('StatusBadge', () => {
  it('renders the configured label for a known status', () => {
    render(<StatusBadge status="published" />)
    expect(screen.getByText('Published')).toBeInTheDocument()
  })

  it('falls back to the raw status string for an unknown status', () => {
    render(<StatusBadge status="something_weird" />)
    expect(screen.getByText('something_weird')).toBeInTheDocument()
  })
})

describe('SentimentBadge', () => {
  it('renders the emoji + label for a known sentiment', () => {
    render(<SentimentBadge sentiment="negative" />)
    expect(screen.getByText('😤 Negative')).toBeInTheDocument()
  })

  it('falls back to neutral for an unrecognized sentiment', () => {
    render(<SentimentBadge sentiment="unknown" />)
    expect(screen.getByText('😐 Neutral')).toBeInTheDocument()
  })
})
