import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useEffect } from 'react'

// react-easy-crop does real image-loading/canvas interaction that jsdom
// can't meaningfully drive — stub it so it immediately reports a fixed crop
// area, letting tests exercise the rest of the confirm flow (cropToFile's
// own canvas usage is mocked separately below).
vi.mock('react-easy-crop', () => {
  const MockCropper = ({ onCropComplete }) => {
    // Mount-only on purpose: the real prop is a fresh inline arrow function
    // on every parent render, so depending on it here would re-fire this
    // effect (and its setState) forever — an infinite render loop that
    // hangs the test process instead of failing it.
    useEffect(() => {
      onCropComplete?.({}, { x: 0, y: 0, width: 100, height: 56 })
    }, [])
    return <div data-testid="mock-cropper" />
  }
  return { default: MockCropper }
})

vi.mock('../../src/api/ai.api', () => ({
  aiApi: { generateThumbnail: vi.fn() },
}))

let mockUser
vi.mock('../../src/store/authStore', () => ({
  useAuthStore: () => ({ user: mockUser }),
}))

import { aiApi } from '../../src/api/ai.api'
import { ThumbnailGeneratorModal } from '../../src/components/features/ThumbnailGeneratorModal'

describe('ThumbnailGeneratorModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // jsdom has no real Canvas/Image implementation — stub just enough for
    // cropToFile's draw+export calls to resolve a real File synchronously.
    global.Image = class {
      set src(_value) {
        this.onload?.()
      }
    }
    HTMLCanvasElement.prototype.getContext = vi.fn(() => ({ drawImage: vi.fn() }))
    HTMLCanvasElement.prototype.toBlob = vi.fn((cb) => {
      cb(new Blob(['fake-image-bytes'], { type: 'image/jpeg' }))
    })
  })

  it('shows the generator form for Free plan (thumbnail gen is no longer Creator+-only)', () => {
    mockUser = { plan: 'free' }
    render(<ThumbnailGeneratorModal isOpen onClose={vi.fn()} onCropped={vi.fn()} />)

    expect(screen.getByLabelText(/video title/i)).toBeInTheDocument()
    expect(screen.queryByText(/upgrade to creator to unlock/i)).not.toBeInTheDocument()
  })

  it('requires a title before generating', async () => {
    mockUser = { plan: 'creator' }
    const user = userEvent.setup()
    render(<ThumbnailGeneratorModal isOpen onClose={vi.fn()} onCropped={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: /generate thumbnail/i }))

    expect(aiApi.generateThumbnail).not.toHaveBeenCalled()
  })

  it('generates with the title/niche/style payload, pre-filled from defaultTitle', async () => {
    mockUser = { plan: 'creator' }
    aiApi.generateThumbnail.mockResolvedValue({
      data: { data: { imageUrl: 'https://res.cloudinary.com/demo/image/upload/thumb.jpg' } },
    })
    const user = userEvent.setup()
    render(
      <ThumbnailGeneratorModal
        isOpen
        onClose={vi.fn()}
        onCropped={vi.fn()}
        defaultTitle="My Video Title"
      />
    )

    await user.click(screen.getByRole('button', { name: 'Minimal' }))
    await user.type(screen.getByLabelText(/niche/i), 'Fitness')
    await user.click(screen.getByRole('button', { name: /generate thumbnail/i }))

    await waitFor(() =>
      expect(aiApi.generateThumbnail).toHaveBeenCalledWith({
        title: 'My Video Title',
        niche: 'Fitness',
        style: 'minimal',
      })
    )
  })

  it('crops the generated image and calls onCropped with a File', async () => {
    mockUser = { plan: 'creator' }
    aiApi.generateThumbnail.mockResolvedValue({
      data: { data: { imageUrl: 'https://res.cloudinary.com/demo/image/upload/thumb.jpg' } },
    })
    const onCropped = vi.fn()
    const user = userEvent.setup()
    render(
      <ThumbnailGeneratorModal
        isOpen
        onClose={vi.fn()}
        onCropped={onCropped}
        defaultTitle="My Video Title"
      />
    )

    await user.click(screen.getByRole('button', { name: /generate thumbnail/i }))
    await screen.findByTestId('mock-cropper')

    await user.click(screen.getByRole('button', { name: /use this thumbnail/i }))

    await waitFor(() => expect(onCropped).toHaveBeenCalledTimes(1))
    const file = onCropped.mock.calls[0][0]
    expect(file).toBeInstanceOf(File)
    expect(file.type).toBe('image/jpeg')
  })
})
