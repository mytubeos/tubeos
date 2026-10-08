import { Link, Navigate } from 'react-router-dom'
import { ArrowRight, BarChart3, Calendar, Sparkles } from 'lucide-react'
import { useAuthStore } from '../store/authStore'

export const AppWelcome = () => {
  const { isAuthenticated } = useAuthStore()
  if (isAuthenticated) return <Navigate to="/dashboard" replace />
  return (
    <main className="auth-shell items-center justify-center px-6 py-10">
      <div className="w-full max-w-md text-center">
        <img src="/icon.png" alt="" className="w-20 h-20 rounded-3xl mx-auto mb-5" />
        <p className="font-display font-bold text-white text-xl mb-4">Vezrin</p>
        <h1 className="font-display text-4xl leading-tight font-bold text-white mb-4">
          Your next chapter
          <br />
          <span className="text-brand">starts here.</span>
        </h1>
        <p className="text-gray-300 leading-relaxed mb-8">
          Create, plan and grow your YouTube channel from one workspace.
        </p>
        <div className="grid grid-cols-3 gap-2 mb-8">
          {[
            { icon: Sparkles, text: 'Create with AI' },
            { icon: Calendar, text: 'Plan content' },
            { icon: BarChart3, text: 'Track growth' },
          ].map(({ icon: Icon, text }) => (
            <div key={text} className="glass py-4 px-2">
              <Icon size={22} className="text-brand mx-auto mb-2" />
              <p className="text-xs text-gray-300">{text}</p>
            </div>
          ))}
        </div>
        <Link
          to="/signup"
          className="flex items-center justify-center gap-2 rounded-xl bg-brand min-h-12 text-white font-medium"
        >
          Get Started Free <ArrowRight size={18} />
        </Link>
        <Link
          to="/login"
          className="flex items-center justify-center min-h-12 mt-3 rounded-xl border border-white/10 text-gray-200"
        >
          Sign In
        </Link>
        <Link
          to="/pricing"
          className="inline-flex items-center min-h-11 mt-4 text-sm text-gray-400"
        >
          Explore plans
        </Link>
      </div>
    </main>
  )
}
