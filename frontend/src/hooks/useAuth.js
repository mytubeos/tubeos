// src/hooks/useAuth.js
// React hook for authentication logic
import { useState, useCallback, useEffect } from 'react';
import authAPI from '../api/auth.api';

const useAuth = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Load user from localStorage on mount
  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      fetchProfile();
    }
  }, []);

  // ==================== REGISTER ====================
  const register = useCallback(async (name, email, password, referralCode = null) => {
    setLoading(true);
    setError(null);
    try {
      const response = await authAPI.register(name, email, password, referralCode);
      const { user: userData, userId, requiresVerification } = response.data.data;

      // Store userId for OTP verification
      localStorage.setItem('pendingUserId', userId);
      localStorage.setItem('pendingEmail', email);

      return {
        success: true,
        userId,
        user: userData,
        requiresVerification,
        message: response.data.message,
      };
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.message || 'Registration failed';
      setError(errorMsg);
      return {
        success: false,
        error: errorMsg,
      };
    } finally {
      setLoading(false);
    }
  }, []);

  // ==================== VERIFY EMAIL OTP ====================
  const verifyEmail = useCallback(async (userId, otp) => {
    setLoading(true);
    setError(null);
    try {
      const response = await authAPI.verifyEmail(userId, otp);
      const { user: userData, accessToken, refreshToken } = response.data.data;

      // Store tokens
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', refreshToken);

      // Clear pending data
      localStorage.removeItem('pendingUserId');
      localStorage.removeItem('pendingEmail');

      setUser(userData);
      setIsAuthenticated(true);

      return {
        success: true,
        user: userData,
        message: response.data.message,
      };
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.message || 'OTP verification failed';
      setError(errorMsg);
      return {
        success: false,
        error: errorMsg,
      };
    } finally {
      setLoading(false);
    }
  }, []);

  // ==================== RESEND OTP ====================
  const resendOTP = useCallback(async (email) => {
    setLoading(true);
    setError(null);
    try {
      const response = await authAPI.resendOTP(email);
      return {
        success: true,
        userId: response.data.data.userId,
        message: response.data.message,
      };
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.message || 'Failed to resend OTP';
      setError(errorMsg);
      return {
        success: false,
        error: errorMsg,
      };
    } finally {
      setLoading(false);
    }
  }, []);

  // ==================== LOGIN ====================
  const login = useCallback(async (email, password) => {
    setLoading(true);
    setError(null);
    try {
      const response = await authAPI.login(email, password);
      const { user: userData, accessToken, refreshToken } = response.data.data;

      // Store tokens
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', refreshToken);

      setUser(userData);
      setIsAuthenticated(true);

      return {
        success: true,
        user: userData,
        message: response.data.message,
      };
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.message || 'Login failed';
      setError(errorMsg);
      return {
        success: false,
        error: errorMsg,
      };
    } finally {
      setLoading(false);
    }
  }, []);

  // ==================== FORGOT PASSWORD ====================
  const forgotPassword = useCallback(async (email) => {
    setLoading(true);
    setError(null);
    try {
      const response = await authAPI.forgotPassword(email);
      return {
        success: true,
        message: response.data.message,
      };
    } catch (err) {
      // Always return success for security (don't reveal if email exists)
      return {
        success: true,
        message: 'If an account exists, a password reset link has been sent.',
      };
    } finally {
      setLoading(false);
    }
  }, []);

  // ==================== RESET PASSWORD ====================
  const resetPassword = useCallback(async (token, password) => {
    setLoading(true);
    setError(null);
    try {
      const response = await authAPI.resetPassword(token, password);
      return {
        success: true,
        message: response.data.message,
      };
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.message || 'Password reset failed';
      setError(errorMsg);
      return {
        success: false,
        error: errorMsg,
      };
    } finally {
      setLoading(false);
    }
  }, []);

  // ==================== FETCH PROFILE ====================
  const fetchProfile = useCallback(async () => {
    setLoading(true);
    try {
      const response = await authAPI.getProfile();
      const userData = response.data.data;
      setUser(userData);
      setIsAuthenticated(true);
      return { success: true, user: userData };
    } catch (err) {
      // Token might be expired or invalid
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      setUser(null);
      setIsAuthenticated(false);
      return { success: false };
    } finally {
      setLoading(false);
    }
  }, []);

  // ==================== UPDATE PROFILE ====================
  const updateProfile = useCallback(async (updates) => {
    setLoading(true);
    setError(null);
    try {
      const response = await authAPI.updateProfile(updates);
      const userData = response.data.data;
      setUser(userData);
      return {
        success: true,
        user: userData,
        message: response.data.message,
      };
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.message || 'Update failed';
      setError(errorMsg);
      return {
        success: false,
        error: errorMsg,
      };
    } finally {
      setLoading(false);
    }
  }, []);

  // ==================== CHANGE PASSWORD ====================
  const changePassword = useCallback(async (currentPassword, newPassword) => {
    setLoading(true);
    setError(null);
    try {
      const response = await authAPI.changePassword(currentPassword, newPassword);
      // Clear tokens and redirect to login
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      setUser(null);
      setIsAuthenticated(false);
      return {
        success: true,
        message: response.data.message,
      };
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.message || 'Password change failed';
      setError(errorMsg);
      return {
        success: false,
        error: errorMsg,
      };
    } finally {
      setLoading(false);
    }
  }, []);

  // ==================== LOGOUT ====================
  const logout = useCallback(async () => {
    setLoading(true);
    try {
      await authAPI.logout();
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      // Clear everything regardless of API response
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      setUser(null);
      setIsAuthenticated(false);
      setLoading(false);
    }
  }, []);

  // ==================== LOGOUT ALL ====================
  const logoutAll = useCallback(async () => {
    setLoading(true);
    try {
      await authAPI.logoutAll();
    } catch (err) {
      console.error('Logout all error:', err);
    } finally {
      // Clear everything regardless of API response
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      setUser(null);
      setIsAuthenticated(false);
      setLoading(false);
    }
  }, []);

  return {
    // State
    user,
    loading,
    error,
    isAuthenticated,

    // Methods
    register,
    verifyEmail,
    resendOTP,
    login,
    forgotPassword,
    resetPassword,
    fetchProfile,
    updateProfile,
    changePassword,
    logout,
    logoutAll,

    // Utility
    setError,
  };
};

export default useAuth;
        
