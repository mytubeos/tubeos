// src/api/axios.js
// Configured axios instance with auth + refresh token logic

import axios from 'axios'
import toast from 'react-hot-toast'
import { API_URL } from '../utils/constants'

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true, // Send cookies (refresh token)
  timeout: 30000,
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

    // Try a single refresh for most 401s (expired, missing, invalid token)
    if (error.response?.status === 401 && !originalRequest._retry) {
      const isAuthRoute = originalRequest?.url?.includes('/auth/login') ||
        originalRequest?.url?.includes('/auth/register') ||
        originalRequest?.url?.includes('/auth/refresh')

      if (!isAuthRoute) {
        if (isRefreshing) {
          return new Promise((resolve, reject) => {
            failedQueue.push({ resolve, reject })
          }).then(token => {
            originalRequest.headers.Authorization = `Bearer ${token}`
            return api(originalRequest)
          })
        }

        originalRequest._retry = true
        isRefreshing = true

        try {
          const res = await axios.post(
            `${API_URL}/auth/refresh`,
            {},
            { withCredentials: false }
          )
          const { accessToken } = res.data.data
          localStorage.setItem('accessToken', accessToken)
          api.defaults.headers.common.Authorization = `Bearer ${accessToken}`
          processQueue(null, accessToken)
          originalRequest.headers.Authorization = `Bearer ${accessToken}`
          return api(originalRequest)
        } catch (refreshError) {
          processQueue(refreshError, null)
          localStorage.removeItem('accessToken')
          window.location.href = '/login'
          return Promise.reject(refreshError)
        } finally {
          isRefreshing = false
        }
      }

      localStorage.removeItem('accessToken')
      window.location.href = '/login'
    }

    // Show error toast for non-401
    if (error.response?.status >= 500) {
      toast.error('Server error. Please try again.')
    }

    return Promise.reject(error)
  }
)

export default api
