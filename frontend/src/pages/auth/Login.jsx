// src/pages/auth/Login.jsx
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Mail, Lock, Eye, EyeOff } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { Input } from '../../components/ui/Input'
import { Button } from '../../components/ui/Button'
import toast from 'react-hot-toast'

export const Login = () => {
  const { handleLogin, isLoading } = useAuth()
  const [form, setForm] = useState({ email: '', password: '' })
  const [showPass, setShowPass] = useState(false)
  const [errors, setErrors] = useState({})

  const validate = () => {
    const errs = {}
    if (!form.email) errs.email = 'Email is required'
    if (!form.password) errs.password = 'Password is required'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validate()) return

    const result = await handleLogin(form.email, form.password)
    if (!result.success) {
      toast.error(result.message || 'Login failed')
      if (result.message?.includes('verify')) {
        setErrors({ email: 'Please verify your email first' })
      }
    }
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display font-bold text-white text-3xl mb-2">Welcome back</h1>
        <p className="text-gray-500 text-sm">
          Sign in to your Creator Command Center
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Email"
          name="email"
          type="email"
          placeholder="you@example.com"
          value={form.email}
          onChange={(e) => setForm(p => ({ ...p, email: e.target.value }))}
          icon={Mail}
          error={errors.email}
          required
        />

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-300">Password</label>
          <div className="relative">
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500">
              <Lock size={16} />
            </div>
            <input
              type={showPass ? 'text' : 'password'}
              placeholder="••••••••"
              value={form.password}
              onChange={(e) => setForm(p => ({ ...p, password: e.target.value }))}
              className={`input-field pl-10 pr-10 ${errors.password ? 'border-rose/50' : ''}`}
            />
            <button
              type="button"
              onClick={() => setShowPass(!showPass)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
            >
              {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {errors.password && <p className="text-rose text-xs">{errors.password}</p>}
        </div>

        <div className="flex justify-end">
          <Link to="/forgot-password" className="text-sm text-brand hover:text-brand-light transition-colors">
            Forgot password?
          </Link>
        </div>

        <Button type="submit" fullWidth loading={isLoading} size="lg">
          Sign In
        </Button>
      </form>

      <div className="mt-6 text-center">
        <p className="text-gray-500 text-sm">
          Don't have an account?{' '}
          <Link to="/signup" className="text-brand hover:text-brand-light font-medium transition-colors">
            Sign up free
          </Link>
        </p>
      </div>

      {/* Founders highlight */}
      <div className="mt-8 p-4 rounded-xl border border-amber/20 bg-amber/5">
        <p className="text-amber text-xs font-medium mb-1">🏆 Founders Offer</p>
        <p className="text-gray-400 text-xs">
          Sign up now and lock in 50% off forever. Only {' '}
          <span className="text-white font-medium">88 spots</span> remaining on Creator plan.
        </p>
      </div>
    </div>
  )
}
