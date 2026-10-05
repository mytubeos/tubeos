// src/api/payment.api.js
import api from './axios'

const paymentAPI = {
  getHistory: (page = 1, limit = 10) => api.get('/payment/history', { params: { page, limit } }),
  downgradeToFree: () => api.post('/payment/downgrade'),
  // Discount codes are now entered on Dodo's own hosted checkout page —
  // nothing to pass through here anymore.
  createDodoCheckout: (plan) => api.post('/payment/dodo/create-checkout-session', { plan }),
}

export default paymentAPI
