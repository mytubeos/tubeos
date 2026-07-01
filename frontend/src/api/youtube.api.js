// src/api/youtube.api.js
import api from './axios'

export const youtubeApi = {

  getAuthUrl: () => api.get('/youtube/auth'),

  // OAuth popup — postMessage se parent ko notify hoga
  connectChannel: (authUrl) => {
    return new Promise((resolve, reject) => {
      const width  = 600
      const height = 700
      const left   = window.screenX + (window.outerWidth  - width)  / 2
      const top    = window.screenY + (window.outerHeight - height) / 2

      const popup = window.open(
        authUrl,
        'youtube-oauth',
        `width=${width},height=${height},left=${left},top=${top},scrollbars=yes`
      )

      if (!popup) {
        reject(new Error('Popup blocked. Please allow popups for this site.'))
        return
      }

      const timeout = setTimeout(() => {
        window.removeEventListener('message', onMessage)
        if (!popup.closed) popup.close()
        reject(new Error('OAuth timed out. Please try again.'))
      }, 5 * 60 * 1000)

      const onMessage = (event) => {
        if (event.origin !== window.location.origin) return
        const { type, channel, error } = event.data || {}

        if (type === 'YOUTUBE_CONNECTED') {
          clearTimeout(timeout)
          window.removeEventListener('message', onMessage)
          resolve({ success: true, channel })
        } else if (type === 'YOUTUBE_ERROR') {
          clearTimeout(timeout)
          window.removeEventListener('message', onMessage)
          resolve({ success: false, error })
        }
      }

      window.addEventListener('message', onMessage)

      // Fallback: agar popup manually close ho gaya aur koi message nahi aya
      // try-catch: COOP headers (Google OAuth page) block popup.closed access
      const checkClosed = setInterval(() => {
        try {
          if (popup.closed) {
            clearInterval(checkClosed)
            clearTimeout(timeout)
            window.removeEventListener('message', onMessage)
            resolve({ success: false, error: 'popup_closed' })
          }
        } catch {
          // COOP blocked — popup still open on Google's domain, ignore
        }
      }, 500)
    })
  },

  getChannels:          () => api.get('/youtube/channels'),
  syncChannel:          (channelId) => api.post(`/youtube/channels/${channelId}/sync`),
  disconnectChannel:    (channelId) => api.delete(`/youtube/channels/${channelId}`),
  setPrimary:           (channelId) => api.patch(`/youtube/channels/${channelId}/primary`),
  getQuota:             (channelId) => api.get(`/youtube/channels/${channelId}/quota`),
  getAnalyticsAuthUrl:  (channelId) => api.get(`/youtube/channels/${channelId}/analytics-auth`),
}
