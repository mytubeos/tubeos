// src/api/auth.api.js
// Frontend API calls for authentication
import axios from 'axios';

const API_BASE = process.env.VITE_API_URL || 'http://localhost:8080/api/v1';

// Create axios instance
const authClient = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests
authClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle token refresh on 401
authClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) {
          throw new Error('No refresh token');
        }

        const response = await axios.post(`${API_BASE}/auth/refresh`, {
          refreshToken,
        });

        const { accessToken, refreshToken: newRefreshToken } = response.data.data;
        localStorage.setItem('accessToken', accessToken);
        localStorage.setItem('refreshToken', newRefreshToken);

        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return authClient(originalRequest);
      } catch (refreshError) {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        window.location.href = '/auth/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

const authAPI = {
  // ==================== REGISTER ====================
  register: (name, email, password, referralCode = null) =>
    authClient.post('/auth/register', {
      name,
      email,
      password,
      ...(referralCode && { referralCode }),
    }),

  // ==================== VERIFY EMAIL OTP ====================
  verifyEmail: (userId, otp) =>
    authClient.post('/auth/verify-email', {
      userId,
      otp,
    }),

  // ==================== RESEND OTP ====================
  resendOTP: (email) =>
    authClient.post('/auth/resend-otp', { email }),

  // ==================== LOGIN ====================
  login: (email, password) =>
    authClient.post('/auth/login', {
      email,
      password,
    }),

  // ==================== FORGOT PASSWORD ====================
  forgotPassword: (email) =>
    authClient.post('/auth/forgot-password', { email }),

  // ==================== RESET PASSWORD ====================
  resetPassword: (token, password) =>
    authClient.post(`/auth/reset-password?token=${token}`, {
      password,
    }),

  // ==================== REFRESH TOKEN ====================
  refresh: (refreshToken) =>
    authClient.post('/auth/refresh', { refreshToken }),

  // ==================== GET PROFILE ====================
  getProfile: () => authClient.get('/auth/me'),

  // ==================== UPDATE PROFILE ====================
  updateProfile: (updates) =>
    authClient.patch('/auth/me', updates),

  // ==================== CHANGE PASSWORD ====================
  changePassword: (currentPassword, newPassword) =>
    authClient.patch('/auth/change-password', {
      currentPassword,
      newPassword,
    }),

  // ==================== LOGOUT ====================
  logout: () => authClient.post('/auth/logout'),

  // ==================== LOGOUT ALL ====================
  logoutAll: () => authClient.post('/auth/logout-all'),
};

export default authAPI;
