<div align="center">

# 🎬 TubeOS 3.0

### AI-Powered YouTube Creator Management Platform

**Ek dashboard mein sab kuch — analytics, scheduling, AI content, comments, aur growth.**

[![Node.js](https://img.shields.io/badge/Node.js-≥18.0-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![React](https://img.shields.io/badge/React-18.2-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?logo=mongodb&logoColor=white)](https://mongodb.com)
[![Redis](https://img.shields.io/badge/Redis-BullMQ-DC382D?logo=redis&logoColor=white)](https://redis.io)
[![License](https://img.shields.io/badge/License-Private-red)](.)

</div>

---

## 📋 Table of Contents

- [🚀 Quick Start](#-quick-start)
- [📁 Project Structure](#-project-structure)
- [⚙️ Environment Variables](#️-environment-variables)
- [🔌 API Routes](#-api-routes)
- [🗄️ Database Models](#️-database-models)
- [🤖 AI Integration](#-ai-integration)
- [📅 Job Queue (BullMQ)](#-job-queue-bullmq)
- [📺 YouTube OAuth Setup](#-youtube-oauth-setup)
- [🚢 Deployment](#-deployment)
- [💰 Pricing Plans](#-pricing-plans)
- [🐛 Known Issues](#-known-issues)
- [🗺️ Roadmap](#️-roadmap)

---

## 🚀 Quick Start

### Prerequisites

- Node.js >= 18.0.0
- MongoDB Atlas account (ya local MongoDB)
- Redis (local ya [Upstash](https://upstash.com) for production)
- Google Cloud Console project (YouTube OAuth ke liye)

### 1. Clone & Install

```bash
git clone https://github.com/your-org/tubeos.git
cd tubeos

# Backend dependencies
cd backend && npm install

# Frontend dependencies
cd ../frontend && npm install
```

### 2. Environment Setup

```bash
# Backend ka .env banao
cd backend
cp .env.example .env
# .env fill karo (details neeche hain)
```

### 3. Development Mein Run Karo

```bash
# Terminal 1 — Backend (port 8080)
cd backend
npm run dev

# Terminal 2 — Frontend (port 5173)
cd frontend
npm run dev
```

Frontend: `http://localhost:5173`  
Backend API: `http://localhost:8080/api/v1`

---

## 📁 Project Structure

```
tubeos3.0/
├── Dockerfile                    # Backend Docker container (node:20-alpine)
├── cloudbuild.yaml               # Google Cloud Build CI/CD
│
├── backend/
│   ├── server.js                 # Entry point — DB, Redis, Express, Workers boot karta hai
│   ├── .env.example              # Saare environment variables ka template
│   └── src/
│       ├── app.js                # Express setup — CORS, helmet, sanitize, rate limiting
│       │
│       ├── config/
│       │   ├── env.js            # Env validation + config object
│       │   ├── db.js             # MongoDB connection
│       │   ├── redis.js          # Redis connection (ioredis)
│       │   ├── queue.config.js   # BullMQ queues — video-publish, analytics, email
│       │   ├── ai.config.js      # AI model routing (Claude/Gemini) plan ke hisaab se
│       │   └── youtube.config.js # YouTube OAuth2 helpers + API fetch wrapper
│       │
│       ├── controllers/          # Thin layer — request parse → service call → response
│       │   ├── auth.controller.js
│       │   ├── ai.controller.js
│       │   ├── analytics.controller.js
│       │   ├── schedule.controller.js
│       │   ├── video.controller.js
│       │   └── youtube.controller.js
│       │
│       ├── services/             # Business logic — sab heavy lifting yahan hota hai
│       │   ├── auth.service.js
│       │   ├── ai-comment.service.js
│       │   ├── ai-content.service.js
│       │   ├── analytics.service.js
│       │   ├── growth.service.js
│       │   ├── heatmap.service.js
│       │   ├── schedule.service.js
│       │   ├── video.service.js
│       │   └── youtube.service.js
│       │
│       ├── models/               # Mongoose schemas (7 collections)
│       │   ├── user.model.js
│       │   ├── video.model.js
│       │   ├── schedule.model.js
│       │   ├── analytics.model.js
│       │   ├── comment.model.js
│       │   ├── growth.model.js
│       │   └── youtube-channel.model.js
│       │
│       ├── routes/
│       │   ├── index.js          # Central route registry
│       │   ├── auth.routes.js    # 12 endpoints
│       │   ├── ai.routes.js      # 14 endpoints
│       │   ├── analytics.routes.js # 18 endpoints
│       │   ├── schedule.routes.js  # 9 endpoints
│       │   ├── video.routes.js     # 8 endpoints
│       │   └── youtube.routes.js   # 7 endpoints
│       │
│       ├── middlewares/
│       │   ├── auth.middleware.js       # protect, requirePlan, checkUsageLimit
│       │   ├── error.middleware.js      # 404 + global error handler
│       │   └── rateLimiter.middleware.js # Per-route rate limits
│       │
│       ├── jobs/
│       │   ├── index.js                # Worker registry — startWorkers()
│       │   └── videoPublish.job.js     # BullMQ worker — YouTube upload
│       │
│       └── utils/
│           ├── jwt.utils.js            # Token sign/verify helpers
│           ├── email.utils.js          # OTP, password reset emails
│           └── response.utils.js       # Standardized API response formats
│
└── frontend/
    ├── vite.config.js
    ├── tailwind.config.js
    ├── vercel.json               # SPA routing fix for Vercel
    └── src/
        ├── App.jsx               # Root router + ProtectedRoute
        ├── api/                  # Axios instances per feature
        ├── store/                # Zustand — authStore, channelStore
        ├── hooks/                # useAuth, useAnalytics, useChannel
        ├── pages/                # Full page components (21 pages)
        ├── components/           # layout/, ui/, features/, charts/
        └── utils/
            ├── constants.js      # API_URL, PLANS, NAV_ITEMS
            └── formatters.js     # formatNumber, formatDate, formatDuration
```

---

## ⚙️ Environment Variables

`backend/.env` mein ye sab set karo:

### 🔴 Required (Bina inke app nahi chalega)

| Variable | Example | Description |
|---|---|---|
| `MONGODB_URI` | `mongodb+srv://user:pass@cluster.net/tubeos` | MongoDB Atlas connection string |
| `JWT_ACCESS_SECRET` | `random-32-char-string` | Access token signing key (min 32 chars) |
| `JWT_REFRESH_SECRET` | `another-32-char-string` | Refresh token signing key (min 32 chars) |
| `REDIS_URL` | `redis://localhost:6379` | Local ke liye. Upstash ke liye `rediss://...` |
| `CLIENT_URL` | `http://localhost:5173` | Frontend URL — CORS ke liye |
| `YOUTUBE_CLIENT_ID` | `xxxx.apps.googleusercontent.com` | Google Console OAuth Client ID |
| `YOUTUBE_CLIENT_SECRET` | `GOCSPX-...` | Google Console OAuth Client Secret |
| `YOUTUBE_REDIRECT_URI` | `http://localhost:8080/api/v1/youtube/callback` | Google Console mein exactly match karo |

### 🟡 Optional (AI features ke liye chahiye)

| Variable | Description |
|---|---|
| `ANTHROPIC_API_KEY` | Claude AI — Creator/Pro/Agency plans ke liye |
| `GEMINI_API_KEY` | Google Gemini — Free plan ke liye (set karo taaki free users ko AI mile) |
| `BREVO_API_KEY` | Email delivery — nahi hai to emails skip ho jaate hain |
| `EMAIL_FROM_ADDRESS` | Sender email address |

### Frontend — `frontend/.env`

```env
VITE_API_URL=http://localhost:8080/api/v1
```

Production mein Vercel dashboard mein set karo: `VITE_API_URL=https://your-backend.run.app/api/v1`

---

## 🔌 API Routes

Sab routes ka base URL: `/api/v1`

### 🔐 Auth — `/api/v1/auth/`

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/register` | Public | Register — OTP email bhejta hai |
| `POST` | `/verify-email` | Public | OTP verify — tokens issue karta hai |
| `POST` | `/resend-otp` | Public | OTP dobara bhejo |
| `POST` | `/login` | Public | Login — access + refresh token deta hai |
| `POST` | `/refresh` | Public | Access token refresh karo |
| `POST` | `/logout` | Private | Current device logout |
| `POST` | `/logout-all` | Private | Saare devices logout |
| `POST` | `/forgot-password` | Public | Password reset email |
| `POST` | `/reset-password` | Public | Naya password set karo |
| `GET` | `/me` | Private | Current user profile |
| `PATCH` | `/me` | Private | Profile update |
| `PATCH` | `/change-password` | Private | Password change |

### 📺 YouTube — `/api/v1/youtube/`

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/auth` | Google OAuth URL generate karo |
| `GET` | `/callback` | Google OAuth callback (public — JWT nahi) |
| `GET` | `/channels` | Connected channels list |
| `POST` | `/channels/:id/sync` | YouTube se stats sync karo |
| `DELETE` | `/channels/:id` | Channel disconnect karo |
| `PATCH` | `/channels/:id/primary` | Primary channel set karo |
| `GET` | `/channels/:id/quota` | Daily API quota check |

### 🎥 Videos — `/api/v1/videos/`

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/` | Videos list (filter + paginate) |
| `GET` | `/upcoming` | Upcoming scheduled videos |
| `GET` | `/:videoId` | Single video details |
| `POST` | `/draft` | Draft banao (metadata only) |
| `POST` | `/:videoId/upload` | Video file upload (max 2GB) |
| `PATCH` | `/:videoId` | Metadata update |
| `POST` | `/:videoId/cancel` | Scheduled publish cancel |
| `DELETE` | `/:videoId` | Video delete |

### 📅 Schedule — `/api/v1/schedule/`

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/` | Private | Scheduled posts list |
| `GET` | `/calendar` | Private | Month-wise calendar view |
| `GET` | `/queue/stats` | Private | BullMQ queue status |
| `GET` | `/best-time/:channelId` | Creator+ | AI best posting time |
| `GET` | `/:videoId/status` | Private | Job status check |
| `POST` | `/` | Private | Video schedule karo |
| `POST` | `/bulk` | Pro+ | Bulk scheduling |
| `PATCH` | `/:videoId/reschedule` | Private | Time change karo |
| `DELETE` | `/:videoId` | Private | Cancel schedule |

### 📊 Analytics — `/api/v1/analytics/`

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/:channelId/sync` | Private | YouTube se analytics sync |
| `GET` | `/:channelId/overview` | Private | KPI summary (7d/30d/90d/365d) |
| `GET` | `/:channelId/graph` | Private | Daily time-series data |
| `GET` | `/:channelId/top-videos` | Private | Top performing videos |
| `GET` | `/:channelId/traffic-sources` | Private | Traffic sources breakdown |
| `GET` | `/:channelId/heatmap` | Creator+ | 7×24 activity heatmap |
| `GET` | `/:channelId/best-time` | Creator+ | Best 5 posting slots |
| `GET` | `/:channelId/growth` | Creator+ | Growth predictions |
| `GET` | `/:channelId/trends` | Pro+ | Keyword trends |
| `GET` | `/:channelId/competitors` | Pro+ | Competitor channels |
| `POST` | `/:channelId/competitors` | Pro+ | Competitor add karo |

### 🤖 AI — `/api/v1/ai/`

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/comments/:channelId/sync` | Private | Comments fetch + sentiment |
| `GET` | `/comments/:channelId` | Private | Comment inbox |
| `POST` | `/comments/:commentId/generate-reply` | Private | AI reply generate |
| `POST` | `/comments/:commentId/post-reply` | Private | Reply YouTube pe post karo |
| `POST` | `/comments/bulk-generate` | Creator+ | Bulk replies (10 tak) |
| `POST` | `/content/titles` | Private | 5 AI titles generate |
| `POST` | `/content/tags` | Private | 30 SEO tags generate |
| `POST` | `/content/description` | Private | Full description generate |
| `GET` | `/content/ideas` | Private | Content ideas |
| `POST` | `/shorts/script` | Private | Shorts script (30s/60s) |
| `POST` | `/shorts/repurpose/:videoId` | Pro+ | Long video → Shorts clips |
| `POST` | `/thumbnail/score` | Creator+ | Thumbnail CTR score |
| `GET` | `/monetization/:channelId` | Pro+ | Monetization tips |

---

## 🗄️ Database Models

### User
Auth, plan management, referral system, wallet, usage limits.  
Key fields: `plan`, `usage.aiRepliesUsed`, `referral.myCode`, `wallet.balance`, `refreshTokens[]`

### YoutubeChannel
Connected YouTube channel ka data.  
Key fields: `oauth.accessToken`, `oauth.refreshToken`, `stats`, `quota.dailyUsed`

### Video
Video lifecycle management.  
Status: `draft → scheduled → uploading → processing → published | failed | cancelled`

### Schedule
BullMQ job tracking.  
Key fields: `scheduledAt`, `bullJobId`, `status`, `retryCount`

### ChannelAnalytics / VideoAnalytics (analytics.model.js)
Daily snapshots + 7×24 Heatmap — sab ek hi file mein.

### Comment
YouTube comments with AI.  
Key fields: `sentiment.label`, `aiReply`, `status` (unread/pending_reply/replied/ignored)

### GrowthPrediction / Competitor / Trend (growth.model.js)
30/90/365 day predictions, competitor tracking, keyword trends.

---

## 🤖 AI Integration

Plan ke hisaab se automatic model routing:

| Plan | Model | Provider |
|---|---|---|
| Free | `gemini-2.0-flash` | Google |
| Creator | `claude-sonnet-4-5` | Anthropic |
| Pro | `claude-sonnet-4-5` | Anthropic |
| Agency (default) | `claude-sonnet-4-5` | Anthropic |
| Agency (deep analysis) | `claude-opus-4-5` | Anthropic |
| Agency (bulk replies) | `claude-haiku-4-5-20251001` | Anthropic |

**AI Features:** Title generation · Tag generation · Description · Content ideas · Shorts script · Repurpose to Shorts · Thumbnail CTR scoring · Comment reply generation · Bulk replies · Sentiment analysis · Monetization tips

---

## 📅 Job Queue (BullMQ)

4 queues Redis mein:

| Queue | Purpose | Retries |
|---|---|---|
| `video-publish` | Scheduled video YouTube pe upload karo | 3 |
| `analytics-sync` | Analytics data periodically sync karo | 5 |
| `email` | OTP, password reset emails bhejo | 3 |
| `weekly-report` | ⚠️ Not implemented yet | — |

### Video Publish Flow
```
User schedules video
    ↓
BullMQ delayed job create (delay = scheduledAt - now)
    ↓
Job ID → Schedule.bullJobId + Video.scheduledJobId
    ↓
[Time passes...]
    ↓
Worker fires → YouTube token refresh (if expired)
    ↓
⚠️ BUG: File GCS se read karna chahiye (abhi memoryStorage use ho raha hai — fix needed)
    ↓
YouTube API → video upload
    ↓
Video.status = "published" + Video.youtubeVideoId set
```

> ⚠️ **Important:** Video file storage abhi in-memory hai. Production ke liye Google Cloud Storage integration required hai.

---

## 📺 YouTube OAuth Setup

1. [Google Cloud Console](https://console.cloud.google.com) kholo
2. New project banao ya existing select karo
3. **APIs & Services → Library** mein ye enable karo:
   - YouTube Data API v3
   - YouTube Analytics API
4. **APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID**
5. Application type: **Web application**
6. Authorized redirect URIs mein add karo:
   ```
   http://localhost:8080/api/v1/youtube/callback        ← development
   https://your-backend.run.app/api/v1/youtube/callback ← production
   ```
7. Client ID aur Secret copy karke `.env` mein daal do

---

## 🚢 Deployment

### Backend (Google Cloud Run)

```bash
# Docker image build karo
docker build -t tubeos-backend .

# Ya Cloud Build use karo (auto-deploy on push)
# cloudbuild.yaml already configured hai
gcloud builds submit --config cloudbuild.yaml
```

Cloud Run mein environment variables **Settings → Variables & Secrets** mein set karo.

### Frontend (Vercel)

```bash
cd frontend
npm run build   # dist/ folder banta hai
```

Vercel pe deploy:
1. GitHub repo connect karo
2. Root directory: `frontend`
3. Build command: `npm run build`
4. Output directory: `dist`
5. Environment variable add karo: `VITE_API_URL = https://your-backend.run.app/api/v1`

`vercel.json` already hai — SPA routing automatically handle hogi.

### Required Services

| Service | Free Tier | Link |
|---|---|---|
| MongoDB Atlas | 512MB free | [mongodb.com/atlas](https://mongodb.com/atlas) |
| Upstash Redis | 10K commands/day free | [upstash.com](https://upstash.com) |
| Google Cloud Run | 2M requests/month free | [cloud.google.com/run](https://cloud.google.com/run) |
| Vercel | Unlimited hobby | [vercel.com](https://vercel.com) |
| Brevo Email | 300 emails/day free | [brevo.com](https://brevo.com) |

---

## 💰 Pricing Plans

| Feature | Free | Creator (₹199) | Pro (₹499) | Agency (₹2999) |
|---|---|---|---|---|
| YouTube Channels | 1 | 1 | 3 | 25 |
| AI Replies/month | 10 | 500 | 1,200 | Unlimited |
| Video Uploads/month | 0 | 5 | 20 | Unlimited |
| Analytics | Basic | Full | Full | Full |
| Heatmap + Best Time | ❌ | ✅ | ✅ | ✅ |
| Growth Predictions | ❌ | ✅ | ✅ | ✅ |
| Competitor Tracking | ❌ | ❌ | ✅ | ✅ |
| Keyword Trends | ❌ | ❌ | ✅ | ✅ |
| AI Model | Gemini Flash | Claude Sonnet | Claude Sonnet | Claude Opus |
| Bulk Scheduling | ❌ | ❌ | ✅ | ✅ |

---

## 🐛 Known Issues

### 🔴 Critical — Launch se pehle fix karo

**1. Video File Persist Nahi Hoti**
```
Problem: multer memoryStorage use karta hai — file RAM mein sirf upload request tak hoti hai.
         BullMQ job hours baad fire hota hai — tab file gone hoti hai. Scheduling fail hoga.

Fix:     Upload ke time file Google Cloud Storage mein save karo.
         Video model mein gcsPath field add karo.
         videoPublish.job.js mein GCS se file download karke YouTube pe upload karo.
```

**2. `checkUsageLimit` mein `_id` Bug**
```
Problem: auth.middleware.js mein User.findById(req.user._id) hai.
         .lean() plain object deta hai jisme "id" hota hai, "_id" nahi.
         Usage limits silently fail ho jaate hain.

Fix:     req.user._id → req.user.id (~line 75 in auth.middleware.js)
```

### 🟡 High Priority

- **Cloudinary missing** — `thumbnail.cloudinaryId` field hai model mein par package nahi
- **Email config mismatch** — `BREVO_API_KEY` set hai par nodemailer SMTP credentials expect karta hai
- **Referral backend missing** — Frontend page hai par `/api/v1/referral/*` routes exist nahi karte (404)
- **No `.dockerignore`** — Local `node_modules/` Docker image mein aa sakta hai

### 🟠 Medium Priority

- **Payment gateway nahi** — Plan upgrade karne ka koi mechanism nahi
- **AI prompt injection** — User input directly prompts mein jaata hai, sanitize karo
- **Trend data source nahi** — Trend model hai par populate karne wali koi service nahi

---

## 🗺️ Roadmap

### Phase 1 — Critical Fixes
- [ ] Video file → Google Cloud Storage
- [ ] `checkUsageLimit` `_id` bug fix
- [ ] `.dockerignore` add karo
- [ ] Email service config fix (Brevo SMTP)
- [ ] Referral backend banao (routes + controller + service)
- [ ] `GEMINI_API_KEY` production mein set karo

### Phase 2 — Launch Ready
- [ ] Payment gateway (Razorpay / Stripe)
- [ ] Cloudinary thumbnail upload
- [ ] Admin dashboard
- [ ] Trend data source (Google Trends API)
- [ ] Error monitoring (Sentry)
- [ ] Weekly email reports implement karo

### Phase 3 — Scale
- [ ] TypeScript migration
- [ ] Test suite (Vitest + Testing Library)
- [ ] Redis analytics caching (YouTube quota bachao)
- [ ] YouTube comment webhooks (polling ki jagah)
- [ ] CSV / PDF analytics export
- [ ] Mobile PWA

---

## 🧑‍💻 Tech Stack

**Backend:** Node.js 18+ · Express.js · MongoDB + Mongoose · Redis · BullMQ · JWT · bcryptjs · Multer · Nodemailer  
**Frontend:** React 18 · Vite · Tailwind CSS · Zustand · Axios · Recharts · React Router DOM  
**AI:** Anthropic Claude (Opus/Sonnet/Haiku) · Google Gemini  
**Infra:** Google Cloud Run · Vercel · MongoDB Atlas · Upstash Redis · Brevo Email

---

<div align="center">

Made with ❤️ by Satish Kumar  
**TubeOS 3.0 — MVP**

</div>
