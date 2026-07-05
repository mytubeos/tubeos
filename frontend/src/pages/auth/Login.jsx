// src/pages/auth/Login.jsx
import { useState, useEffect } from 'react'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import authApi from '../../api/auth.api'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Toast } from '../../components/ui/Toast'
import { Eye, EyeOff } from 'lucide-react'

export const Login = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { login, verifyEmail, isLoading: loading } = useAuthStore()

  useEffect(() => {
    if (searchParams.get('verified') === '1') {
      setSuccessMsg('Email verified! Now sign in with your password.')
    }
  }, [])

  const [formData, setFormData] = useState({ email: '', password: '' })
  const [localError, setLocalError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [showPwd, setShowPwd] = useState(false)

  // OTP flow when user is registered but not verified
  const [showOtp, setShowOtp] = useState(false)
  const [unverifiedUserId, setUnverifiedUserId] = useState('')
  const [otp, setOtp] = useState('')
  const [resending, setResending] = useState(false)
  const [otpMsg, setOtpMsg] = useState('')

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
    setLocalError('')
  }

  const validateForm = () => {
    if (!formData.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      setLocalError('Invalid email format')
      return false
    }
    if (!formData.password) {
      setLocalError('Password is required')
      return false
    }
    return true
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validateForm()) return

    const result = await login(formData.email, formData.password)

    if (result.success) {
      navigate('/dashboard')
    } else if (result.requiresVerification && result.userId) {
      // User registered but not verified — show OTP screen
      setUnverifiedUserId(result.userId)
      setShowOtp(true)
      setLocalError('')
      setOtpMsg('Enter the OTP sent to your email. Check Render logs if email not received.')
    } else {
      setLocalError(result.message || 'Login failed')
    }
  }

  const handleOtpChange = (e) => {
    setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))
    setLocalError('')
  }

  const handleOtpSubmit = async (e) => {
    e.preventDefault()
    if (otp.length !== 6) {
      setLocalError('OTP must be 6 digits')
      return
    }
    const result = await verifyEmail(unverifiedUserId, otp)
    if (result.success) {
      setShowOtp(false)
      setOtp('')
      setLocalError('')
      setOtpMsg('')
      setSuccessMsg('Email verified! Now sign in with your password.')
    } else {
      setLocalError(result.message || 'OTP verification failed')
    }
  }

  const handleResendOTP = async () => {
    setResending(true)
    setLocalError('')
    try {
      await authApi.resendOTP(formData.email)
      setOtpMsg('New OTP sent! Check Render logs or your email/spam folder.')
    } catch (err) {
      setLocalError(err.response?.data?.message || 'Failed to resend OTP')
    } finally {
      setResending(false)
    }
  }

  // ==================== OTP SCREEN (unverified user) ====================
  if (showOtp) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-white mb-2">Verify Email</h1>
            <p className="text-slate-400">Enter the 6-digit OTP for {formData.email}</p>
          </div>

          <form
            onSubmit={handleOtpSubmit}
            className="bg-slate-800/50 backdrop-blur-xl border border-slate-700 rounded-2xl p-8 shadow-2xl"
          >
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-200 mb-4 text-center">
                Verification Code
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={otp}
                onChange={handleOtpChange}
                placeholder="000000"
                maxLength="6"
                disabled={loading}
                className="w-full px-4 py-3 text-center text-3xl tracking-widest font-mono bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition disabled:opacity-50"
              />
            </div>

            {otpMsg && <Toast type="info" message={otpMsg} className="mb-4" />}
            {localError && <Toast type="error" message={localError} className="mb-4" />}

            <Button type="submit" disabled={loading || otp.length !== 6} className="w-full mb-4">
              {loading ? 'Verifying...' : 'Verify & Sign In'}
            </Button>

            <div className="text-center space-y-2">
              <p className="text-slate-400 text-sm">
                Didn't get the code?{' '}
                <button
                  type="button"
                  onClick={handleResendOTP}
                  disabled={resending || loading}
                  className="text-purple-400 hover:text-purple-300 disabled:opacity-50 font-medium"
                >
                  {resending ? 'Sending...' : 'Resend OTP'}
                </button>
              </p>
              <p className="text-slate-500 text-xs">
                <button
                  type="button"
                  onClick={() => setShowOtp(false)}
                  className="text-slate-400 hover:text-slate-300"
                >
                  ← Back to login
                </button>
              </p>
            </div>
          </form>
        </div>
      </div>
    )
  }

  // ==================== LOGIN FORM ====================
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">TubeOS</h1>
          <p className="text-slate-400">Sign in to your account</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-slate-800/50 backdrop-blur-xl border border-slate-700 rounded-2xl p-8 shadow-2xl"
        >
          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-200 mb-2">Email Address</label>
            <Input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="john@example.com"
              disabled={loading}
            />
          </div>

          <div className="mb-6">
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-medium text-slate-200">Password</label>
              <Link to="/forgot-password" className="text-xs text-purple-400 hover:text-purple-300">
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <Input
                type={showPwd ? 'text' : 'password'}
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="••••••••"
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPwd((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
              >
                {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {successMsg && <Toast type="success" message={successMsg} className="mb-4" />}
          {localError && <Toast type="error" message={localError} className="mb-4" />}

          <Button type="submit" disabled={loading} className="w-full mb-4">
            {loading ? 'Signing in...' : 'Sign In'}
          </Button>

          <p className="text-center text-slate-400">
            Don't have an account?{' '}
            <Link to="/signup" className="text-purple-400 hover:text-purple-300">
              Create one
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}
