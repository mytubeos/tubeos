// src/hooks/useAuth.js
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useChannelStore } from '../store/channelStore'

export const useAuth = () => {
  const { user, isAuthenticated, isLoading, login, register, logout, refreshUser } = useAuthStore()
  const { fetchChannels, clearChannels } = useChannelStore()
  const navigate = useNavigate()

  // On mount — if authenticated, refresh user + channels
  useEffect(() => {
    if (isAuthenticated && !user) {
      refreshUser()
    }
    if (isAuthenticated) {
      fetchChannels()
    }
  }, [isAuthenticated])

  const handleLogin = async (email, password) => {
    const result = await login(email, password)
    if (result.success) {
      await fetchChannels()
      navigate('/dashboard')
    }
    return result
  }

  const handleLogout = async () => {
    await logout()
    clearChannels()
    navigate('/login')
  }

  // Check if user has required plan
  const hasPlan = (...plans) => {
    if (!user) return false
    return plans.includes(user.plan)
  }

  // Check usage remaining
  const getUsagePercent = (type) => {
    if (!user) return 0
    const limits = {
      free:    { aiReplies: 10,   uploads: 0  },
      creator: { aiReplies: 500,  uploads: 5  },
      pro:     { aiReplies: 1200, uploads: 20 },
      agency:  { aiReplies: -1,   uploads: -1 },
    }
    const limit = limits[user.plan]?.[type]
    if (limit === -1) return 0 // unlimited
    const used = type === 'aiReplies'
      ? user.usage?.aiRepliesUsed || 0
      : user.usage?.uploadsUsed || 0
    return Math.min(100, Math.round((used / limit) * 100))
  }

  return {
    user,
    isAuthenticated,
    isLoading,
    handleLogin,
    handleLogout,
    register,
    refreshUser,
    hasPlan,
    getUsagePercent,
  }
}
