// src/hooks/useChannel.js
// YouTube channel connection + management hook
//
// FIXES:
// 1. connectYouTube — popup flow use karo, direct redirect nahi
// 2. handleOAuthReturn — URL params se error/success handle karo (Channels.jsx se call hoga)
// 3. Error messages user-friendly banaye

import { useCallback } from 'react'
import { useChannelStore } from '../store/channelStore'
import { youtubeApi } from '../api/youtube.api'
import toast from 'react-hot-toast'

export const useChannel = () => {
  const {
    channels,
    activeChannel,
    isLoading,
    setChannels,
    setActiveChannel,
    setLoading,
  } = useChannelStore()

  // Channels fetch karo
  const fetchChannels = useCallback(async () => {
    try {
      setLoading(true)
      const res = await youtubeApi.getChannels()
      const list = res.data?.data || []
      setChannels(list)

      // Active channel set karo — primary pehle, phir pehla wala
      if (list.length > 0 && !activeChannel) {
        const primary = list.find(c => c.isPrimary) || list[0]
        setActiveChannel(primary)
      }
    } catch (err) {
      console.error('[useChannel] fetchChannels:', err.message)
      // Channels na milne pe crash nahi karna — empty array sahi hai
    } finally {
      setLoading(false)
    }
  }, [activeChannel, setChannels, setActiveChannel, setLoading])

  // FIX 1: YouTube connect — popup flow
  // Pehle backend se authUrl lo, phir popup mein kholo
  const connectYouTube = useCallback(async () => {
    try {
      setLoading(true)

      // Step 1: Backend se OAuth URL lo (state bhi generate hoga Redis mein)
      const res = await youtubeApi.getAuthUrl()
      const { authUrl } = res.data?.data || {}

      if (!authUrl) throw new Error('Could not generate auth URL')

      // Step 2: Popup mein OAuth kholo
      await youtubeApi.connectChannel(authUrl)

      // Step 3: Popup band hone ke baad channels refresh karo
      // (actual result URL params se milega — handleOAuthReturn dekho)
      await fetchChannels()

    } catch (err) {
      if (err.message?.includes('Popup blocked')) {
        toast.error('Popup blocked! Please allow popups for this site and try again.')
      } else if (err.statusCode === 403) {
        toast.error(err.response?.data?.message || 'Plan limit reached. Please upgrade.')
      } else {
        toast.error(err.message || 'Failed to connect YouTube')
      }
    } finally {
      setLoading(false)
    }
  }, [fetchChannels, setLoading])

  // FIX 2: OAuth callback ke baad URL params handle karo
  // Channels.jsx mein useEffect se call karo:
  // const params = new URLSearchParams(window.location.search)
  // useEffect(() => { handleOAuthReturn(params) }, [])
  const handleOAuthReturn = useCallback(async (searchParams) => {
    const connected = searchParams.get('youtube_connected')
    const error     = searchParams.get('youtube_error')
    const channel   = searchParams.get('channel')

    if (connected === 'true') {
      toast.success(
        channel
          ? `"${channel}" connected successfully!`
          : 'YouTube channel connected!'
      )
      await fetchChannels()
      // URL params clean karo
      window.history.replaceState({}, '', window.location.pathname)
      return
    }

    if (error) {
      const errorMessages = {
        access_denied:     'You cancelled the YouTube connection.',
        missing_params:    'Something went wrong. Please try again.',
        no_refresh_token:  'Could not get full access. Please go to myaccount.google.com/permissions, remove this app, and try again.',
        reconnect_required: 'YouTube access was revoked. Please disconnect and reconnect your channel.',
        already_connected: 'This YouTube channel is already connected to another account.',
        connect_failed:    'Failed to connect YouTube. Please try again.',
      }
      toast.error(errorMessages[error] || 'YouTube connection failed.')
      // URL params clean karo
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [fetchChannels])

  // Channel sync
  const syncChannel = useCallback(async (channelId) => {
    try {
      const res = await youtubeApi.syncChannel(channelId)
      await fetchChannels()
      toast.success('Channel synced!')
      return res.data?.data
    } catch (err) {
      // Token expire — reconnect message
      if (err.response?.data?.code === 'RECONNECT_REQUIRED') {
        toast.error('YouTube access expired. Please reconnect your channel.')
      } else {
        toast.error(err.response?.data?.message || 'Sync failed')
      }
    }
  }, [fetchChannels])

  // Channel disconnect
  const disconnectChannel = useCallback(async (channelId) => {
    try {
      await youtubeApi.disconnectChannel(channelId)
      await fetchChannels()
      toast.success('Channel disconnected')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to disconnect')
    }
  }, [fetchChannels])

  // Primary channel set
  const setPrimary = useCallback(async (channelId) => {
    try {
      await youtubeApi.setPrimary(channelId)
      await fetchChannels()
      toast.success('Primary channel updated')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to set primary')
    }
  }, [fetchChannels])

  return {
    channels,
    activeChannel,
    isLoading,
    fetchChannels,
    connectYouTube,
    handleOAuthReturn,
    syncChannel,
    disconnectChannel,
    setPrimary,
    setActiveChannel,
  }
}
