// src/api/notification.api.js
import api from './axios'

const notificationAPI = {
  getAll: (params = {}) => api.get('/notifications', { params }),
  markRead: (id) => api.patch(`/notifications/${id}/read`),
  markAllRead: () => api.patch('/notifications/read-all'),
}

export default notificationAPI
