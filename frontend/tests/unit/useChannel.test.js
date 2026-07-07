import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

vi.mock('../../src/api/youtube.api', () => ({
  youtubeApi: {
    getAuthUrl: vi.fn(),
    connectChannel: vi.fn(),
    getChannels: vi.fn(),
    syncChannel: vi.fn(),
    disconnectChannel: vi.fn(),
    setPrimary: vi.fn(),
    getAnalyticsAuthUrl: vi.fn(),
  },
}))

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}))

const { useChannel } = await import('../../src/hooks/useChannel')
const { useChannelStore } = await import('../../src/store/channelStore')
const { youtubeApi } = await import('../../src/api/youtube.api')
const toast = (await import('react-hot-toast')).default

const INITIAL_STATE = useChannelStore.getState()

beforeEach(() => {
  useChannelStore.setState(INITIAL_STATE, true)
  youtubeApi.getChannels.mockResolvedValue({ status: 200, data: { data: [] } })
})

describe('useChannel.connectYouTube', () => {
  it('connects successfully and refreshes the channel list', async () => {
    youtubeApi.getAuthUrl.mockResolvedValueOnce({ data: { data: { authUrl: 'https://auth.url' } } })
    youtubeApi.connectChannel.mockResolvedValueOnce({ success: true, channel: 'My Channel' })

    const { result } = renderHook(() => useChannel())

    await act(async () => {
      await result.current.connectYouTube()
    })

    expect(toast.success).toHaveBeenCalledWith('"My Channel" connected!')
    expect(youtubeApi.getChannels).toHaveBeenCalled()
  })

  it('maps a known OAuth error code to a friendly message', async () => {
    youtubeApi.getAuthUrl.mockResolvedValueOnce({ data: { data: { authUrl: 'https://auth.url' } } })
    youtubeApi.connectChannel.mockResolvedValueOnce({ success: false, error: 'access_denied' })

    const { result } = renderHook(() => useChannel())

    await act(async () => {
      await result.current.connectYouTube()
    })

    expect(toast.error).toHaveBeenCalledWith('You cancelled the YouTube connection.')
  })

  it('silently ignores a user-closed popup (no toast spam)', async () => {
    youtubeApi.getAuthUrl.mockResolvedValueOnce({ data: { data: { authUrl: 'https://auth.url' } } })
    youtubeApi.connectChannel.mockResolvedValueOnce({ success: false, error: 'popup_closed' })

    const { result } = renderHook(() => useChannel())

    await act(async () => {
      await result.current.connectYouTube()
    })

    expect(toast.error).not.toHaveBeenCalled()
    expect(toast.success).not.toHaveBeenCalled()
  })

  it('shows a plan-limit message on a 403 response', async () => {
    youtubeApi.getAuthUrl.mockRejectedValueOnce({
      response: { status: 403, data: { message: 'Plan limit reached' } },
    })

    const { result } = renderHook(() => useChannel())

    await act(async () => {
      await result.current.connectYouTube()
    })

    expect(toast.error).toHaveBeenCalledWith('Plan limit reached')
  })
})

describe('useChannel.syncChannel', () => {
  it('shows a reconnect message when the token was revoked', async () => {
    youtubeApi.syncChannel.mockRejectedValueOnce({
      response: { data: { code: 'RECONNECT_REQUIRED' } },
    })

    const { result } = renderHook(() => useChannel())

    await act(async () => {
      await result.current.syncChannel('c1')
    })

    expect(toast.error).toHaveBeenCalledWith(
      'YouTube access expired. Please reconnect your channel.'
    )
  })

  it('syncs and refreshes channels on success', async () => {
    youtubeApi.syncChannel.mockResolvedValueOnce({})

    const { result } = renderHook(() => useChannel())

    await act(async () => {
      await result.current.syncChannel('c1')
    })

    expect(toast.success).toHaveBeenCalledWith('Channel synced!')
    expect(youtubeApi.getChannels).toHaveBeenCalled()
  })
})

describe('useChannel.handleOAuthReturn', () => {
  it('shows a success toast and cleans up the URL on a successful connect', async () => {
    const replaceStateSpy = vi.spyOn(window.history, 'replaceState')
    const params = new URLSearchParams({ youtube_connected: 'true', channel: 'My Channel' })

    const { result } = renderHook(() => useChannel())

    await act(async () => {
      await result.current.handleOAuthReturn(params)
    })

    expect(toast.success).toHaveBeenCalledWith('"My Channel" connected successfully!')
    expect(replaceStateSpy).toHaveBeenCalled()
  })

  it('maps an OAuth error param to a friendly message', async () => {
    const params = new URLSearchParams({ youtube_error: 'no_refresh_token' })

    const { result } = renderHook(() => useChannel())

    await act(async () => {
      await result.current.handleOAuthReturn(params)
    })

    expect(toast.error).toHaveBeenCalledWith(
      'Could not get full access. Remove this app from myaccount.google.com/permissions and try again.'
    )
  })
})
