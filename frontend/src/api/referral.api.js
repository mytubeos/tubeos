// src/api/referral.api.js
import api from './axios'

const referralAPI = {
  getStats:      ()           => api.get('/referral/stats'),
  getEarnings:   (params={})  => api.get('/referral/earnings', { params }),
  getReferrals:  (params={})  => api.get('/referral/referrals', { params }),
  getPayouts:    (params={})  => api.get('/referral/payouts', { params }),
  requestPayout: (data)       => api.post('/referral/payout', data),
}

export default referralAPI
