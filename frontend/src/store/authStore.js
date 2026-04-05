// src/store/authStore.js
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { authApi } from '../api/auth.api'

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      isLoading: false,
      isAuthenticated: false,

      // Login
      login: async (email, password) => {
        set({ isLoading: true })
        try {
          const res = await authApi.login({ email, password })
          const { user, accessToken } = res.data.data
          localStorage.setItem('accessToken', accessToken)
          set({ user, accessToken, isAuthenticated: true, isLoading: false })
          return { success: true }
        } catch (err) {
          set({ isLoading: false })
          return { success: false, message: err.response?.data?.message || 'Login failed' }
        }
      },

      // Register
      register: async (data) => {
        set({ isLoading: true })
        try {
          const res = await authApi.register(data)
          const { userId, requiresVerification } = res.data.data
          set({ isLoading: false })
          return { success: true, userId, requiresVerification }
        } catch (err) {
          set({ isLoading: false })
          return { success: false, message: err.response?.data?.message || 'Registration failed' }
        }
      },

      // Logout
      logout: async () => {
        try { await authApi.logout() } catch {}
        localStorage.removeItem('accessToken')
        set({ user: null, accessToken: null, isAuthenticated: false })
      },

      // Refresh user data
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
