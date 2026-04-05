// src/config/youtube.config.js
// YouTube OAuth2 + API configuration

const { config } = require('./env');

// YouTube OAuth2 scopes we need
const YOUTUBE_SCOPES = [
  'https://www.googleapis.com/auth/youtube',              // Full YouTube access
  'https://www.googleapis.com/auth/youtube.upload',       // Upload videos
  'https://www.googleapis.com/auth/youtube.readonly',     // Read channel data
  'https://www.googleapis.com/auth/yt-analytics.readonly', // Analytics data
  'https://www.googleapis.com/auth/userinfo.email',       // User email
  'https://www.googleapis.com/auth/userinfo.profile',     // User profile
].join(' ');

// YouTube API quota costs (units)
// YouTube gives 10,000 units/day free
const QUOTA_COSTS = {
  channels_list: 1,
  videos_insert: 1600,  // Uploading costs 1600 units!
  videos_list: 1,
  videos_update: 50,
  videos_delete: 50,
  search_list: 100,
  thumbnails_set: 50,
  analytics_query: 1,
  commentThreads_list: 1,
  comments_insert: 50,
};

// YouTube video categories
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
    client_id: config.youtube.clientId,
    redirect_uri: config.youtube.redirectUri,
    response_type: 'code',
    scope: YOUTUBE_SCOPES,
    access_type: 'offline',   // Get refresh token
    prompt: 'consent',         // Force consent to always get refresh token
    state: state || 'default',
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
};

// Exchange auth code for tokens
const exchangeCodeForTokens = async (code) => {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.youtube.clientId,
      client_secret: config.youtube.clientSecret,
      redirect_uri: config.youtube.redirectUri,
      grant_type: 'authorization_code',
      code,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error_description || 'Failed to exchange code for tokens');
  }

  return response.json();
};

// Refresh access token using refresh token
const refreshAccessToken = async (refreshToken) => {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.youtube.clientId,
      client_secret: config.youtube.clientSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error_description || 'Failed to refresh access token');
  }

  return response.json();
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
