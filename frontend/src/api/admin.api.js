// src/api/admin.api.js
import api from './axios'

const adminAPI = {
  // User stats + management
  getUserStats: () => api.get('/admin/users/stats'),
  listUsers: (params = {}) => api.get('/admin/users', { params }),
  changeUserPlan: (id, plan) => api.patch(`/admin/users/${id}/plan`, { plan }),
  toggleBanUser: (id, reason) => api.patch(`/admin/users/${id}/ban`, { reason }),

  // Coupon stats + management
  getCouponStats: () => api.get('/admin/coupons/stats'),
  listCoupons: (params = {}) => api.get('/admin/coupons', { params }),
  createCoupon: (data) => api.post('/admin/coupons', data),
  updateCoupon: (id, data) => api.patch(`/admin/coupons/${id}`, data),
  deleteCoupon: (id) => api.delete(`/admin/coupons/${id}`),
}

export default adminAPI
