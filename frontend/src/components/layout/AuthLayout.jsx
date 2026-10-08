import { Outlet, Navigate, Link, useLocation } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'

export const AuthLayout = () => {
  const { isAuthenticated } = useAuthStore()
  const { pathname } = useLocation()
  // A reset link must remain usable even if another session is signed in.
  if (isAuthenticated && pathname !== '/reset-password') return <Navigate to="/dashboard" replace />

  return (
    <div className="auth-shell">
      <header className="w-full max-w-6xl mx-auto flex items-center justify-between gap-4 px-5 py-5 sm:px-8">
        <Link to="/" className="flex items-center gap-2.5 text-white" aria-label="Vezrin home">
          <img src="/icon.png" alt="" className="w-9 h-9 rounded-xl" />
          <span className="font-display font-bold text-lg">Vezrin</span>
        </Link>
        <span className="text-xs text-gray-400">Creator Command Center</span>
      </header>
      <main className="auth-content">
        <Outlet />
      </main>
      <footer className="flex flex-wrap justify-center gap-5 px-5 py-5 text-xs text-gray-400">
        <Link to="/privacy">Privacy Policy</Link>
        <Link to="/terms">Terms of Service</Link>
      </footer>
    </div>
  )
}
