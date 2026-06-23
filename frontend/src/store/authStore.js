// src/store/authStore.js
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import authApi from '../api/auth.api'

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      isLoading: false,
      isAuthenticated: false,

      // Login — FIX: was passing object, now passes separate args
      login: async (email, password) => {
        set({ isLoading: true })
        try {
          const res = await authApi.login(email, password)
          const { user, accessToken, refreshToken } = res.data.data
          localStorage.setItem('accessToken', accessToken)
          if (refreshToken) localStorage.setItem('refreshToken', refreshToken)
          set({ user, accessToken, isAuthenticated: true, isLoading: false })
          return { success: true }
        } catch (err) {
          set({ isLoading: false })
          const data = err.response?.data
          // 403 = email not verified — pass userId so Login.jsx can show OTP screen
          if (err.response?.status === 403 && data?.data?.requiresVerification) {
            return {
              success: false,
              message: data.message,
              requiresVerification: true,
              userId: data.data.userId,
            }
          }
          return { success: false, message: data?.message || 'Login failed' }
        }
      },

      // Register
      register: async (name, email, password, referralCode = null) => {
        set({ isLoading: true })
        try {
          const res = await authApi.register(name, email, password, referralCode)
          const { userId, requiresVerification } = res.data.data
          set({ isLoading: false })
          return { success: true, userId, requiresVerification }
        } catch (err) {
          set({ isLoading: false })
          return { success: false, message: err.response?.data?.message || 'Registration failed' }
        }
      },

      // Verify Email OTP — NEW: sets isAuthenticated after OTP verified
      verifyEmail: async (userId, otp) => {
        set({ isLoading: true })
        try {
          const res = await authApi.verifyEmail(userId, otp)
          const { user, accessToken, refreshToken } = res.data.data
          localStorage.setItem('accessToken', accessToken)
          if (refreshToken) localStorage.setItem('refreshToken', refreshToken)
          set({ user, accessToken, isAuthenticated: true, isLoading: false })
          return { success: true }
        } catch (err) {
          set({ isLoading: false })
          return { success: false, message: err.response?.data?.message || 'OTP verification failed' }
        }
      },

      // Logout
      logout: async () => {
        try { await authApi.logout() } catch {}
        localStorage.removeItem('accessToken')
        localStorage.removeItem('refreshToken')
        set({ user: null, accessToken: null, isAuthenticated: false })
      },

      // Refresh user data from server
      refreshUser: async () => {
        try {
          const res = await authApi.getMe()
          set({ user: res.data.data, isAuthenticated: true })
        } catch {
          get().logout()
        }
      },

      // Update user locally
      updateUser: (updates) => {
        set(state => ({ user: { ...state.user, ...updates } }))
      },

      setLoading: (isLoading) => set({ isLoading }),
    }),
    {
      name: 'tubeos-auth',
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
)
