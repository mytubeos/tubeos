// src/App.jsx
import { Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import { useAuthStore } from './store/authStore'

// Layouts
import { AuthLayout } from './components/layout/AuthLayout'
import { DashboardLayout } from './components/layout/DashboardLayout'

// Auth Pages
import { Login } from './pages/auth/Login'
import { Signup } from './pages/auth/Signup'
import { VerifyEmail } from './pages/auth/VerifyEmail'
import { ForgotPassword } from './pages/auth/ForgotPassword'
import { ResetPassword } from './pages/auth/ResetPassword'

// Public Pages
import { Landing } from './pages/Landing'
import { Pricing } from './pages/Pricing'

// Part 2
import { Dashboard } from './pages/dashboard/Dashboard'
import { Analytics } from './pages/analytics/Analytics'
import { VideoAnalytics } from './pages/analytics/VideoAnalytics'
import { Heatmap } from './pages/analytics/Heatmap'

// Part 3
import { Scheduler } from './pages/scheduler/Scheduler'
import { Videos } from './pages/videos/Videos'
import { VideoUpload } from './pages/videos/VideoUpload'
import { CommentInbox } from './pages/comments/CommentInbox'

// Part 4
import { AIContent } from './pages/ai/AIContent'
import { ShortsStudio } from './pages/ai/ShortsStudio'
import { Growth } from './pages/growth/Growth'
import { Channels } from './pages/channels/Channels'
import { Settings } from './pages/settings/Settings'
import { Referral } from './pages/referral/Referral'

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated } = useAuthStore()
  return isAuthenticated ? children : <Navigate to="/login" replace />
}

export default function App() {
  const { isAuthenticated, refreshUser } = useAuthStore()
  useEffect(() => { if (isAuthenticated) refreshUser() }, [])

  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/pricing" element={<Pricing />} />

      <Route element={<AuthLayout />}>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
      </Route>

      <Route path="/verify-email" element={<VerifyEmail />} />

      <Route element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/analytics/video/:videoId" element={<VideoAnalytics />} />
        <Route path="/heatmap" element={<Heatmap />} />
        <Route path="/scheduler" element={<Scheduler />} />
        <Route path="/videos" element={<Videos />} />
        <Route path="/videos/upload" element={<VideoUpload />} />
        <Route path="/comments" element={<CommentInbox />} />
        <Route path="/ai" element={<AIContent />} />
        <Route path="/ai/shorts" element={<ShortsStudio />} />
        <Route path="/growth" element={<Growth />} />
        <Route path="/channels" element={<Channels />} />
        <Route path="/referral" element={<Referral />} />
        <Route path="/settings" element={<Settings />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
