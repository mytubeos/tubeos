import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

vi.mock('../../src/api/analytics.api', () => ({
  analyticsApi: {
    getHeatmap: vi.fn(),
    getBestTime: vi.fn(),
    getLowTraffic: vi.fn(),
    rebuildHeatmap: vi.fn(),
  },
}))

let mockActiveChannel
vi.mock('../../src/store/channelStore', () => ({
  useChannelStore: () => ({ activeChannel: mockActiveChannel }),
}))

let mockUser
vi.mock('../../src/store/authStore', () => ({
  useAuthStore: () => ({ user: mockUser }),
}))

import { analyticsApi } from '../../src/api/analytics.api'
import { Heatmap } from '../../src/pages/analytics/Heatmap'

describe('Heatmap page — plan gating', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockActiveChannel = { _id: 'chan1', channelName: 'Sita Ram' }
  })

  it('shows a locked upgrade card on Free plan, without ever calling the gated endpoints', async () => {
    mockUser = { plan: 'free' }
    render(<Heatmap />)

    expect(await screen.findByText(/upgrade to creator to unlock/i)).toBeInTheDocument()
    expect(screen.getByText(/creator\+ feature/i)).toBeInTheDocument()
    expect(analyticsApi.getHeatmap).not.toHaveBeenCalled()
    expect(analyticsApi.getBestTime).not.toHaveBeenCalled()
    expect(analyticsApi.getLowTraffic).not.toHaveBeenCalled()
    // No "Rebuild" button on the locked view — nothing to rebuild.
    expect(screen.queryByRole('button', { name: /rebuild/i })).not.toBeInTheDocument()
  })

  it('loads the real heatmap for a Creator-plan user', async () => {
    mockUser = { plan: 'creator' }
    analyticsApi.getHeatmap.mockResolvedValue({
      data: { data: { grid: [], bestSlots: [], confidence: 'high', dataPoints: 42 } },
    })
    analyticsApi.getBestTime.mockResolvedValue({ data: { data: { nextOptimalSlots: [] } } })
    analyticsApi.getLowTraffic.mockResolvedValue({ data: { data: { avoidSlots: [] } } })

    render(<Heatmap />)

    await waitFor(() => expect(analyticsApi.getHeatmap).toHaveBeenCalledWith('chan1'))
    expect(screen.queryByText(/upgrade to creator to unlock/i)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /rebuild/i })).toBeInTheDocument()
  })
})
