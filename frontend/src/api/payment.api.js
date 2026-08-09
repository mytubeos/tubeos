// src/api/payment.api.js
import api from './axios'

const paymentAPI = {
  createOrder: (plan, couponCode = null) => api.post('/payment/create-order', { plan, couponCode }),
  verifyPayment: (data) => api.post('/payment/verify', data),
  validateCoupon: (code, plan) => api.post('/payment/validate-coupon', { code, plan }),
  getHistory: (page = 1, limit = 10) => api.get('/payment/history', { params: { page, limit } }),
  downgradeToFree: () => api.post('/payment/downgrade'),
  createStripeCheckout: (plan, currency = 'INR', couponCode = null) =>
    api.post('/payment/stripe/create-checkout-session', { plan, currency, couponCode }),
  verifyStripeSession: (sessionId) => api.post('/payment/stripe/verify-session', { sessionId }),
  createDodoCheckout: (plan, couponCode = null) =>
    api.post('/payment/dodo/create-checkout-session', { plan, couponCode }),
}

export default paymentAPI
