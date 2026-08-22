// src/hooks/useDodoCheckout.js
import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import paymentAPI from '../api/payment.api'
import { useAuthStore } from '../store/authStore'

const PENDING_PLAN_KEY = 'dodo_pending_plan'
const POLL_INTERVAL_MS = 2000
const POLL_ATTEMPTS = 8 // ~16s — generous for a webhook that's usually near-instant

// Primary checkout — Dodo Payments (Merchant of Record, USD-only). Full-page
// redirect like Stripe, but unlike Stripe there's no server-side "retrieve
// checkout by id" endpoint to independently verify against, and the
// payment_id/status query params Dodo appends to the return URL are
// browser-controlled (spoofable) — never trust them for activation. Instead,
// after redirect-back this polls the user's own profile until the
// webhook-driven activation (dodo.service.js) shows up as a real plan change.
export const useDodoCheckout = ({ onSuccess } = {}) => {
  const [loadingPlan, setLoadingPlan] = useState(null)
  const [verifying, setVerifying] = useState(false)
  const { refreshUser } = useAuthStore()
  const [searchParams, setSearchParams] = useSearchParams()
  const pollTimer = useRef(null)

  const startDodoCheckout = async (plan) => {
    if (loadingPlan) return
    setLoadingPlan(plan)
    try {
      const res = await paymentAPI.createDodoCheckout(plan)
      sessionStorage.setItem(PENDING_PLAN_KEY, plan)
      window.location.href = res.data.data.url
      // Do NOT clear loadingPlan here — this tab is navigating away to Dodo.
    } catch (err) {
      toast.error(err.response?.data?.message || 'Something went wrong')
      setLoadingPlan(null)
    }
  }

  useEffect(() => {
    const returned = searchParams.get('dodo_return')
    if (!returned) return

    const clearReturnParam = () => {
      setSearchParams(
        (p) => {
          p.delete('dodo_return')
          p.delete('payment_id')
          p.delete('status')
          p.delete('email')
          return p
        },
        { replace: true }
      )
    }

    const pendingPlan = sessionStorage.getItem(PENDING_PLAN_KEY)
    sessionStorage.removeItem(PENDING_PLAN_KEY)

    if (!pendingPlan) {
      clearReturnParam()
      return
    }

    setVerifying(true)
    let attempts = 0

    const poll = async () => {
      attempts += 1
      await refreshUser()
      const currentPlan = useAuthStore.getState().user?.plan

      if (currentPlan === pendingPlan) {
        setVerifying(false)
        toast.success('Plan activated!')
        if (onSuccess) onSuccess(currentPlan)
        clearReturnParam()
        return
      }

      if (attempts >= POLL_ATTEMPTS) {
        setVerifying(false)
        toast('Payment received — activating your plan, refresh in a moment if it doesn’t update.')
        clearReturnParam()
        return
      }

      pollTimer.current = setTimeout(poll, POLL_INTERVAL_MS)
    }

    poll()

    return () => {
      if (pollTimer.current) clearTimeout(pollTimer.current)
    }
    // Only meant to run once, against whatever URL Dodo redirected back with
    // on mount — not a live subscription to search-param changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { startDodoCheckout, loadingPlan, verifying }
}
