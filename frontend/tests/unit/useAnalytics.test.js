import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

vi.mock('../../src/api/analytics.api', () => ({
  analyticsApi: {
    getOverview: vi.fn(),
    getDailyGraph: vi.fn(),
    getTopVideos: vi.fn(),
  },
}))

const { useAnalytics } = await import('../../src/hooks/useAnalytics')
const { useChannelStore } = await import('../../src/store/channelStore')
const { analyticsApi } = await import('../../src/api/analytics.api')

const INITIAL_STATE = useChannelStore.getState()

beforeEach(() => {
  useChannelStore.setState(INITIAL_STATE, true)
})

describe('useAnalytics', () => {
  it('does nothing while no channel is active', async () => {
    const { result } = renderHook(() => useAnalytics('30d'))

    expect(result.current.overview).toBeNull()
    expect(result.current.isLoading).toBe(false)
    expect(analyticsApi.getOverview).not.toHaveBeenCalled()
  })

  it('fetches overview, graph and top videos in parallel once a channel is active', async () => {
    useChannelStore.setState({ activeChannel: { _id: 'c1' } })
    analyticsApi.getOverview.mockResolvedValueOnce({
      data: { data: { metrics: { views: { value: 100 } } } },
    })
    analyticsApi.getDailyGraph.mockResolvedValueOnce({
      data: { data: [{ date: '2024-01-01', views: 10 }] },
    })
    analyticsApi.getTopVideos.mockResolvedValueOnce({ data: { data: { videos: [{ _id: 'v1' }] } } })

    const { result } = renderHook(() => useAnalytics('30d'))

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.overview).toEqual({ metrics: { views: { value: 100 } } })
    expect(result.current.graphData).toEqual([{ date: '2024-01-01', views: 10 }])
    expect(result.current.topVideos).toEqual([{ _id: 'v1' }])
    expect(analyticsApi.getOverview).toHaveBeenCalledWith('c1', '30d')
  })

  it('surfaces an error message and empty state when the fetch fails', async () => {
    useChannelStore.setState({ activeChannel: { _id: 'c1' } })
    analyticsApi.getOverview.mockRejectedValueOnce({
      response: { data: { message: 'Sync required' } },
    })
    analyticsApi.getDailyGraph.mockRejectedValueOnce({
      response: { data: { message: 'Sync required' } },
    })
    analyticsApi.getTopVideos.mockRejectedValueOnce({
      response: { data: { message: 'Sync required' } },
    })

    const { result } = renderHook(() => useAnalytics('30d'))

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.error).toBe('Sync required')
    expect(result.current.overview).toBeNull()
  })
})
