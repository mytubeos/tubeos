import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

let mockChannels
vi.mock('../../src/hooks/useChannel', () => ({
  useChannel: () => ({
    channels: mockChannels,
    isLoading: false,
    fetchChannels: vi.fn(),
    connectYouTube: vi.fn(),
    upgradeAnalytics: vi.fn(),
    handleOAuthReturn: vi.fn(),
    syncChannel: vi.fn(),
    disconnectChannel: vi.fn(),
    setPrimary: vi.fn(),
  }),
}))

let mockUser
vi.mock('../../src/store/authStore', () => ({
  useAuthStore: () => ({ user: mockUser }),
}))

import { Channels } from '../../src/pages/channels/Channels'

const channel = (overrides = {}) => ({
  _id: Math.random().toString(),
  channelName: 'Test Channel',
  connectionStatus: 'connected',
  stats: {},
  ...overrides,
})

describe('Channels page — connected count text', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows a plain "X / Y" fraction when within the plan limit', () => {
    mockUser = { plan: 'pro' }
    mockChannels = [channel(), channel()]
    render(
      <MemoryRouter>
        <Channels />
      </MemoryRouter>
    )
    expect(screen.getByText(/2 \/ 3 channels connected/)).toBeInTheDocument()
  })

  it('reads clearly instead of an inverted fraction when over the limit after a downgrade', () => {
    mockUser = { plan: 'free' }
    mockChannels = [channel({ isPrimary: true }), channel()]
    render(
      <MemoryRouter>
        <Channels />
      </MemoryRouter>
    )
    expect(screen.queryByText(/2 \/ 1 channels connected/)).not.toBeInTheDocument()
    expect(screen.getByText(/2 channels connected, 1 allowed/)).toBeInTheDocument()
  })
})
