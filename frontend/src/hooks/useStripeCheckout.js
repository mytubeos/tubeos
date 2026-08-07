// src/hooks/useStripeCheckout.js
import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import paymentAPI from '../api/payment.api'
import { useAuthStore } from '../store/authStore'

// Alternate to useRazorpay — used only when a user's card doesn't work on
// Razorpay. Stripe Checkout is a full-page redirect (not a modal), so instead
// of an in-page handler callback, this hook also watches for the
// ?stripe_session_id= Stripe redirects back with and finishes activation then.
export const useStripeCheckout = ({ onSuccess } = {}) => {
  const [loadingPlan, setLoadingPlan] = useState(null)
  const [verifying, setVerifying] = useState(false)
  const { updateUser } = useAuthStore()
  const [searchParams, setSearchParams] = useSearchParams()

  const startStripeCheckout = async (plan, couponCode = null) => {
    if (loadingPlan) return
    setLoadingPlan(plan)
    try {
      const res = await paymentAPI.createStripeCheckout(plan, couponCode)
      window.location.href = res.data.data.url
      // Do NOT clear loadingPlan here — this tab is navigating away to Stripe.
    } catch (err) {
      toast.error(err.response?.data?.message || 'Something went wrong')
      setLoadingPlan(null)
    }
  }

  useEffect(() => {
    const sessionId = searchParams.get('stripe_session_id')
    const cancelled = searchParams.get('stripe_cancelled')

    if (cancelled) {
      toast('Payment cancelled.')
      setSearchParams(
        (p) => {
          p.delete('stripe_cancelled')
          return p
        },
        { replace: true }
      )
      return
    }

    if (!sessionId) return

    setVerifying(true)
    paymentAPI
      .verifyStripeSession(sessionId)
      .then((res) => {
        const { plan } = res.data.data
        updateUser({ plan })
        toast.success('Plan activated!')
        if (onSuccess) onSuccess(plan)
      })
      .catch(() => {
        toast.error('Payment verification failed. Please contact support.')
      })
      .finally(() => {
        setVerifying(false)
        setSearchParams(
          (p) => {
            p.delete('stripe_session_id')
            return p
          },
          { replace: true }
        )
      })
    // Only meant to run once, against whatever URL Stripe redirected back
    // with on mount — not a live subscription to search-param changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { startStripeCheckout, loadingPlan, verifying }
}
