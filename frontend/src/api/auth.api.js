// src/api/auth.api.js
// FIX: Was using process.env.VITE_API_URL (Node.js) — Vite requires import.meta.env
// FIX: Now reuses the shared api instance from axios.js (correct baseURL + interceptors)
import api from './axios'

const authAPI = {
  register: (name, email, password, referralCode = null) =>
    api.post('/auth/register', {
      name,
      email,
      password,
      ...(referralCode && { referralCode }),
    }),

  verifyEmail: (userId, otp) =>
    api.post('/auth/verify-email', { userId, otp }),

  resendOTP: (email) =>
    api.post('/auth/resend-otp', { email }),

  login: (email, password) =>
    api.post('/auth/login', { email, password }),

  forgotPassword: (email) =>
    api.post('/auth/forgot-password', { email }),

  resetPassword: (token, password) =>
    api.post(`/auth/reset-password?token=${token}`, { password }),

  refresh: (refreshToken) =>
    api.post('/auth/refresh', { refreshToken }),

  getMe: () => api.get('/auth/me'),
  getProfile: () => api.get('/auth/me'),

  updateMe: (updates) => api.patch('/auth/me', updates),
  updateProfile: (updates) => api.patch('/auth/me', updates),

  changePassword: (currentPassword, newPassword) =>
    api.patch('/auth/change-password', { currentPassword, newPassword }),

  logout: () => api.post('/auth/logout'),
  logoutAll: () => api.post('/auth/logout-all'),

  updatePreferences: (prefs) => api.patch('/auth/preferences', prefs),
}

export default authAPI
