// src/api/pricing.api.js
import api from './axios'

// Public — no auth, same visibility as the pricing page itself
const pricingAPI = {
  getPrices: () => api.get('/pricing'),
}

export default pricingAPI
