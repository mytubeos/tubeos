import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { videoApi } from '../../src/api/video.api'
import { Videos } from '../../src/pages/videos/Videos'

vi.mock('../../src/api/video.api', () => ({
  videoApi: { getAll: vi.fn(), update: vi.fn(), upload: vi.fn() },
}))
vi.mock('../../src/store/channelStore', () => ({
  useChannelStore: () => ({ activeChannel: { _id: 'channel-1' } }),
}))

const failed = {
  _id: 'video-1',
  title: 'Failed upload',
  status: 'failed',
  lastError: { message: 'Upload quota exceeded' },
  tags: ['creator'],
  privacy: 'private',
  createdAt: '2026-10-01T00:00:00Z',
}
const openMenu = async (user) => {
  render(
    <MemoryRouter>
      <Videos />
    </MemoryRouter>
  )
  await user.click(await screen.findByRole('button', { name: 'Actions for Failed upload' }))
}
beforeEach(() => {
  videoApi.getAll.mockResolvedValue({
    data: { data: [failed], meta: { pagination: { total: 1 } } },
  })
  videoApi.update.mockResolvedValue({})
  videoApi.upload.mockResolvedValue({})
})

describe('failed video recovery', () => {
  it('shows the stored failure and offers details, edit, re-upload and delete', async () => {
    const user = userEvent.setup()
    await openMenu(user)
    expect(screen.getByText('Upload quota exceeded')).toBeInTheDocument()
    for (const name of ['View details', 'Edit', 'Re-upload', 'Delete']) {
      expect(screen.getByRole('button', { name, exact: true })).toBeInTheDocument()
    }
    await user.click(screen.getByRole('button', { name: 'View details' }))
    expect(screen.getByText('Status: failed')).toBeInTheDocument()
  })
  it('requires a file, then re-uploads the same video with its schedule cleared', async () => {
    const user = userEvent.setup()
    await openMenu(user)
    await user.click(screen.getByRole('button', { name: 'Re-upload', exact: true }))
    await user.click(screen.getByRole('button', { name: 'Upload video', exact: true }))
    expect(videoApi.upload).not.toHaveBeenCalled()
    expect(videoApi.update).not.toHaveBeenCalled()
    const file = new File(['test video'], 'retry.mp4', { type: 'video/mp4' })
    await user.upload(screen.getByLabelText('Video file'), file)
    await user.click(screen.getByRole('button', { name: 'Upload video', exact: true }))
    await waitFor(() => expect(videoApi.upload).toHaveBeenCalledTimes(1))
    expect(videoApi.update).toHaveBeenCalledWith(
      'video-1',
      expect.objectContaining({ scheduledAt: null })
    )
    const [id, body] = videoApi.upload.mock.calls[0]
    expect(id).toBe('video-1')
    expect(body.get('video')).toBe(file)
    await waitFor(() => expect(screen.queryByText('Re-upload video')).not.toBeInTheDocument())
  })
})
