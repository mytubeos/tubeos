import { useCallback, useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import paymentAPI from '../api/payment.api'
import { useAuthStore } from '../store/authStore'
import { useDodoCheckout } from './useDodoCheckout'
import {
  chooseBillingChannel,
  formatPlayPrice,
  purchaseOnPlay,
  hasOpenPlaySubscription,
} from '../utils/playBilling'

export const useBilling = ({ onSuccess } = {}) => {
  const { user, refreshUser } = useAuthStore()
  const userId = user?._id || user?.id
  const [channel, setChannel] = useState({ mode: 'loading', details: {} })
  const [loadingPlan, setLoadingPlan] = useState(null)
  const [verifying, setVerifying] = useState(false)
  const [playPurchases, setPlayPurchases] = useState([])
  const [playChecked, setPlayChecked] = useState(false)
  const [playCheckError, setPlayCheckError] = useState(null)
  const busy = useRef(false)
  const dodo = useDodoCheckout({ onSuccess, enabled: channel.mode === 'web' })
  useEffect(() => {
    let cancelled = false
    setPlayPurchases([])
    if (userId)
      paymentAPI
        .getPlayPurchases()
        .then((r) => {
          if (!cancelled) setPlayPurchases(r.data.data || [])
        })
        .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [userId, user?.subscriptionExpiresAt])

  useEffect(() => {
    let cancelled = false
    setPlayChecked(false)
    setPlayCheckError(null)
    paymentAPI
      .getBillingConfig()
      .then((r) => chooseBillingChannel(r.data.data, window.location.origin))
      .then((result) => {
        if (!cancelled) setChannel(result)
      })
      .catch(() => {
        if (!cancelled) setChannel({ mode: 'unavailable', details: {} })
      })
    return () => {
      cancelled = true
    }
  }, [userId])

  const verify = useCallback(
    async (token) => {
      const result = await paymentAPI.verifyPlayPurchase(token)
      if ((useAuthStore.getState().user?._id || useAuthStore.getState().user?.id) === userId)
        await refreshUser()
      return result.data.data
    },
    [userId, refreshUser]
  )

  const restore = useCallback(
    async (manual = true) => {
      if (!userId || busy.current || channel.mode !== 'play') return
      busy.current = true
      setVerifying(true)
      setPlayCheckError(null)
      try {
        const purchases = await channel.service.listPurchases()
        const isSameUser = () =>
          (useAuthStore.getState().user?._id || useAuthStore.getState().user?.id) === userId
        let active = false
        for (const purchase of purchases) {
          if (!isSameUser()) return
          if (Object.values(channel.details).some((p) => p.itemId === purchase.itemId)) {
            const result = await verify(purchase.purchaseToken)
            active = active || result.active
          }
        }
        // Also handles expired/refunded subscriptions which listPurchases omits.
        if (!isSameUser()) return
        await paymentAPI.syncPlayPurchase()
        if (!isSameUser()) return
        await refreshUser()
        const history = await paymentAPI.getPlayPurchases()
        if (!isSameUser()) return
        setPlayPurchases(history.data.data || [])
        setPlayChecked(true)
        if (manual)
          toast.success(
            active
              ? 'Purchases restored.'
              : 'Purchase status updated. No active Google Play plan found.'
          )
      } catch (err) {
        setPlayChecked(false)
        setPlayCheckError(
          err.response?.data?.message ||
            err.message ||
            'Could not check Google Play purchases. Check your connection and retry.'
        )
        if (manual)
          toast.error(
            err.response?.data?.message ||
              'Could not restore purchases. Please retry; do not buy again if already charged.'
          )
      } finally {
        busy.current = false
        setVerifying(false)
      }
    },
    [channel, userId, verify, refreshUser]
  )

  useEffect(() => {
    if (channel.mode !== 'play' || !userId) return
    restore(false)
    const onFocus = () => restore(false)
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [channel.mode, userId, restore])

  const hasPaidAccess =
    user?.plan &&
    user.plan !== 'free' &&
    (!user.subscriptionExpiresAt || new Date(user.subscriptionExpiresAt) > new Date())
  const canPurchase = (plan) =>
    !busy.current &&
    !verifying &&
    !loadingPlan &&
    !dodo.loadingPlan &&
    (channel.mode === 'web'
      ? !(user?.subscriptionProvider === 'google-play' && hasPaidAccess) &&
        !hasOpenPlaySubscription(playPurchases)
      : channel.mode === 'play' &&
        (!userId || playChecked) &&
        !hasPaidAccess &&
        !hasOpenPlaySubscription(playPurchases) &&
        !!channel.details[plan])
  const startCheckout = async (plan) => {
    if (!canPurchase(plan))
      return toast.error(
        'Purchases are unavailable, or an existing plan is active. Restore or manage your current plan.'
      )
    if (channel.mode === 'web') return dodo.startDodoCheckout(plan)
    busy.current = true
    setLoadingPlan(plan)
    try {
      const result = await purchaseOnPlay(channel.details[plan], verify)
      if (result.active) {
        toast.success('Plan activated!')
        onSuccess?.(result.plan)
      } else
        toast(
          'Payment is pending. Access activates after Google confirms it. Use Restore purchases to check again.'
        )
    } catch (err) {
      if (err.name !== 'AbortError')
        toast.error(
          err.response?.data?.message ||
            err.message ||
            'Could not confirm payment. Use Restore purchases before buying again.'
        )
    } finally {
      busy.current = false
      setLoadingPlan(null)
    }
  }
  return {
    mode: channel.mode,
    canPurchase,
    startCheckout,
    restore,
    playPurchases,
    playCheckError,
    loadingPlan: loadingPlan || dodo.loadingPlan,
    verifying: verifying || dodo.verifying,
    label: (plan) =>
      channel.mode === 'play' && (hasPaidAccess || hasOpenPlaySubscription(playPurchases))
        ? 'Manage current plan'
        : channel.mode === 'play' && userId && !playChecked
          ? playCheckError
            ? 'Purchase check failed'
            : 'Checking purchases…'
        : canPurchase(plan)
          ? channel.mode === 'play'
            ? 'Subscribe with Google Play'
            : 'Buy with Dodo'
          : 'Purchases paused',
    price: (plan) => (channel.details[plan] ? formatPlayPrice(channel.details[plan]) : null),
  }
}
