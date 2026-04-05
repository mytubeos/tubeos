// src/pages/auth/VerifyEmail.jsx
import { useState, useEffect, useRef } from 'react'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import { CheckCircle, XCircle, RefreshCw, Mail } from 'lucide-react'
import { authApi } from '../../api/auth.api'
import { Button } from '../../components/ui/Button'
import { Spinner } from '../../components/ui/Spinner'
import toast from 'react-hot-toast'
import { useAuthStore } from '../../store/authStore'

export const VerifyEmail = () => {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  // OTP flow params
  const userId = searchParams.get('userId')
  const email = searchParams.get('email')
  // Legacy link flow
  const token = searchParams.get('token')

  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [countdown, setCountdown] = useState(60)

  const inputRefs = useRef([])

  // Auto-verify if legacy token link
  useEffect(() => {
    if (token && !userId) {
      setLoading(true)
      authApi.verifyEmail(token)
        .then(res => {
          const { accessToken, user } = res.data.data
          localStorage.setItem('accessToken', accessToken)
          useAuthStore.setState({ user, accessToken, isAuthenticated: true })
          setSuccess(true)
          setTimeout(() => navigate('/dashboard'), 2000)
        })
        .catch(() => setError('Link expired or invalid'))
        .finally(() => setLoading(false))
    }
  }, [token])

  // Countdown for resend
  useEffect(() => {
    if (countdown > 0) {
      const t = setTimeout(() => setCountdown(c => c - 1), 1000)
      return () => clearTimeout(t)
    }
  }, [countdown])

  const handleOtpChange = (index, value) => {
    if (!/^\d*$/.test(value)) return
    const newOtp = [...otp]
    newOtp[index] = value.slice(-1)
    setOtp(newOtp)
    setError('')

    // Auto focus next
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }

    // Auto submit when all 6 filled
    if (newOtp.every(d => d !== '') && value) {
      handleVerify(newOtp.join(''))
    }
  }

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  const handlePaste = (e) => {
    const paste = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (paste.length === 6) {
      const newOtp = paste.split('')
      setOtp(newOtp)
      handleVerify(paste)
    }
  }

  const handleVerify = async (otpValue) => {
    const otpString = otpValue || otp.join('')
    if (otpString.length !== 6) {
      setError('Enter complete 6-digit OTP')
      return
    }

    setLoading(true)
    try {
      const res = await authApi.verifyEmail(null, { otp: otpString, userId })
      const { accessToken, user } = res.data.data
      localStorage.setItem('accessToken', accessToken)
      useAuthStore.setState({ user, accessToken, isAuthenticated: true })
      setSuccess(true)
      toast.success('Email verified! Welcome to TubeOS!')
      setTimeout(() => navigate('/dashboard'), 1500)
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid OTP. Try again.')
      setOtp(['', '', '', '', '', ''])
      inputRefs.current[0]?.focus()
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    if (countdown > 0 || !email) return
    setResending(true)
    try {
      await authApi.resendOTP(email)
      setCountdown(60)
      setOtp(['', '', '', '', '', ''])
      toast.success('New OTP sent!')
      inputRefs.current[0]?.focus()
    } catch {
      toast.error('Failed to resend OTP')
    } finally {
      setResending(false)
    }
  }

  // Legacy token loading
  if (token && !userId && loading) {
    return (
      <div className="text-center py-16">
        <Spinner size="lg" className="mx-auto mb-4" />
        <p className="text-gray-400">Verifying your email...</p>
      </div>
    )
  }

  // Legacy token error
  if (token && !userId && error) {
    return (
      <div className="text-center py-12">
        <div className="w-14 h-14 bg-rose/15 rounded-2xl flex items-center justify-center mx-auto mb-5">
          <XCircle size={24} className="text-rose" />
        </div>
        <h2 className="font-display font-bold text-white text-2xl mb-2">Link Expired</h2>
        <p className="text-gray-400 text-sm mb-6">This verification link is invalid or has expired.</p>
        <Link to="/login">
          <Button>Back to Login</Button>
        </Link>
      </div>
    )
  }

  // Success state
  if (success) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 bg-emerald/15 rounded-2xl flex items-center justify-center mx-auto mb-5">
          <CheckCircle size={28} className="text-emerald" />
        </div>
        <h2 className="font-display font-bold text-white text-2xl mb-2">Email Verified!</h2>
        <p className="text-gray-400 text-sm mb-2">Redirecting to dashboard...</p>
        <Spinner size="sm" className="mx-auto" />
      </div>
    )
  }

  // OTP input UI
  return (
    <div>
      <div className="mb-8 text-center">
        <div className="w-14 h-14 bg-brand/15 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Mail size={24} className="text-brand" />
        </div>
        <h1 className="font-display font-bold text-white text-3xl mb-2">Check your email</h1>
        <p className="text-gray-500 text-sm">
          We sent a 6-digit OTP to
          {email && <span className="text-white font-medium"> {email}</span>}
        </p>
      </div>

      {/* OTP Input */}
      <div className="flex items-center justify-center gap-3 mb-6" onPaste={handlePaste}>
        {otp.map((digit, i) => (
          <input
            key={i}
            ref={el => inputRefs.current[i] = el}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={digit}
            onChange={e => handleOtpChange(i, e.target.value)}
            onKeyDown={e => handleKeyDown(i, e)}
            className={`w-12 h-14 text-center text-xl font-bold rounded-xl border
                        bg-base-600 text-white transition-all duration-200
                        focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand
                        ${error ? 'border-rose/50' : 'border-white/10'}
                        ${digit ? 'border-brand/50 bg-brand/10' : ''}`}
          />
        ))}
      </div>

      {error && (
        <p className="text-rose text-sm text-center mb-4">{error}</p>
      )}

      <Button
        fullWidth
        size="lg"
        loading={loading}
        disabled={otp.some(d => !d)}
        onClick={() => handleVerify()}
      >
        Verify OTP
      </Button>

      {/* Resend */}
      <div className="mt-5 text-center">
        <p className="text-gray-500 text-sm">
          Didn't receive it?{' '}
          {countdown > 0 ? (
            <span className="text-gray-600">Resend in {countdown}s</span>
          ) : (
            <button
              onClick={handleResend}
              disabled={resending}
              className="text-brand hover:text-brand-light font-medium transition-colors"
            >
              {resending ? 'Sending...' : 'Resend OTP'}
            </button>
          )}
        </p>
      </div>

      <div className="mt-4 text-center">
        <Link to="/login" className="text-gray-500 text-sm hover:text-gray-300 transition-colors">
          Back to login
        </Link>
      </div>
    </div>
  )
}
