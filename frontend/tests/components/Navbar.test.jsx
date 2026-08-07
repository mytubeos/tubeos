import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../../src/store/channelStore', () => ({
  useChannelStore: vi.fn(),
}))

vi.mock('../../src/api/notification.api', () => ({
  default: {
    getAll: vi.fn(),
    markRead: vi.fn(),
    markAllRead: vi.fn(),
  },
}))

const { Navbar } = await import('../../src/components/layout/Navbar')
const { useChannelStore } = await import('../../src/store/channelStore')
const notificationAPI = (await import('../../src/api/notification.api')).default

const renderNavbar = () =>
  render(
    <MemoryRouter>
      <Navbar title="Dashboard" />
    </MemoryRouter>
  )

const mockNotifications = [
  {
    _id: 'n1',
    type: 'upload_reminder',
    mood: 'nudge',
    message: 'Upload nahi kiya abhi tak',
    read: false,
    createdAt: new Date().toISOString(),
  },
  {
    _id: 'n2',
    type: 'streak_milestone',
    mood: 'celebrate',
    message: '7 din ka streak!',
    read: true,
    createdAt: new Date().toISOString(),
  },
]

// A real setInterval poll runs inside Navbar — fake timers keep it from
// firing mid-test, same defensive pattern as CommentInbox.test.jsx's
// debounce fix (see that file's comment for the full rationale).
beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  useChannelStore.mockReturnValue({ channels: [], activeChannel: null, setActiveChannel: vi.fn() })
})

afterEach(() => {
  vi.useRealTimers()
})

const openBell = async (user) => {
  const bell = screen.getByRole('button', { name: 'Notifications' })
  await user.click(bell)
}

describe('Navbar — notification bell', () => {
  it('shows the unread dot when there are unread notifications', async () => {
    notificationAPI.getAll.mockResolvedValue({
      data: { data: { notifications: mockNotifications, unreadCount: 1 } },
    })
    renderNavbar()

    const bell = await screen.findByRole('button', { name: 'Notifications' })
    await waitFor(() => expect(bell.querySelector('.animate-pulse')).toBeInTheDocument())
  })

  it('hides the unread dot when there are no unread notifications', async () => {
    notificationAPI.getAll.mockResolvedValue({
      data: { data: { notifications: mockNotifications, unreadCount: 0 } },
    })
    renderNavbar()

    const bell = await screen.findByRole('button', { name: 'Notifications' })
    await waitFor(() => expect(notificationAPI.getAll).toHaveBeenCalled())
    expect(bell.querySelector('.animate-pulse')).not.toBeInTheDocument()
  })

  it('opens the dropdown and lists fetched notifications on click', async () => {
    notificationAPI.getAll.mockResolvedValue({
      data: { data: { notifications: mockNotifications, unreadCount: 1 } },
    })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderNavbar()
    await waitFor(() => expect(notificationAPI.getAll).toHaveBeenCalled())

    await openBell(user)

    expect(await screen.findByText('Upload nahi kiya abhi tak')).toBeInTheDocument()
    expect(screen.getByText('7 din ka streak!')).toBeInTheDocument()
  })

  it('marks a single notification read on click and calls the API', async () => {
    notificationAPI.getAll.mockResolvedValue({
      data: { data: { notifications: mockNotifications, unreadCount: 1 } },
    })
    notificationAPI.markRead.mockResolvedValue({})
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderNavbar()
    await waitFor(() => expect(notificationAPI.getAll).toHaveBeenCalled())

    await openBell(user)
    const item = await screen.findByText('Upload nahi kiya abhi tak')
    await user.click(item)

    await waitFor(() => expect(notificationAPI.markRead).toHaveBeenCalledWith('n1'))
  })

  it('does not re-call markRead for a notification that is already read', async () => {
    notificationAPI.getAll.mockResolvedValue({
      data: { data: { notifications: mockNotifications, unreadCount: 1 } },
    })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderNavbar()
    await waitFor(() => expect(notificationAPI.getAll).toHaveBeenCalled())

    await openBell(user)
    const readItem = await screen.findByText('7 din ka streak!')
    await user.click(readItem)

    expect(notificationAPI.markRead).not.toHaveBeenCalled()
  })

  it('marks all notifications read when "Mark all read" is clicked', async () => {
    notificationAPI.getAll.mockResolvedValue({
      data: { data: { notifications: mockNotifications, unreadCount: 1 } },
    })
    notificationAPI.markAllRead.mockResolvedValue({})
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderNavbar()
    await waitFor(() => expect(notificationAPI.getAll).toHaveBeenCalled())

    await openBell(user)
    const markAllBtn = await screen.findByText('Mark all read')
    await user.click(markAllBtn)

    await waitFor(() => expect(notificationAPI.markAllRead).toHaveBeenCalled())
  })

  it('shows an empty state when there are no notifications at all', async () => {
    notificationAPI.getAll.mockResolvedValue({
      data: { data: { notifications: [], unreadCount: 0 } },
    })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderNavbar()
    await waitFor(() => expect(notificationAPI.getAll).toHaveBeenCalled())

    await openBell(user)

    expect(await screen.findByText('All clear, nothing new')).toBeInTheDocument()
  })
})
