// src/hooks/useAnalytics.js
import { useState, useEffect, useCallback } from 'react'
import { analyticsApi } from '../api/analytics.api'
import { useChannelStore } from '../store/channelStore'

export const useAnalytics = (period = '30d') => {
  const { activeChannel } = useChannelStore()
  const channelId = activeChannel?._id

  const [overview, setOverview] = useState(null)
  const [graphData, setGraphData] = useState(null)
  const [topVideos, setTopVideos] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)

  const fetchOverview = useCallback(async () => {
    if (!channelId) return
    setIsLoading(true)
    setError(null)
    try {
      const [overviewRes, graphRes, videosRes] = await Promise.all([
        analyticsApi.getOverview(channelId, period),
        analyticsApi.getDailyGraph(channelId, period, 'views'),
        analyticsApi.getTopVideos(channelId, 5),
      ])
      setOverview(overviewRes.data.data)
      setGraphData(graphRes.data.data)
      setTopVideos(videosRes.data.data?.videos || [])
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch analytics')
    } finally {
      setIsLoading(false)
    }
  }, [channelId, period])

  useEffect(() => {
    fetchOverview()
  }, [fetchOverview])

  return {
    overview,
    graphData,
    topVideos,
    isLoading,
    error,
    refetch: fetchOverview,
    channelId,
  }
}
