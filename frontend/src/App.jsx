// src/App.jsx
import { Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, lazy, Suspense } from 'react'
import { useAuthStore } from './store/authStore'

import { PageLoader } from './components/ui/Spinner'
import { AppWelcome } from './pages/AppWelcome'

// Layouts
import { AuthLayout } from './components/layout/AuthLayout'
import { DashboardLayout } from './components/layout/DashboardLayout'
const AdminLayout = lazy(() =>
  import('./pages/admin/AdminLayout').then((module) => ({ default: module.AdminLayout }))
)

// Admin Pages
const AdminDashboard = lazy(() =>
  import('./pages/admin/AdminDashboard').then((module) => ({ default: module.AdminDashboard }))
)
const AdminCoupons = lazy(() =>
  import('./pages/admin/AdminCoupons').then((module) => ({ default: module.AdminCoupons }))
)
const AdminUsers = lazy(() =>
  import('./pages/admin/AdminUsers').then((module) => ({ default: module.AdminUsers }))
)
const AdminPricing = lazy(() =>
  import('./pages/admin/AdminPricing').then((module) => ({ default: module.AdminPricing }))
)
const AdminPlanLimits = lazy(() =>
  import('./pages/admin/AdminPlanLimits').then((module) => ({ default: module.AdminPlanLimits }))
)
const AdminReportSettings = lazy(() =>
  import('./pages/admin/AdminReportSettings').then((module) => ({
    default: module.AdminReportSettings,
  }))
)

// Auth Pages
const Login = lazy(() => import('./pages/auth/Login').then((module) => ({ default: module.Login })))
const Signup = lazy(() =>
  import('./pages/auth/Signup').then((module) => ({ default: module.Signup }))
)
const VerifyEmail = lazy(() =>
  import('./pages/auth/VerifyEmail').then((module) => ({ default: module.VerifyEmail }))
)
const ForgotPassword = lazy(() =>
  import('./pages/auth/ForgotPassword').then((module) => ({ default: module.ForgotPassword }))
)
const ResetPassword = lazy(() =>
  import('./pages/auth/ResetPassword').then((module) => ({ default: module.ResetPassword }))
)

// Public Pages
const Landing = lazy(() =>
  import('./pages/Landing').then((module) => ({ default: module.Landing }))
)
const Pricing = lazy(() =>
  import('./pages/Pricing').then((module) => ({ default: module.Pricing }))
)
const YouTubeCallback = lazy(() =>
  import('./pages/YouTubeCallback').then((module) => ({ default: module.YouTubeCallback }))
)
const PrivacyPolicy = lazy(() =>
  import('./pages/PrivacyPolicy').then((module) => ({ default: module.PrivacyPolicy }))
)
const TermsAndConditions = lazy(() =>
  import('./pages/TermsAndConditions').then((module) => ({ default: module.TermsAndConditions }))
)

// Part 2
const Dashboard = lazy(() =>
  import('./pages/dashboard/Dashboard').then((module) => ({ default: module.Dashboard }))
)
const Analytics = lazy(() =>
  import('./pages/analytics/Analytics').then((module) => ({ default: module.Analytics }))
)
const VideoAnalytics = lazy(() =>
  import('./pages/analytics/VideoAnalytics').then((module) => ({ default: module.VideoAnalytics }))
)
const Heatmap = lazy(() =>
  import('./pages/analytics/Heatmap').then((module) => ({ default: module.Heatmap }))
)

// Part 3
const Scheduler = lazy(() =>
  import('./pages/scheduler/Scheduler').then((module) => ({ default: module.Scheduler }))
)
const Videos = lazy(() =>
  import('./pages/videos/Videos').then((module) => ({ default: module.Videos }))
)
const VideoUpload = lazy(() =>
  import('./pages/videos/VideoUpload').then((module) => ({ default: module.VideoUpload }))
)
const CommentInbox = lazy(() =>
  import('./pages/comments/CommentInbox').then((module) => ({ default: module.CommentInbox }))
)

// Part 4
const AIContent = lazy(() =>
  import('./pages/ai/AIContent').then((module) => ({ default: module.AIContent }))
)
const ShortsStudio = lazy(() =>
  import('./pages/ai/ShortsStudio').then((module) => ({ default: module.ShortsStudio }))
)
const Growth = lazy(() =>
  import('./pages/growth/Growth').then((module) => ({ default: module.Growth }))
)
const Channels = lazy(() =>
  import('./pages/channels/Channels').then((module) => ({ default: module.Channels }))
)
const Settings = lazy(() =>
  import('./pages/settings/Settings').then((module) => ({ default: module.Settings }))
)
const Referral = lazy(() =>
  import('./pages/referral/Referral').then((module) => ({ default: module.Referral }))
)

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated } = useAuthStore()
  return isAuthenticated ? children : <Navigate to="/login" replace />
}

const AdminRoute = ({ children }) => {
  const { isAuthenticated, user } = useAuthStore()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  // Only real admins (isAdmin flag from backend) may enter the admin panel.
  // Non-admins are bounced to their dashboard.
  if (!user?.isAdmin) return <Navigate to="/dashboard" replace />
  return children
}

export default function App() {
  const { isAuthenticated, refreshUser } = useAuthStore()
  useEffect(() => {
    const token = localStorage.getItem('accessToken')
    if (isAuthenticated && token) refreshUser()
  }, [])

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/app" element={<AppWelcome />} />
        <Route
          path="/"
          element={
            window.matchMedia?.('(display-mode: standalone)').matches ||
            window.navigator.standalone ? (
              <AppWelcome />
            ) : (
              <Landing />
            )
          }
        />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/terms" element={<TermsAndConditions />} />

        <Route element={<AuthLayout />}>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
        </Route>

        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/youtube-callback" element={<YouTubeCallback />} />

        <Route
          element={
            <ProtectedRoute>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
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

        {/* Admin Panel */}
        <Route
          element={
            <AdminRoute>
              <AdminLayout />
            </AdminRoute>
          }
        >
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/users" element={<AdminUsers />} />
          <Route path="/admin/coupons" element={<AdminCoupons />} />
          <Route path="/admin/pricing" element={<AdminPricing />} />
          <Route path="/admin/limits" element={<AdminPlanLimits />} />
          <Route path="/admin/report-settings" element={<AdminReportSettings />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}
