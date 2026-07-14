// src/api/video.api.js
import api from './axios'

export const videoApi = {
  getAll: (params = {}) => api.get('/videos', { params }),
  getOne: (id) => api.get(`/videos/${id}`),
  getUpcoming: () => api.get('/videos/upcoming'),
  createDraft: (data) => api.post('/videos/draft', data),
  // Real video files routinely take longer than the API-wide 30s default
  // (multer streams to GCS, then the backend does a resumable YouTube
  // upload) — the default timeout was aborting the request client-side
  // before the backend ever finished, leaving the draft stuck with no
  // failure recorded. Give large-file endpoints their own long timeout.
  upload: (videoId, formData) =>
    api.post(`/videos/${videoId}/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 10 * 60 * 1000,
    }),
  uploadThumbnail: (videoId, formData) =>
    api.post(`/videos/${videoId}/thumbnail`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 2 * 60 * 1000,
    }),
  update: (id, data) => api.patch(`/videos/${id}`, data),
  delete: (id, fromYoutube = false) => api.delete(`/videos/${id}?youtube=${fromYoutube}`),
  cancel: (id) => api.post(`/videos/${id}/cancel`),
}
