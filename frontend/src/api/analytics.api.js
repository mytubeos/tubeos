// src/api/analytics.api.js
import api from './axios'

export const analyticsApi = {
  sync: (channelId, days = 30) => api.post(`/analytics/${channelId}/sync?days=${days}`),
  getOverview: (channelId, period = '30d') => api.get(`/analytics/${channelId}/overview?period=${period}`),
  getDailyGraph: (channelId, period = '30d', metric = 'views') =>
    api.get(`/analytics/${channelId}/graph?period=${period}&metric=${metric}`),
  getDayWise: (channelId, period = '90d') => api.get(`/analytics/${channelId}/day-wise?period=${period}`),
  getTopVideos: (channelId, limit = 10, sortBy = 'views') =>
    api.get(`/analytics/${channelId}/top-videos?limit=${limit}&sortBy=${sortBy}`),
  getVideoBreakdown: (videoId) => api.get(`/analytics/video/${videoId}`),
  getTrafficSources: (channelId, period = '30d') =>
    api.get(`/analytics/${channelId}/traffic-sources?period=${period}`),
  getHeatmap: (channelId) => api.get(`/analytics/${channelId}/heatmap`),
  rebuildHeatmap: (channelId) => api.post(`/analytics/${channelId}/heatmap/rebuild`),
  getBestTime: (channelId, count = 5) => api.get(`/analytics/${channelId}/best-time?count=${count}`),
  getLowTraffic: (channelId) => api.get(`/analytics/${channelId}/low-traffic`),
  getGrowth: (channelId) => api.get(`/analytics/${channelId}/growth`),
  getSuggestions: (channelId) => api.get(`/analytics/${channelId}/suggestions`),
  getTrends: (channelId, category) =>
    api.get(`/analytics/${channelId}/trends${category ? `?category=${category}` : ''}`),
  getCompetitors: (channelId) => api.get(`/analytics/${channelId}/competitors`),
  addCompetitor: (channelId, youtubeChannelId) =>
    api.post(`/analytics/${channelId}/competitors`, { youtubeChannelId }),
  syncCompetitor: (competitorId) => api.post(`/analytics/competitors/${competitorId}/sync`),
  removeCompetitor: (competitorId) => api.delete(`/analytics/competitors/${competitorId}`),
}
