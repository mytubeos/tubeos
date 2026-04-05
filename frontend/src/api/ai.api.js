// src/api/ai.api.js
import api from './axios'

export const aiApi = {
  // Comments
  syncComments: (channelId, videoId) =>
    api.post(`/ai/comments/${channelId}/sync${videoId ? `?youtubeVideoId=${videoId}` : ''}`),
  getInbox: (channelId, params = {}) => api.get(`/ai/comments/${channelId}`, { params }),
  generateReply: (commentId, tone = 'friendly') =>
    api.post(`/ai/comments/${commentId}/generate-reply`, { tone }),
  postReply: (commentId, replyText) =>
    api.post(`/ai/comments/${commentId}/post-reply`, { replyText }),
  bulkGenerateReplies: (data) => api.post('/ai/comments/bulk-generate', data),
  updateCommentStatus: (commentId, status) =>
    api.patch(`/ai/comments/${commentId}/status`, { status }),

  // Content
  generateTitles: (data) => api.post('/ai/content/titles', data),
  generateTags: (data) => api.post('/ai/content/tags', data),
  generateDescription: (data) => api.post('/ai/content/description', data),
  getContentIdeas: (params = {}) => api.get('/ai/content/ideas', { params }),

  // Shorts
  generateShortsScript: (data) => api.post('/ai/shorts/script', data),
  repurposeToShorts: (videoId) => api.post(`/ai/shorts/repurpose/${videoId}`),

  // Tools
  scoreThumbnail: (data) => api.post('/ai/thumbnail/score', data),
  getMonetizationTips: (channelId) => api.get(`/ai/monetization/${channelId}`),
}
