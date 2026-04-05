// src/api/auth.api.js
import api from './axios'

export const authApi = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  logout: () => api.post('/auth/logout'),
  logoutAll: () => api.post('/auth/logout-all'),
  verifyEmail: (token, data) => {
    if (data?.otp) return api.post('/auth/verify-email', data)
    return api.get(`/auth/verify-email?token=${token}`)
  },
  resendOTP: (email) => api.post('/auth/resend-otp', { email }),
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
  resetPassword: (token, password) => api.post(`/auth/reset-password?token=${token}`, { password }),
  getMe: () => api.get('/auth/me'),
  updateMe: (data) => api.patch('/auth/me', data),
  changePassword: (data) => api.patch('/auth/change-password', data),
  refresh: () => api.post('/auth/refresh'),
}
