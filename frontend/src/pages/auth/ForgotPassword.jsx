// src/pages/auth/ForgotPassword.jsx
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Mail, ArrowLeft } from 'lucide-react'
import { authApi } from '../../api/auth.api'
import { Input } from '../../components/ui/Input'
import { Button } from '../../components/ui/Button'

export const ForgotPassword = () => {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email) { setError('Email is required'); return }
    setLoading(true)
    try {
      await authApi.forgotPassword(email)
      setSent(true)
    } catch {
      setError('Something went wrong. Try again.')
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div className="text-center py-8">
        <div className="w-14 h-14 bg-brand/15 rounded-2xl flex items-center justify-center mx-auto mb-5">
          <Mail size={24} className="text-brand" />
        </div>
        <h2 className="font-display font-bold text-white text-2xl mb-2">Check your email</h2>
        <p className="text-gray-400 text-sm mb-6">
          If <span className="text-white">{email}</span> is registered, you'll get a reset link.
        </p>
        <p className="text-gray-500 text-xs">Link expires in 10 minutes.</p>
        <div className="mt-8">
          <Link to="/login" className="text-brand text-sm hover:underline flex items-center justify-center gap-2">
            <ArrowLeft size={16} /> Back to login
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display font-bold text-white text-3xl mb-2">Reset password</h1>
        <p className="text-gray-500 text-sm">Enter your email to receive a reset link.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <Input
          label="Email"
          name="email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => { setEmail(e.target.value); setError('') }}
          icon={Mail}
          error={error}
          required
        />

        <Button type="submit" fullWidth loading={loading} size="lg">
          Send Reset Link
        </Button>
      </form>

      <div className="mt-6 text-center">
        <Link to="/login" className="text-gray-500 text-sm hover:text-gray-300 flex items-center justify-center gap-1.5 transition-colors">
          <ArrowLeft size={14} /> Back to login
        </Link>
      </div>
    </div>
  )
}
