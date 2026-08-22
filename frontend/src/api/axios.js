// src/api/axios.js
// FIX: withCredentials false in production (cross-origin cookies don't work on free tiers)
// FIX: Token stored only in localStorage — no cookie dependency

import axios from 'axios'
import toast from 'react-hot-toast'
import { API_URL } from '../utils/constants'

const api = axios.create({
  baseURL: API_URL,
  // FIX: withCredentials sirf same-origin pe kaam karta hai
  // Vercel (frontend) + Render (backend) = alag domains = cookies blocked
  // Isliye hum sirf localStorage token use karenge
  withCredentials: false,
  // Render's free tier cold-starts and can take 30-50s+ to wake from sleep
  // (see README's deploy notes) — a shorter timeout was killing legitimate
  // first-requests-after-idle before the server even got a chance to answer.
  timeout: 60000,
})

// ==================== REQUEST INTERCEPTOR ====================
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// ==================== RESPONSE INTERCEPTOR ====================
let isRefreshing = false
let failedQueue = []

// Session is tracked in two independent places: the raw tokens here in
// localStorage, and a separately-persisted Zustand blob (authStore.js,
// key 'tubeos-auth') holding isAuthenticated/user. Wiping only the tokens
// (as this file used to) left that blob stale-true, which could bounce a
// user between /login and /dashboard in a loop until a real login() call
// re-synced both. Dynamic import avoids a circular axios.js<->authStore.js
// import; setState (not the logout() action) skips an unnecessary/riskier
// network call — we're already mid-auth-failure, tokens are already gone.
const clearPersistedAuth = () => {
  import('../store/authStore').then((m) =>
    m.useAuthStore.setState({ user: null, isAuthenticated: false })
  )
  // Same reasoning as authStore.js's logout() — channelStore persists to its
  // own localStorage key and survives a plain auth-state reset otherwise,
  // leaking the previous account's channels into the next session on this
  // device.
  import('../store/channelStore').then((m) => m.useChannelStore.getState().clearChannels())
}

const processQueue = (error, token = null) => {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error)
    else resolve(token)
  })
  failedQueue = []
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    if (error.response?.status === 401 && !originalRequest._retry) {
      const isAuthRoute =
        originalRequest?.url?.includes('/auth/login') ||
        originalRequest?.url?.includes('/auth/register') ||
        originalRequest?.url?.includes('/auth/refresh')

      if (!isAuthRoute) {
        if (isRefreshing) {
          return new Promise((resolve, reject) => {
            failedQueue.push({ resolve, reject })
          }).then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`
            return api(originalRequest)
          })
        }

        originalRequest._retry = true
        isRefreshing = true

        try {
          // FIX: refreshToken body mein bhejo — cookie nahi kaam karega cross-origin
          const refreshToken = localStorage.getItem('refreshToken')
          if (!refreshToken) throw new Error('No refresh token')

          const res = await axios.post(
            `${API_URL}/auth/refresh`,
            { refreshToken },
            { withCredentials: false }
          )
          const { accessToken, refreshToken: newRefreshToken } = res.data.data
          localStorage.setItem('accessToken', accessToken)
          if (newRefreshToken) localStorage.setItem('refreshToken', newRefreshToken)
          api.defaults.headers.common.Authorization = `Bearer ${accessToken}`
          processQueue(null, accessToken)
          originalRequest.headers.Authorization = `Bearer ${accessToken}`
          return api(originalRequest)
        } catch (refreshError) {
          processQueue(refreshError, null)
          localStorage.removeItem('accessToken')
          localStorage.removeItem('refreshToken')
          clearPersistedAuth()
          window.location.href = '/login'
          return Promise.reject(refreshError)
        } finally {
          isRefreshing = false
        }
      }

      localStorage.removeItem('accessToken')
      localStorage.removeItem('refreshToken')
      clearPersistedAuth()
      window.location.href = '/login'
    }

    if (error.response?.status >= 500) {
      toast.error('Server error. Please try again.')
    }

    return Promise.reject(error)
  }
)

export default api
