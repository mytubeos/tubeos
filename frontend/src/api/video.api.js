// src/api/video.api.js
import api from './axios'

export const videoApi = {
  getAll: (params = {}) => api.get('/videos', { params }),
  getOne: (id) => api.get(`/videos/${id}`),
  getUpcoming: () => api.get('/videos/upcoming'),
  createDraft: (data) => api.post('/videos/draft', data),
  upload: (videoId, formData) => api.post(`/videos/${videoId}/upload`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  update: (id, data) => api.patch(`/videos/${id}`, data),
  delete: (id, fromYoutube = false) => api.delete(`/videos/${id}?youtube=${fromYoutube}`),
  cancel: (id) => api.post(`/videos/${id}/cancel`),
}
