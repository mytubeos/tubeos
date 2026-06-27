// src/api/payment.api.js
import api from './axios'

const paymentAPI = {
  createOrder: (plan, couponCode = null) => api.post('/payment/create-order', { plan, couponCode }),
  verifyPayment: (data) => api.post('/payment/verify', data),
  validateCoupon: (code, plan) => api.post('/payment/validate-coupon', { code, plan }),
}

export default paymentAPI
