// src/hooks/useChannel.js
import { useChannelStore } from '../store/channelStore'
import { youtubeApi } from '../api/youtube.api'
import toast from 'react-hot-toast'

export const useChannel = () => {
  const {
    channels, activeChannel, isLoading,
    fetchChannels, setActiveChannel,
    removeChannel, updateChannelStats,
  } = useChannelStore()

  const connectChannel = async () => {
    try {
      const res = await youtubeApi.getAuthUrl()
      const { authUrl } = res.data.data
      window.location.href = authUrl
    } catch (err) {
      toast.error('Failed to start YouTube connection')
    }
  }

  const disconnectChannel = async (channelId) => {
    try {
      await youtubeApi.disconnect(channelId)
      removeChannel(channelId)
      toast.success('Channel disconnected')
    } catch {
      toast.error('Failed to disconnect channel')
    }
  }

  const syncChannel = async (channelId) => {
    try {
      const res = await youtubeApi.syncChannel(channelId)
      const updated = res.data.data
      updateChannelStats(channelId, updated.stats)
      toast.success('Channel synced!')
    } catch {
      toast.error('Failed to sync channel')
    }
  }

  const setPrimary = async (channelId) => {
    try {
      await youtubeApi.setPrimary(channelId)
      await fetchChannels()
      toast.success('Primary channel updated')
    } catch {
      toast.error('Failed to update primary channel')
    }
  }

  const hasChannels = channels.length > 0
  const isAtLimit = (plan) => {
    const limits = { free: 1, creator: 1, pro: 3, agency: 25 }
    return channels.length >= (limits[plan] || 1)
  }

  return {
    channels,
    activeChannel,
    isLoading,
    hasChannels,
    connectChannel,
    disconnectChannel,
    syncChannel,
    setPrimary,
    setActiveChannel,
    fetchChannels,
    isAtLimit,
  }
}
