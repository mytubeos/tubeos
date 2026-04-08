// src/pages/auth/VerifyEmail.jsx
import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { CheckCircle, XCircle } from 'lucide-react'
import { authApi } from '../../api/auth.api'
import { useAuthStore } from '../../store/authStore'
import { Spinner } from '../../components/ui/Spinner'
import { Button } from '../../components/ui/Button'

export const VerifyEmail = () => {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const navigate = useNavigate()
  const { login } = useAuthStore()

  const [status, setStatus] = useState('loading') // loading | success | error

  useEffect(() => {
    const verify = async () => {
      if (!token) { setStatus('error'); return }
      try {
        const res = await authApi.verifyEmail(token)
        const { accessToken } = res.data.data
        localStorage.setItem('accessToken', accessToken)
        setStatus('success')
        setTimeout(() => navigate('/dashboard'), 2000)
      } catch {
        setStatus('error')
      }
    }
    verify()
  }, [token])

  if (status === 'loading') {
    return (
      <div className="text-center py-16">
        <Spinner size="lg" className="mx-auto mb-4" />
        <p className="text-gray-400">Verifying your email...</p>
      </div>
    )
  }

  if (status === 'success') {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 bg-emerald/15 rounded-2xl flex items-center justify-center mx-auto mb-5">
          <CheckCircle size={28} className="text-emerald" />
        </div>
        <h2 className="font-display font-bold text-white text-2xl mb-2">Email Verified!</h2>
        <p className="text-gray-400 text-sm mb-2">Taking you to your dashboard...</p>
        <Spinner size="sm" className="mx-auto" />
      </div>
    )
  }

  return (
    <div className="text-center py-12">
      <div className="w-16 h-16 bg-rose/15 rounded-2xl flex items-center justify-center mx-auto mb-5">
        <XCircle size={28} className="text-rose" />
      </div>
      <h2 className="font-display font-bold text-white text-2xl mb-2">Link Expired</h2>
      <p className="text-gray-400 text-sm mb-6">This verification link is invalid or has expired.</p>
      <Button onClick={() => navigate('/login')}>Back to Login</Button>
    </div>
  )
}
