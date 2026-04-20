// src/utils/constants.js
// FIX: API_URL default port 5000 → 8080

export const APP_NAME = 'TubeOS'
export const APP_TAGLINE = 'Creator Command Center'
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api/v1'

// Plans
export const PLANS = {
  free: {
    name: 'Free',
    price: { inr: 0, usd: 0 },
    color: 'gray',
    channels: 1,
    aiReplies: 10,
    uploads: 0,
  },
  creator: {
    name: 'Creator',
    price: { inr: 199, usd: 9 },
    color: 'brand',
    channels: 1,
    aiReplies: 500,
    uploads: 5,
  },
  pro: {
    name: 'Pro',
    price: { inr: 499, usd: 19 },
    color: 'cyan',
    channels: 3,
    aiReplies: 1200,
    uploads: 20,
  },
  agency: {
    name: 'Agency',
    price: { inr: 2999, usd: 99 },
    color: 'rose',
    channels: 25,
    aiReplies: -1,
    uploads: -1,
  },
}

// Sentiment colors
export const SENTIMENT_CONFIG = {
  positive: { color: 'emerald', label: 'Positive', emoji: '😊' },
  neutral:  { color: 'gray',    label: 'Neutral',  emoji: '😐' },
  negative: { color: 'rose',    label: 'Negative', emoji: '😤' },
  question: { color: 'cyan',    label: 'Question', emoji: '❓' },
  spam:     { color: 'amber',   label: 'Spam',     emoji: '🚫' },
}

export const VIDEO_CATEGORIES = {
  '1':  'Film & Animation',
  '2':  'Autos & Vehicles',
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
}

export const VIDEO_STATUS = {
  draft:      { label: 'Draft',      color: 'gray'    },
  scheduled:  { label: 'Scheduled',  color: 'brand'   },
  uploading:  { label: 'Uploading',  color: 'cyan'    },
  processing: { label: 'Processing', color: 'amber'   },
  published:  { label: 'Published',  color: 'emerald' },
  failed:     { label: 'Failed',     color: 'rose'    },
  cancelled:  { label: 'Cancelled',  color: 'gray'    },
}

export const PERIODS = [
  { label: '7 Days',  value: '7d'   },
  { label: '30 Days', value: '30d'  },
  { label: '90 Days', value: '90d'  },
  { label: '1 Year',  value: '365d' },
]

export const CHART_COLORS = {
  brand:   '#4F46E5',
  cyan:    '#06B6D4',
  rose:    '#F43F5E',
  emerald: '#10B981',
  amber:   '#F59E0B',
  purple:  '#A855F7',
}

export const NAV_ITEMS = [
  { path: '/dashboard', label: 'Dashboard',        icon: 'LayoutDashboard' },
  { path: '/analytics', label: 'Analytics',         icon: 'BarChart3'       },
  { path: '/heatmap',   label: 'Time Intelligence', icon: 'Flame'           },
  { path: '/scheduler', label: 'Scheduler',         icon: 'Calendar'        },
  { path: '/videos',    label: 'Videos',            icon: 'Video'           },
  { path: '/comments',  label: 'Comments',          icon: 'MessageCircle'   },
  { path: '/ai',        label: 'AI Tools',          icon: 'Sparkles'        },
  { path: '/growth',    label: 'Growth',            icon: 'TrendingUp'      },
  { path: '/channels',  label: 'Channels',          icon: 'Youtube'         },
  { path: '/referral',  label: 'Referral',          icon: 'Gift'            },
  { path: '/settings',  label: 'Settings',          icon: 'Settings'        },
]

export const REPLY_TONES = [
  { value: 'friendly',     label: '😊 Friendly',     desc: 'Warm and casual'           },
  { value: 'professional', label: '💼 Professional', desc: 'Formal and informative'    },
  { value: 'funny',        label: '😂 Funny',        desc: 'Witty and light-hearted'   },
  { value: 'grateful',     label: '🙏 Grateful',     desc: 'Thankful and appreciative' },
]
