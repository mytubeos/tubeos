// src/hooks/useChannel.js
import { useCallback } from 'react'
import { useChannelStore } from '../store/channelStore'
import { youtubeApi } from '../api/youtube.api'
import toast from 'react-hot-toast'

export const useChannel = () => {
  const { channels, activeChannel, isLoading, fetchChannels, setActiveChannel } = useChannelStore()

  // YouTube connect — popup flow with postMessage
  const connectYouTube = useCallback(async () => {
    try {
      const res = await youtubeApi.getAuthUrl()
      const { authUrl } = res.data?.data || {}
      if (!authUrl) throw new Error('Could not generate auth URL')

      const result = await youtubeApi.connectChannel(authUrl)

      if (result.success) {
        toast.success(result.channel ? `"${result.channel}" connected!` : 'YouTube connected!')
        await fetchChannels()
      } else if (result.error && result.error !== 'popup_closed') {
        const msgs = {
          access_denied: 'You cancelled the YouTube connection.',
          missing_params: 'Something went wrong. Please try again.',
          no_refresh_token:
            'Full access required. Remove this app from myaccount.google.com/permissions and try again.',
          reconnect_required: 'YouTube access was revoked. Please reconnect.',
          already_connected: 'This channel is already connected to another account.',
          connect_failed: 'Connection failed. Please try again.',
        }
        toast.error(msgs[result.error] || 'YouTube connection failed.')
      }
    } catch (err) {
      if (err.message?.includes('Popup blocked')) {
        toast.error('Popup blocked! Please allow popups for this site and try again.')
      } else if (err.response?.status === 403) {
        toast.error(err.response?.data?.message || 'Plan limit reached. Please upgrade.')
      } else {
        toast.error(err.message || 'Failed to connect YouTube')
      }
    }
  }, [fetchChannels])

  // OAuth callback URL params handle karo (Channels.jsx ke useEffect se)
  const handleOAuthReturn = useCallback(
    async (searchParams) => {
      const connected = searchParams.get('youtube_connected')
      const error = searchParams.get('youtube_error')
      const channel = searchParams.get('channel')

      if (connected === 'true') {
        toast.success(
          channel ? `"${channel}" connected successfully!` : 'YouTube channel connected!'
        )
        await fetchChannels()
        window.history.replaceState({}, '', window.location.pathname)
        return
      }

      if (error) {
        const msgs = {
          access_denied: 'You cancelled the YouTube connection.',
          missing_params: 'Something went wrong. Please try again.',
          no_refresh_token:
            'Could not get full access. Remove this app from myaccount.google.com/permissions and try again.',
          reconnect_required: 'YouTube access was revoked. Please disconnect and reconnect.',
          already_connected: 'This YouTube channel is already connected to another account.',
          connect_failed: 'Failed to connect YouTube. Please try again.',
        }
        toast.error(msgs[error] || 'YouTube connection failed.')
        window.history.replaceState({}, '', window.location.pathname)
      }
    },
    [fetchChannels]
  )

  const syncChannel = useCallback(
    async (channelId) => {
      try {
        await youtubeApi.syncChannel(channelId)
        await fetchChannels()
        toast.success('Channel synced!')
      } catch (err) {
        if (err.response?.data?.code === 'RECONNECT_REQUIRED') {
          toast.error('YouTube access expired. Please reconnect your channel.')
        } else {
          toast.error(err.response?.data?.message || 'Sync failed')
        }
      }
    },
    [fetchChannels]
  )

  const disconnectChannel = useCallback(
    async (channelId) => {
      try {
        await youtubeApi.disconnectChannel(channelId)
        await fetchChannels()
        toast.success('Channel disconnected')
      } catch (err) {
        toast.error(err.response?.data?.message || 'Failed to disconnect')
      }
    },
    [fetchChannels]
  )

  const setPrimary = useCallback(
    async (channelId) => {
      try {
        await youtubeApi.setPrimary(channelId)
        await fetchChannels()
        toast.success('Primary channel updated')
      } catch (err) {
        toast.error(err.response?.data?.message || 'Failed to set primary')
      }
    },
    [fetchChannels]
  )

  // Upgrade existing channel token to include yt-analytics.readonly scope
  // Same popup flow as connectYouTube but uses a different auth URL endpoint
  const upgradeAnalytics = useCallback(
    async (channelId) => {
      try {
        const res = await youtubeApi.getAnalyticsAuthUrl(channelId)
        const { authUrl } = res.data?.data || {}
        if (!authUrl) throw new Error('Could not generate auth URL')

        const result = await youtubeApi.connectChannel(authUrl)

        if (result.success) {
          toast.success('Analytics access granted! Sync now for real data.')
          await fetchChannels()
        } else if (result.error && result.error !== 'popup_closed') {
          const msgs = {
            access_denied: 'You cancelled. Analytics access not granted.',
            connect_failed: 'Failed to grant access. Please try again.',
          }
          toast.error(msgs[result.error] || 'Could not grant analytics access.')
        }
      } catch (err) {
        if (err.message?.includes('Popup blocked')) {
          toast.error('Popup blocked! Please allow popups and try again.')
        } else {
          toast.error(err.response?.data?.message || 'Failed to grant analytics access')
        }
      }
    },
    [fetchChannels]
  )

  return {
    channels,
    activeChannel,
    isLoading,
    fetchChannels,
    connectYouTube,
    upgradeAnalytics,
    handleOAuthReturn,
    syncChannel,
    disconnectChannel,
    setPrimary,
    setActiveChannel,
  }
}
