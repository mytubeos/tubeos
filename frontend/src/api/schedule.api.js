// src/api/schedule.api.js
import api from './axios'

export const scheduleApi = {
  getAll: (params = {}) => api.get('/schedule', { params }),
  getCalendar: (year, month) => api.get(`/schedule/calendar?year=${year}&month=${month}`),
  getBestTime: (channelId) => api.get(`/schedule/best-time/${channelId}`),
  getJobStatus: (videoId) => api.get(`/schedule/${videoId}/status`),
  create: (data) => api.post('/schedule', data),
  bulkCreate: (schedules) => api.post('/schedule/bulk', { schedules }),
  reschedule: (videoId, scheduledAt) => api.patch(`/schedule/${videoId}/reschedule`, { scheduledAt }),
  cancel: (videoId) => api.delete(`/schedule/${videoId}`),
  getQueueStats: () => api.get('/schedule/queue/stats'),
}
