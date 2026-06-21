// src/config/youtube.config.js
// YouTube OAuth2 + API configuration
// FIX: exchangeCodeForTokens aur refreshAccessToken me proper error handling

const { config } = require('./env');

const YOUTUBE_SCOPES = [
  'https://www.googleapis.com/auth/youtube',
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube.readonly',
  'https://www.googleapis.com/auth/yt-analytics.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
].join(' ');

const QUOTA_COSTS = {
  channels_list: 1,
  videos_insert: 1600,
  videos_list: 1,
  videos_update: 50,
  videos_delete: 50,
  search_list: 100,
  thumbnails_set: 50,
  analytics_query: 1,
  commentThreads_list: 1,
  comments_insert: 50,
};

const VIDEO_CATEGORIES = {
  '1': 'Film & Animation',
  '2': 'Autos & Vehicles',
  '10': 'Music',
  '15': 'Pets & Animals',
  '17': 'Sports',
  '19': 'Travel & Events',
  '20': 'Gaming',
  '22': 'People & Blogs',
  '23': 'Comedy',
  '24': 'Entertainment',
  '25': 'News & Politics',
  '26': 'Howto & Style',
  '27': 'Education',
  '28': 'Science & Technology',
  '29': 'Nonprofits & Activism',
};

// Build OAuth2 authorization URL
const getAuthUrl = (state) => {
  const params = new URLSearchParams({
    client_id:     config.youtube.clientId,
    redirect_uri:  config.youtube.redirectUri,
    response_type: 'code',
    scope:         YOUTUBE_SCOPES,
    access_type:   'offline',  // refresh_token milega
    prompt:        'consent',  // har baar refresh_token force karo
    state:         state || 'default',
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
};

// Exchange auth code for tokens
// FIX: pehle response text lo, phir JSON parse karo — isse "body used already" error nahi aayega
const exchangeCodeForTokens = async (code) => {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     config.youtube.clientId,
      client_secret: config.youtube.clientSecret,
      redirect_uri:  config.youtube.redirectUri,
      grant_type:    'authorization_code',
      code,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    const err = new Error(data.error_description || data.error || 'Failed to exchange code for tokens');
    err.statusCode = response.status;
    throw err;
  }

  // FIX: refresh_token nahi aaya — ye tab hota hai jab user ne pehle consent de rakha ho
  // 'prompt: consent' se ye fix hona chahiye, lekin safety ke liye log karo
  if (!data.refresh_token) {
    console.warn('[youtube.config] Warning: No refresh_token received. User may need to revoke access at myaccount.google.com/permissions and retry.');
  }

  return data;
};

// Refresh access token using refresh token
const refreshAccessToken = async (refreshToken) => {
  if (!refreshToken) {
    const err = new Error('No refresh token available. Please reconnect your YouTube channel.');
    err.statusCode = 401;
    err.code = 'NO_REFRESH_TOKEN';
    throw err;
  }

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     config.youtube.clientId,
      client_secret: config.youtube.clientSecret,
      grant_type:    'refresh_token',
      refresh_token: refreshToken,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    const err = new Error(data.error_description || data.error || 'Failed to refresh access token');
    err.statusCode = response.status;
    // FIX: invalid_grant = refresh token revoked ya expired — user ko reconnect karna hoga
    if (data.error === 'invalid_grant') {
      err.code = 'REFRESH_TOKEN_REVOKED';
      err.message = 'YouTube access has been revoked. Please reconnect your channel.';
    }
    throw err;
  }

  return data;
};

// Make authenticated YouTube API request
const youtubeRequest = async (endpoint, options = {}) => {
  const baseUrl = 'https://www.googleapis.com/youtube/v3';
  const url = `${baseUrl}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    const err = new Error(
      error.error?.message || `YouTube API error: ${response.status}`
    );
    err.statusCode = response.status;
    err.youtubeError = error.error;
    throw err;
  }

  return response.json();
};

module.exports = {
  YOUTUBE_SCOPES,
  QUOTA_COSTS,
  VIDEO_CATEGORIES,
  getAuthUrl,
  exchangeCodeForTokens,
  refreshAccessToken,
  youtubeRequest,
};
