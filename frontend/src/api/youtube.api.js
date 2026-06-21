// src/api/youtube.api.js
// YouTube channel management API calls
//
// FIX: connectChannel — popup window use karo
// Direct window.location.href se navigate karne pe React state lost ho jaati thi
// Popup approach: OAuth ek alag window mein hota hai, parent window intact rahti hai

import api from './axios'

export const youtubeApi = {

  // Step 1: Backend se OAuth URL lo
  getAuthUrl: () => api.get('/youtube/auth'),

  // Step 2: OAuth popup open karo
  // Ye function authUrl leta hai aur ek popup window mein Google OAuth kholata hai
  // Callback ke baad popup close hoti hai aur parent window ko message milta hai
  connectChannel: (authUrl) => {
    return new Promise((resolve, reject) => {
      const width  = 600;
      const height = 700;
      const left   = window.screenX + (window.outerWidth  - width)  / 2;
      const top    = window.screenY + (window.outerHeight - height) / 2;

      const popup = window.open(
        authUrl,
        'youtube-oauth',
        `width=${width},height=${height},left=${left},top=${top},scrollbars=yes`
      );

      if (!popup) {
        reject(new Error('Popup blocked. Please allow popups for this site.'));
        return;
      }

      // Popup se message ka wait karo
      // Channels.jsx mein useEffect mein URL params check hote hain
      // Jab popup close ho tab channels refresh karo
      const checkClosed = setInterval(() => {
        if (popup.closed) {
          clearInterval(checkClosed);
          resolve({ popupClosed: true });
        }
      }, 500);

      // Timeout — 5 min baad reject
      setTimeout(() => {
        clearInterval(checkClosed);
        if (!popup.closed) popup.close();
        reject(new Error('OAuth timed out. Please try again.'));
      }, 5 * 60 * 1000);
    });
  },

  // Channels list
  getChannels: () => api.get('/youtube/channels'),

  // Channel sync
  syncChannel: (channelId) => api.post(`/youtube/channels/${channelId}/sync`),

  // Channel disconnect
  disconnectChannel: (channelId) => api.delete(`/youtube/channels/${channelId}`),

  // Primary channel set karo
  setPrimary: (channelId) => api.patch(`/youtube/channels/${channelId}/primary`),

  // Quota status
  getQuota: (channelId) => api.get(`/youtube/channels/${channelId}/quota`),
}
