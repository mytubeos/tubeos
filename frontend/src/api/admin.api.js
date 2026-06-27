// src/api/admin.api.js
import api from './axios'

const adminAPI = {
  // Stats
  getCouponStats: () => api.get('/admin/coupons/stats'),

  // Coupon CRUD
  listCoupons: (params = {}) => api.get('/admin/coupons', { params }),
  createCoupon: (data) => api.post('/admin/coupons', data),
  updateCoupon: (id, data) => api.patch(`/admin/coupons/${id}`, data),
  deleteCoupon: (id) => api.delete(`/admin/coupons/${id}`),
}

export default adminAPI
