// VerifyEmail.jsx — this route (/verify-email) is not used in the normal flow.
// Real email verification is OTP-based inside Signup.jsx.
// Redirect anyone who lands here to /login.
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

export const VerifyEmail = () => {
  const navigate = useNavigate()
  useEffect(() => {
    navigate('/login', { replace: true })
  }, [navigate])
  return null
}
