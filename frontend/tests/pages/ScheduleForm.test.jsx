import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('../../src/components/features/BestTimeWidget', () => ({
  BestTimeWidget: () => null,
}))

vi.mock('../../src/api/video.api', () => ({
  videoApi: { getAll: vi.fn() },
}))

vi.mock('../../src/api/schedule.api', () => ({
  scheduleApi: { getBestTime: vi.fn(), create: vi.fn() },
}))

vi.mock('../../src/store/channelStore', () => ({
  useChannelStore: () => ({ activeChannel: { _id: 'chan1' } }),
}))

let mockUser
vi.mock('../../src/store/authStore', () => ({
  useAuthStore: () => ({ user: mockUser }),
}))

import { videoApi } from '../../src/api/video.api'
import { scheduleApi } from '../../src/api/schedule.api'
import { ScheduleForm } from '../../src/pages/scheduler/ScheduleForm'

const draftVideo = {
  _id: 'vid1',
  title: 'My Draft Video',
  description: 'test',
  status: 'draft',
  stagedFile: { gcsPath: 'gs://bucket/vid1' },
}

describe('ScheduleForm — Auto-post button', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    videoApi.getAll.mockResolvedValue({ data: { data: [draftVideo] } })
  })

  it('disables Auto-post until a video is selected', async () => {
    mockUser = { plan: 'creator' }
    render(<ScheduleForm onSuccess={vi.fn()} onCancel={vi.fn()} />)

    expect(await screen.findByRole('button', { name: /auto-post/i })).toBeDisabled()
  })

  it('disables Auto-post and shows a plan hint on Free plan, even with a video selected', async () => {
    mockUser = { plan: 'free' }
    const user = userEvent.setup()
    render(<ScheduleForm onSuccess={vi.fn()} onCancel={vi.fn()} />)

    await user.click(await screen.findByText('My Draft Video'))

    expect(screen.getByRole('button', { name: /auto-post/i })).toBeDisabled()
    expect(screen.getByText(/auto-post requires the/i)).toBeInTheDocument()
  })

  it('picks the top best-time slot and creates the schedule in one click on Creator plan', async () => {
    mockUser = { plan: 'creator' }
    scheduleApi.getBestTime.mockResolvedValue({
      data: { data: { nextOptimalSlots: [{ datetime: '2026-08-10T17:00:00.000Z', score: 92 }] } },
    })
    scheduleApi.create.mockResolvedValue({ data: {} })
    const onSuccess = vi.fn()
    const user = userEvent.setup()
    render(<ScheduleForm onSuccess={onSuccess} onCancel={vi.fn()} />)

    await user.click(await screen.findByText('My Draft Video'))
    const autoPostBtn = screen.getByRole('button', { name: /auto-post/i })
    expect(autoPostBtn).toBeEnabled()
    await user.click(autoPostBtn)

    await waitFor(() => expect(scheduleApi.getBestTime).toHaveBeenCalledWith('chan1'))
    await waitFor(() =>
      expect(scheduleApi.create).toHaveBeenCalledWith(
        expect.objectContaining({ videoId: 'vid1', scheduledAt: '2026-08-10T17:00:00.000Z' })
      )
    )
    await waitFor(() => expect(onSuccess).toHaveBeenCalled())
  })

  it('tells the user to sync analytics when no best-time slot is available yet', async () => {
    mockUser = { plan: 'creator' }
    scheduleApi.getBestTime.mockResolvedValue({ data: { data: { nextOptimalSlots: [] } } })
    const onSuccess = vi.fn()
    const user = userEvent.setup()
    render(<ScheduleForm onSuccess={onSuccess} onCancel={vi.fn()} />)

    await user.click(await screen.findByText('My Draft Video'))
    await user.click(screen.getByRole('button', { name: /auto-post/i }))

    await waitFor(() => expect(scheduleApi.getBestTime).toHaveBeenCalled())
    expect(scheduleApi.create).not.toHaveBeenCalled()
    expect(onSuccess).not.toHaveBeenCalled()
  })
})
