// src/api/youtube.api.js
import api from './axios'

export const youtubeApi = {
  getAuthUrl: () => api.get('/youtube/auth'),
  getChannels: () => api.get('/youtube/channels'),
  syncChannel: (id) => api.post(`/youtube/channels/${id}/sync`),
  setPrimary: (id) => api.patch(`/youtube/channels/${id}/primary`),
  disconnect: (id) => api.delete(`/youtube/channels/${id}`),
  getQuota: (id) => api.get(`/youtube/channels/${id}/quota`),
}

// Fix 1 & 2: Authenticated axios se URL lo, phir browser redirect karo.
// Direct <a href="/youtube/auth"> use mat karo — Bearer token header
// automatic nahi jaata browser navigation me.
export const handleConnectYoutube = async () => {
  try {
    const res = await youtubeApi.getAuthUrl()

    const url =
      res?.data?.data?.url ||
      res?.data?.data?.authUrl ||
      res?.data?.data?.oauthUrl ||
      res?.data?.url

    if (!url) {
      throw new Error('OAuth URL missing from server response')
    }

    window.location.assign(url)
  } catch (err) {
    console.error('YouTube connect failed:', err?.response?.data || err.message)
  }
}
