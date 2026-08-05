import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

vi.mock('../../src/api/schedule.api', () => ({
  scheduleApi: {
    getBestTime: vi.fn(),
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

import { scheduleApi } from '../../src/api/schedule.api'
import { BestTimeWidget } from '../../src/components/features/BestTimeWidget'

describe('BestTimeWidget — plan gating', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockActiveChannel = { _id: 'chan1' }
  })

  it('shows a Creator+ locked state on Free plan, without calling the gated endpoint', async () => {
    mockUser = { plan: 'free' }
    render(<BestTimeWidget />)

    expect(await screen.findByText(/creator\+ feature/i)).toBeInTheDocument()
    expect(screen.getByText(/upgrade to unlock/i)).toBeInTheDocument()
    expect(scheduleApi.getBestTime).not.toHaveBeenCalled()
  })

  it('renders real slots for a Creator-plan user', async () => {
    mockUser = { plan: 'creator' }
    scheduleApi.getBestTime.mockResolvedValue({
      data: {
        data: {
          nextOptimalSlots: [{ datetime: '2026-08-10T17:00:00.000Z', time: '5:00 PM', score: 92 }],
        },
      },
    })

    render(<BestTimeWidget />)

    await waitFor(() => expect(scheduleApi.getBestTime).toHaveBeenCalledWith('chan1'))
    expect(await screen.findByText('92/100')).toBeInTheDocument()
    expect(screen.queryByText(/creator\+ feature/i)).not.toBeInTheDocument()
  })

  it('still shows the "sync analytics" empty state for an entitled user with no data yet', async () => {
    mockUser = { plan: 'pro' }
    scheduleApi.getBestTime.mockResolvedValue({ data: { data: { nextOptimalSlots: [] } } })

    render(<BestTimeWidget />)

    await waitFor(() => expect(scheduleApi.getBestTime).toHaveBeenCalled())
    expect(
      await screen.findByText(/sync analytics for ai time recommendations/i)
    ).toBeInTheDocument()
  })
})
