// src/pages/auth/ResetPassword.jsx
import { useState } from 'react'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import { Lock, Eye, EyeOff, CheckCircle } from 'lucide-react'
import { authApi } from '../../api/auth.api'
import { Button } from '../../components/ui/Button'
import toast from 'react-hot-toast'

export const ResetPassword = () => {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const navigate = useNavigate()

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [errors, setErrors] = useState({})

  const validate = () => {
    const errs = {}
    if (password.length < 8) errs.password = 'At least 8 characters'
    if (!/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
      errs.password = 'Needs uppercase + number'
    }
    if (password !== confirm) errs.confirm = 'Passwords do not match'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validate()) return
    if (!token) { toast.error('Invalid reset link'); return }

    setLoading(true)
    try {
      await authApi.resetPassword(token, password)
      setSuccess(true)
      setTimeout(() => navigate('/login'), 2500)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Reset failed. Try again.')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="text-center py-12">
        <div className="w-14 h-14 bg-emerald/15 rounded-2xl flex items-center justify-center mx-auto mb-5">
          <CheckCircle size={24} className="text-emerald" />
        </div>
        <h2 className="font-display font-bold text-white text-2xl mb-2">Password reset!</h2>
        <p className="text-gray-400 text-sm">Redirecting to login...</p>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display font-bold text-white text-3xl mb-2">New password</h1>
        <p className="text-gray-500 text-sm">Choose a strong password for your account.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {[
          { label: 'New Password', value: password, onChange: setPassword, key: 'password', error: errors.password },
          { label: 'Confirm Password', value: confirm, onChange: setConfirm, key: 'confirm', error: errors.confirm },
        ].map(({ label, value, onChange, key, error }) => (
          <div key={key} className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-300">{label}</label>
            <div className="relative">
              <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500">
                <Lock size={16} />
              </div>
              <input
                type={showPass ? 'text' : 'password'}
                placeholder="••••••••"
                value={value}
                onChange={(e) => { onChange(e.target.value); setErrors(p => ({ ...p, [key]: '' })) }}
                className={`input-field pl-10 pr-10 ${error ? 'border-rose/50' : ''}`}
              />
              {key === 'password' && (
                <button type="button" onClick={() => setShowPass(!showPass)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              )}
            </div>
            {error && <p className="text-rose text-xs">{error}</p>}
          </div>
        ))}

        <Button type="submit" fullWidth loading={loading} size="lg">
          Reset Password
        </Button>
      </form>

      <div className="mt-6 text-center">
        <Link to="/login" className="text-gray-500 text-sm hover:text-gray-300 transition-colors">
          Back to login
        </Link>
      </div>
    </div>
  )
}
