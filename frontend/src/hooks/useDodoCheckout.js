// src/hooks/useDodoCheckout.js
import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuthStore } from '../store/authStore'
import paymentAPI from '../api/payment.api'

const PENDING_PLAN_KEY = 'dodo_pending_plan'
const BASELINE_KEY = 'dodo_pending_baseline'
const POLL_INTERVAL_MS = 2000
const POLL_ATTEMPTS = 8 // ~16s — generous for a webhook that's usually near-instant

// Primary checkout — Dodo Payments (Merchant of Record, USD-only). Full-page
// redirect like Stripe, but unlike Stripe there's no server-side "retrieve
// checkout by id" endpoint to independently verify against, and the
// payment_id/status query params Dodo appends to the return URL are
// browser-controlled (spoofable) — never trust them for activation. Instead,
// after redirect-back this polls the user's own profile until the
// webhook-driven activation (dodo.service.js) shows up as a real plan change.
export const useDodoCheckout = ({ onSuccess, enabled = false } = {}) => {
  const [loadingPlan, setLoadingPlan] = useState(null)
  const [verifying, setVerifying] = useState(false)
  const { refreshUser } = useAuthStore()
  const [searchParams, setSearchParams] = useSearchParams()
  const pollTimer = useRef(null)
  const checkoutBusy = useRef(false)

  const startDodoCheckout = async (plan) => {
    if (!enabled)
      return toast.error(
        'New purchases are temporarily unavailable. Existing plan access is unchanged.'
      )
    if (checkoutBusy.current) return
    checkoutBusy.current = true
    setLoadingPlan(plan)
    const user = useAuthStore.getState().user
    try {
      const response = await paymentAPI.createDodoCheckout(plan)
      const url = new URL(response.data.data.url)
      if (
        url.protocol !== 'https:' ||
        !['checkout.dodopayments.com', 'test.checkout.dodopayments.com'].includes(url.hostname)
      )
        throw new Error('Unexpected checkout address. Please contact support.')
      sessionStorage.setItem(
        BASELINE_KEY,
        JSON.stringify({ plan: user?.plan, expiresAt: user?.subscriptionExpiresAt })
      )
      sessionStorage.setItem(PENDING_PLAN_KEY, plan)
      window.location.assign(url.href)
    } catch (err) {
      toast.error(
        err.response?.data?.message || err.message || 'Could not open checkout. Please retry.'
      )
    } finally {
      checkoutBusy.current = false
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
    let baseline = {}
    try {
      baseline = JSON.parse(sessionStorage.getItem(BASELINE_KEY) || '{}')
    } catch {}
    sessionStorage.removeItem(BASELINE_KEY)
    sessionStorage.removeItem(PENDING_PLAN_KEY)

    if (!pendingPlan) {
      clearReturnParam()
      return
    }

    setVerifying(true)
    let attempts = 0
    let cancelled = false

    const poll = async () => {
      attempts += 1
      await refreshUser()
      if (cancelled) return
      const current = useAuthStore.getState().user
      const currentPlan = current?.plan

      if (
        currentPlan === pendingPlan &&
        (baseline.plan !== pendingPlan || current?.subscriptionExpiresAt !== baseline.expiresAt)
      ) {
        setVerifying(false)
        toast.success('Plan activated!')
        if (onSuccess) onSuccess(currentPlan)
        clearReturnParam()
        return
      }

      if (attempts >= POLL_ATTEMPTS) {
        setVerifying(false)
        toast(
          'Payment confirmation is still pending. Refresh shortly or contact support if you were charged.'
        )
        clearReturnParam()
        return
      }

      pollTimer.current = setTimeout(poll, POLL_INTERVAL_MS)
    }

    poll()

    return () => {
      cancelled = true
      if (pollTimer.current) clearTimeout(pollTimer.current)
    }
    // Only meant to run once, against whatever URL Dodo redirected back with
    // on mount — not a live subscription to search-param changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { startDodoCheckout, loadingPlan, verifying }
}
