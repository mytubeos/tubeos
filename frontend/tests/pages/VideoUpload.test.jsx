import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

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
  useChannelStore: () => ({ activeChannel: { _id: 'chan1' } }),
}))

let mockUser
vi.mock('../../src/store/authStore', () => ({
  useAuthStore: () => ({ user: mockUser }),
}))

// Covered by its own dedicated test file — stub it out here so VideoUpload's
// own tests don't need to satisfy its internal dependencies too.
vi.mock('../../src/components/features/ThumbnailGeneratorModal', () => ({
  ThumbnailGeneratorModal: () => null,
}))

import { videoApi } from '../../src/api/video.api'
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

describe('VideoUpload — Save as Draft attaches a picked thumbnail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUser = { plan: 'creator', usage: {} }
    videoApi.createDraft.mockResolvedValue({ data: { data: { _id: 'draft1' } } })
    videoApi.uploadThumbnail.mockResolvedValue({ data: {} })
  })

  it('uploads the thumbnail when saving as a draft, not just on full upload', async () => {
    // Regression test: saveDraft() used to silently drop any picked
    // thumbnail (manual or AI-generated) since only handleUpload() called
    // uploadThumbnail — see VideoUpload.jsx's saveDraft().
    const user = userEvent.setup()
    render(<VideoUpload />)

    await user.type(screen.getByPlaceholderText(/your video title/i), 'My Video')
    const thumbFile = new File(['fake-bytes'], 'thumb.jpg', { type: 'image/jpeg' })
    await user.upload(screen.getByLabelText(/upload thumbnail/i), thumbFile)

    await user.click(screen.getByRole('button', { name: /save as draft/i }))

    await waitFor(() => expect(videoApi.uploadThumbnail).toHaveBeenCalledTimes(1))
    const [videoId, formData] = videoApi.uploadThumbnail.mock.calls[0]
    expect(videoId).toBe('draft1')
    expect(formData.get('thumbnail')).toBe(thumbFile)
  })

  it('saves the draft fine when no thumbnail was picked at all', async () => {
    const user = userEvent.setup()
    render(<VideoUpload />)

    await user.type(screen.getByPlaceholderText(/your video title/i), 'My Video')
    await user.click(screen.getByRole('button', { name: /save as draft/i }))

    await waitFor(() => expect(videoApi.createDraft).toHaveBeenCalledTimes(1))
    expect(videoApi.uploadThumbnail).not.toHaveBeenCalled()
  })
})
