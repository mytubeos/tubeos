// src/api/payment.api.js
import api from './axios'

const paymentAPI = {
  createOrder: (plan, couponCode = null) => api.post('/payment/create-order', { plan, couponCode }),
  verifyPayment: (data) => api.post('/payment/verify', data),
  validateCoupon: (code, plan) => api.post('/payment/validate-coupon', { code, plan }),
  getHistory: (page = 1, limit = 10) => api.get('/payment/history', { params: { page, limit } }),
  downgradeToFree: () => api.post('/payment/downgrade'),
  createStripeCheckout: (plan, couponCode = null) =>
    api.post('/payment/stripe/create-checkout-session', { plan, couponCode }),
  verifyStripeSession: (sessionId) => api.post('/payment/stripe/verify-session', { sessionId }),
}

export default paymentAPI
