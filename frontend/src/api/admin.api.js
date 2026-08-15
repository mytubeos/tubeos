// src/api/admin.api.js
import api from './axios'

const adminAPI = {
  // User stats + management
  getUserStats: () => api.get('/admin/users/stats'),
  listUsers: (params = {}) => api.get('/admin/users', { params }),
  changeUserPlan: (id, plan) => api.patch(`/admin/users/${id}/plan`, { plan }),
  toggleBanUser: (id, reason) => api.patch(`/admin/users/${id}/ban`, { reason }),
  toggleDeleteUser: (id) => api.patch(`/admin/users/${id}/delete`),

  // Coupon stats + management
  getCouponStats: () => api.get('/admin/coupons/stats'),
  listCoupons: (params = {}) => api.get('/admin/coupons', { params }),
  createCoupon: (data) => api.post('/admin/coupons', data),
  updateCoupon: (id, data) => api.patch(`/admin/coupons/${id}`, data),
  deleteCoupon: (id) => api.delete(`/admin/coupons/${id}`),

  // Plan pricing (INR/EUR/USD)
  getPricing: () => api.get('/admin/pricing'),
  updatePricing: (plan, data) => api.put(`/admin/pricing/${plan}`, data),

  // Plan feature limits (uploads, AI replies/content, bulk replies, thumbnails)
  getLimits: () => api.get('/admin/limits'),
  updateLimits: (plan, data) => api.put(`/admin/limits/${plan}`, data),

  // Weekly/monthly report email schedule + sender (times are IST both ways)
  getReportSettings: () => api.get('/admin/report-settings'),
  updateReportSettings: (data) => api.put('/admin/report-settings', data),
}

export default adminAPI
