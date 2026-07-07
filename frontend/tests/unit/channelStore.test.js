import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../src/api/youtube.api', () => ({
  youtubeApi: {
    getChannels: vi.fn(),
  },
}))

const { useChannelStore } = await import('../../src/store/channelStore')
const { youtubeApi } = await import('../../src/api/youtube.api')

const INITIAL_STATE = useChannelStore.getState()

beforeEach(() => {
  useChannelStore.setState(INITIAL_STATE, true)
})

describe('channelStore.fetchChannels', () => {
  it('picks the primary channel as active when no channel was previously selected', async () => {
    youtubeApi.getChannels.mockResolvedValueOnce({
      status: 200,
      data: {
        data: [
          { _id: 'c1', isPrimary: false },
          { _id: 'c2', isPrimary: true },
        ],
      },
    })

    await useChannelStore.getState().fetchChannels()

    expect(useChannelStore.getState().channels).toHaveLength(2)
    expect(useChannelStore.getState().activeChannel).toEqual({ _id: 'c2', isPrimary: true })
    expect(useChannelStore.getState().isLoading).toBe(false)
  })

  it('falls back to the first channel when none is marked primary', async () => {
    youtubeApi.getChannels.mockResolvedValueOnce({
      status: 200,
      data: { data: [{ _id: 'c1', isPrimary: false }] },
    })

    await useChannelStore.getState().fetchChannels()

    expect(useChannelStore.getState().activeChannel).toEqual({ _id: 'c1', isPrimary: false })
  })

  it('keeps the currently active channel selected if it still exists in the refreshed list', async () => {
    useChannelStore.setState({
      activeChannel: { _id: 'c2', isPrimary: false, stats: { views: 5 } },
    })
    youtubeApi.getChannels.mockResolvedValueOnce({
      status: 200,
      data: {
        data: [
          { _id: 'c1', isPrimary: true },
          { _id: 'c2', isPrimary: false, stats: { views: 99 } },
        ],
      },
    })

    await useChannelStore.getState().fetchChannels()

    expect(useChannelStore.getState().activeChannel).toEqual({
      _id: 'c2',
      isPrimary: false,
      stats: { views: 99 },
    })
  })

  it('clears loading state and keeps channels empty on API failure', async () => {
    youtubeApi.getChannels.mockRejectedValueOnce({
      response: { status: 500, data: { message: 'Server error' } },
    })

    await useChannelStore.getState().fetchChannels()

    expect(useChannelStore.getState().isLoading).toBe(false)
    expect(useChannelStore.getState().channels).toEqual([])
  })
})

describe('channelStore.addChannel / removeChannel', () => {
  it('sets the first added channel as active automatically', () => {
    useChannelStore.getState().addChannel({ _id: 'c1' })

    expect(useChannelStore.getState().channels).toEqual([{ _id: 'c1' }])
    expect(useChannelStore.getState().activeChannel).toEqual({ _id: 'c1' })
  })

  it('falls back to another channel when the active one is removed', () => {
    useChannelStore.setState({
      channels: [{ _id: 'c1' }, { _id: 'c2' }],
      activeChannel: { _id: 'c1' },
    })

    useChannelStore.getState().removeChannel('c1')

    expect(useChannelStore.getState().channels).toEqual([{ _id: 'c2' }])
    expect(useChannelStore.getState().activeChannel).toEqual({ _id: 'c2' })
  })

  it('sets active channel to null when the last channel is removed', () => {
    useChannelStore.setState({ channels: [{ _id: 'c1' }], activeChannel: { _id: 'c1' } })

    useChannelStore.getState().removeChannel('c1')

    expect(useChannelStore.getState().channels).toEqual([])
    expect(useChannelStore.getState().activeChannel).toBeNull()
  })
})

describe('channelStore.updateChannelStats', () => {
  it('merges stats into both the channel list and the active channel', () => {
    useChannelStore.setState({
      channels: [{ _id: 'c1', stats: { views: 1 } }],
      activeChannel: { _id: 'c1', stats: { views: 1 } },
    })

    useChannelStore.getState().updateChannelStats('c1', { views: 50 })

    expect(useChannelStore.getState().channels[0].stats).toEqual({ views: 50 })
    expect(useChannelStore.getState().activeChannel.stats).toEqual({ views: 50 })
  })
})
