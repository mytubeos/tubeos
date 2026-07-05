// src/hooks/useRazorpay.js
import { useState } from 'react'
import toast from 'react-hot-toast'
import paymentAPI from '../api/payment.api'
import { useAuthStore } from '../store/authStore'

const loadRazorpayScript = () =>
  new Promise((resolve) => {
    if (document.getElementById('razorpay-script')) return resolve(true)
    const script = document.createElement('script')
    script.id = 'razorpay-script'
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.onload = () => resolve(true)
    script.onerror = () => resolve(false)
    document.body.appendChild(script)
  })

export const useRazorpay = ({ onSuccess } = {}) => {
  const [loadingPlan, setLoadingPlan] = useState(null)
  const { updateUser } = useAuthStore()

  const startCheckout = async (plan, couponCode = null) => {
    if (loadingPlan) return

    try {
      setLoadingPlan(plan)

      const loaded = await loadRazorpayScript()
      if (!loaded) {
        toast.error('Payment gateway load nahi hua. Internet check karo.')
        return
      }

      const res = await paymentAPI.createOrder(plan, couponCode)
      const { orderId, amount, currency, keyId, userName, userEmail, label } = res.data.data

      const options = {
        key: keyId,
        amount,
        currency,
        name: 'TubeOS',
        description: label,
        order_id: orderId,
        prefill: { name: userName, email: userEmail },
        theme: { color: '#4F46E5' },
        handler: async (response) => {
          try {
            await paymentAPI.verifyPayment({
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
              plan,
              couponCode: couponCode || null,
            })
            updateUser({ plan })
            toast.success(`${label} activate ho gaya!`)
            if (onSuccess) onSuccess(plan)
          } catch {
            toast.error('Payment verify nahi hua. Support se contact karo.')
          }
        },
        modal: { ondismiss: () => setLoadingPlan(null) },
      }

      const rzp = new window.Razorpay(options)
      rzp.on('payment.failed', () => {
        toast.error('Payment fail ho gayi. Dobara try karo.')
        setLoadingPlan(null)
      })
      rzp.open()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Kuch galat ho gaya')
    } finally {
      setLoadingPlan(null)
    }
  }

  return { startCheckout, loadingPlan }
}
