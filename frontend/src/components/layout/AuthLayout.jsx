// src/components/layout/AuthLayout.jsx
import { Outlet, Navigate } from 'react-router-dom'
import { Zap } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'

export const AuthLayout = () => {
  const { isAuthenticated } = useAuthStore()

  if (isAuthenticated) return <Navigate to="/dashboard" replace />

  return (
    <div className="min-h-screen bg-base-900 flex">

      {/* Left — Branding panel */}
      <div className="hidden lg:flex lg:w-[45%] bg-base-800 border-r border-white/8
                      flex-col justify-between p-10 relative overflow-hidden">

        {/* Glow Effects */}
        <div className="absolute top-0 left-0 w-96 h-96 bg-brand/10 rounded-full
                        blur-3xl -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-cyan/8 rounded-full
                        blur-3xl translate-x-1/2 translate-y-1/2 pointer-events-none" />

        {/* Logo */}
        <div className="flex items-center gap-3 relative z-10">
          <div className="w-10 h-10 bg-brand-gradient rounded-xl flex items-center justify-center shadow-brand">
            <Zap size={20} className="text-white" />
          </div>
          <div>
            <p className="font-display font-bold text-white text-xl">TubeOS</p>
            <p className="text-gray-500 text-xs">Creator Command Center</p>
          </div>
        </div>

        {/* Feature highlights */}
        <div className="space-y-5 relative z-10">
          <div>
            <h2 className="font-display font-bold text-white text-3xl leading-tight mb-3">
              The AI brain for
              <br />
              <span className="text-brand">YouTube creators</span>
            </h2>
            <p className="text-gray-400 text-sm leading-relaxed">
              Upload, schedule, analyze and automate your channel growth — all powered by AI.
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: 'Features', value: '100+' },
              { label: 'AI Modules', value: '5' },
              { label: 'Time Saved', value: '6hr/day' },
              { label: 'Plans', value: '4' },
            ].map(({ label, value }) => (
              <div key={label} className="glass p-4 rounded-xl">
                <p className="font-display font-bold text-white text-2xl">{value}</p>
                <p className="text-gray-500 text-xs mt-1">{label}</p>
              </div>
            ))}
          </div>

          {/* Features list */}
          <div className="space-y-2">
            {[
              '📊 Real-time analytics & heatmap',
              '🤖 AI comment replies in 1 click',
              '⏰ Smart scheduling (best time AI)',
              '🚀 Upload directly to YouTube',
              '📈 Growth predictions & insights',
            ].map(f => (
              <div key={f} className="flex items-center gap-2 text-sm text-gray-400">
                <div className="w-1.5 h-1.5 rounded-full bg-brand shrink-0" />
                {f}
              </div>
            ))}
          </div>
        </div>

        {/* Founders badge */}
        <div className="relative z-10">
          <div className="glass px-4 py-3 rounded-xl border border-brand/20 inline-flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-emerald animate-pulse" />
            <div>
              <p className="text-sm font-medium text-white">Founders Offer Active</p>
              <p className="text-xs text-gray-500">Lock in 50% off — limited spots</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right — Form */}
      <div className="flex-1 flex items-center justify-center p-6 relative">
        {/* Mobile logo */}
        <div className="absolute top-6 left-6 flex items-center gap-2 lg:hidden">
          <div className="w-8 h-8 bg-brand-gradient rounded-lg flex items-center justify-center">
            <Zap size={16} className="text-white" />
          </div>
          <p className="font-display font-bold text-white">TubeOS</p>
        </div>

        <div className="w-full max-w-md animate-slide-up">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
