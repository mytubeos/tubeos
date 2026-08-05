import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate, useLocation: () => ({ state: {} }) }
})

vi.mock('../../src/api/video.api', () => ({
  videoApi: {
    createDraft: vi.fn(),
    upload: vi.fn(),
    stageFile: vi.fn(),
    uploadThumbnail: vi.fn(),
  },
}))

vi.mock('../../src/api/ai.api', () => ({
  aiApi: {
    generateTitles: vi.fn(),
    generateTags: vi.fn(),
    generateDescription: vi.fn(),
  },
}))

vi.mock('../../src/store/channelStore', () => ({
  useChannelStore: () => ({ activeChannel: null }),
}))

let mockUser
vi.mock('../../src/store/authStore', () => ({
  useAuthStore: () => ({ user: mockUser }),
}))

import { VideoUpload } from '../../src/pages/videos/VideoUpload'

describe('VideoUpload upfront usage-limit warning', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('warns upfront and disables publish on the Free plan (0 uploads/month)', () => {
    mockUser = { plan: 'free', usage: { uploadsUsed: 0 } }
    render(<VideoUpload />)

    expect(screen.getByText(/aren't included on the Free plan/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /upgrade to publish/i })).toBeDisabled()
    // Drafting has no usage check server-side, so it must stay usable.
    expect(screen.getByRole('button', { name: /save as draft/i })).toBeEnabled()
  })

  it('warns once a paid plan has used its full monthly quota', () => {
    mockUser = { plan: 'creator', usage: { uploadsUsed: 5 } }
    render(<VideoUpload />)

    expect(
      screen.getByText(/used all 5 uploads this month on the Creator plan/i)
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /upgrade to publish/i })).toBeDisabled()
  })

  it('shows no warning when the plan still has quota left', () => {
    mockUser = { plan: 'creator', usage: { uploadsUsed: 2 } }
    render(<VideoUpload />)

    expect(screen.queryByText(/uploads this month/i)).not.toBeInTheDocument()
    // No file picked yet, so the button is still disabled — but for the
    // file reason, not the usage-limit reason (label stays "Upload Now").
    expect(screen.getByRole('button', { name: /upload now/i })).toBeDisabled()
  })

  it('never warns on the Agency plan (unlimited uploads)', () => {
    mockUser = { plan: 'agency', usage: { uploadsUsed: 999 } }
    render(<VideoUpload />)

    expect(screen.queryByText(/uploads this month/i)).not.toBeInTheDocument()
  })
})
