<div align="center">

# 🎬 TubeOS 3.0

### AI-Powered YouTube Creator Management Platform

**Ek dashboard mein sab kuch — analytics, scheduling, AI content, comments, aur growth.**

[![Node.js](https://img.shields.io/badge/Node.js-≥18.0-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![React](https://img.shields.io/badge/React-18.2-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?logo=mongodb&logoColor=white)](https://mongodb.com)
[![Redis](https://img.shields.io/badge/Redis-Caching-DC382D?logo=redis&logoColor=white)](https://redis.io)
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
- [📅 Job Scheduling](#-job-scheduling)
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
│       │   ├── logger.js         # Winston structured logging (JSON in prod)
│       │   ├── sentry.js         # Sentry error tracking (no-op if SENTRY_DSN unset)
│       │   ├── queue.config.js   # BullMQ queue definitions — currently stubbed, see Job Scheduling section
│       │   ├── ai.config.js      # AI model routing (Claude/Gemini/Groq) plan ke hisaab se
│       │   └── youtube.config.js # YouTube OAuth2 helpers + API fetch wrapper
│       │
│       ├── controllers/          # Thin layer — request parse → service call → response
│       │   ├── auth.controller.js
│       │   ├── ai.controller.js
│       │   ├── analytics.controller.js
│       │   ├── admin.controller.js
│       │   ├── payment.controller.js
│       │   ├── referral.controller.js
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
│       │   ├── payment.service.js
│       │   ├── coupon.service.js
│       │   ├── referral.service.js
│       │   ├── report.service.js       # Weekly email report data aggregation
│       │   ├── schedule.service.js
│       │   ├── storage.service.js      # GCS video staging (streams, never buffers whole file)
│       │   ├── thumbnail.service.js    # Cloudinary thumbnail upload
│       │   ├── video.service.js
│       │   └── youtube.service.js
│       │
│       ├── models/               # Mongoose schemas (9 files, 12 collections — some files export multiple models)
│       │   ├── user.model.js
│       │   ├── video.model.js
│       │   ├── schedule.model.js
│       │   ├── analytics.model.js     # exports ChannelAnalytics, VideoAnalytics, Heatmap
│       │   ├── comment.model.js
│       │   ├── coupon.model.js
│       │   ├── growth.model.js        # exports GrowthPrediction, Competitor, Trend
│       │   ├── referral.model.js
│       │   └── youtube-channel.model.js
│       │
│       ├── routes/
│       │   ├── index.js          # Central route registry
│       │   ├── auth.routes.js       # 12 endpoints
│       │   ├── ai.routes.js         # 14 endpoints
│       │   ├── analytics.routes.js  # 18 endpoints
│       │   ├── admin.routes.js      # 9 endpoints (admin-only)
│       │   ├── payment.routes.js    # 4 endpoints (Razorpay order/verify/webhook/coupon)
│       │   ├── referral.routes.js   # 5 endpoints
│       │   ├── schedule.routes.js   # 9 endpoints
│       │   ├── video.routes.js      # 8 endpoints
│       │   └── youtube.routes.js    # 7 endpoints
│       │
│       ├── middlewares/
│       │   ├── auth.middleware.js       # protect, requirePlan, checkUsageLimit
│       │   ├── admin.middleware.js      # adminProtect — requires req.user.isAdmin
│       │   ├── error.middleware.js      # 404 + global error handler
│       │   ├── upload.middleware.js     # Multer — streams video uploads straight to GCS
│       │   └── rateLimiter.middleware.js # Per-route rate limits
│       │
│       ├── jobs/
│       │   ├── index.js                # Worker registry (BullMQ workers stubbed — see Job Scheduling section)
│       │   └── cron.js                 # In-process setInterval scheduler — publish reaper, analytics sync, trend refresh, weekly reports
│       │
│       └── utils/
│           ├── jwt.utils.js            # Token sign/verify helpers
│           ├── email.utils.js          # Brevo HTTP API — OTP, password reset, weekly report emails
│           ├── response.utils.js       # Standardized API response formats
│           └── sanitize.utils.js       # Strips prompt-injection patterns before text reaches an LLM
│
└── frontend/
    ├── vite.config.js
    ├── tailwind.config.js
    ├── vercel.json               # SPA routing fix for Vercel
    └── src/
        ├── App.jsx               # Root router + ProtectedRoute + AdminRoute
        ├── api/                  # Axios instances per feature
        ├── store/                # Zustand — authStore, channelStore
        ├── hooks/                # useAuth, useAnalytics, useChannel
        ├── pages/                # Full page components (26 pages)
        ├── components/           # layout/, ui/, features/, charts/
        └── utils/
            ├── constants.js      # API_URL, PLANS, NAV_ITEMS
            ├── formatters.js     # formatNumber, formatDate, formatDuration
            └── sentry.js         # initSentry() — no-op if VITE_SENTRY_DSN unset
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
| `YOUTUBE_API_KEY` | YouTube Data API v3 key (no OAuth) — Growth tab ke Trend Opportunity Scanner ke liye. Iske bina Trends hamesha static curated list dikhayega. |

### Frontend — `frontend/.env`

```env
VITE_API_URL=http://localhost:8080/api/v1
```

Production mein Vercel dashboard mein set karo: `VITE_API_URL=https://your-backend.onrender.com/api/v1`

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
| `GET` | `/queue/stats` | Private | Queue stats (currently always zeros — BullMQ is stubbed, see Job Scheduling) |
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

### 💳 Payment — `/api/v1/payment/`

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/webhook` | Public (signature-verified) | Razorpay webhook — payment.captured events |
| `POST` | `/create-order` | Private | Razorpay order create karo (plan + optional coupon) |
| `POST` | `/verify` | Private | Payment signature verify + plan activate |
| `POST` | `/validate-coupon` | Private | Coupon code validate karo checkout se pehle |

### 🎁 Referral — `/api/v1/referral/`

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/stats` | Private | Referral code, tier, total referrals |
| `GET` | `/earnings` | Private | Wallet balance + earning history |
| `GET` | `/referrals` | Private | Referred users list |
| `GET` | `/payouts` | Private | Payout request history |
| `POST` | `/payout` | Private | Payout request karo |

### 🛠️ Admin — `/api/v1/admin/`

Requires `req.user.isAdmin` (see `admin.middleware.js`).

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/users/stats` | Platform-wide user stats |
| `GET` | `/users` | Users list |
| `PATCH` | `/users/:id/plan` | User ka plan change karo |
| `PATCH` | `/users/:id/ban` | Ban/unban toggle |
| `GET` | `/coupons/stats` | Coupon usage stats |
| `GET` | `/coupons` | Coupons list |
| `POST` | `/coupons` | Naya coupon banao |
| `PATCH` | `/coupons/:id` | Coupon update karo |
| `DELETE` | `/coupons/:id` | Coupon delete karo |

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
Scheduled-publish tracking, reaped by `jobs/cron.js` (see Job Scheduling).  
Key fields: `scheduledAt`, `bullJobId` (currently a stub value — BullMQ is disabled), `status`, `retryCount`

### ChannelAnalytics / VideoAnalytics (analytics.model.js)
Daily snapshots + 7×24 Heatmap — sab ek hi file mein.

### Comment
YouTube comments with AI.  
Key fields: `sentiment.label`, `aiReply`, `status` (unread/pending_reply/replied/ignored)

### GrowthPrediction / Competitor / Trend (growth.model.js)
30/90/365 day predictions, competitor tracking, keyword trends.

### Coupon
Discount codes for checkout.
Key fields: `code`, `type` (internal/public), `discountType` (percent/fixed), `discountValue`, `validPlans`

### Referral
Per-payment commission ledger — separate from `User.referral.*` summary fields.
Key fields: `referrerId`, `referredUserId`, `commissionRate`, `commissionAmount`, `billingCycleIndex` (1-6), `status` (credited/reversed)

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

## 📅 Job Scheduling

**BullMQ is currently stubbed / disabled** (`queue.config.js`) — Upstash's free Redis plan blocks `evalsha` (the Lua scripts BullMQ needs), so every queue in that file is a no-op (`makeStubQueue`). `src/jobs/videoPublish.job.js`'s BullMQ worker is dead code as a result — it's never imported anywhere.

**What actually runs scheduling today:** an in-process scheduler in `src/jobs/cron.js`, driven by plain `setInterval` (single Node process, fine on Render's current single-instance deploy):

| Job | Interval | Purpose |
|---|---|---|
| `reapPublishedSchedules` | 60s | Flips `Schedule`/`Video` status to `published` once YouTube's own `publishAt` time passes |
| `syncAllChannelsAnalytics` | 24h | Pulls YouTube Analytics + comments for every active channel |
| `refreshTrends` | 12h | Refreshes the Trend Opportunity Scanner from YouTube's `mostPopular` chart |
| `sendWeeklyReports` | 24h (fires only on Monday) | Sends the weekly performance email to opted-in users |

### Video Publish Flow (current, real)
```
User schedules video (privacy=private, publishAt=scheduledAt)
    ↓
video.service.js uploadVideo() streams the file: GCS staging → YouTube resumable upload
    ↓
Video.youtubeVideoId set, Video.status = "scheduled"
    ↓
YouTube itself flips the video to public at publishAt (no polling needed for the flip)
    ↓
cron.js reapPublishedSchedules() (60s poll) notices scheduledAt has passed,
updates Schedule.status/Video.status to "published" in our own DB
```

> ⚠️ **Known limitation:** because scheduling runs as in-process `setInterval` rather than a distributed queue, it is **not safe if the backend ever scales to more than one instance** — every instance would run its own cron and duplicate work (double emails, double analytics syncs). Re-enabling BullMQ on a paid Redis plan (or an alternative like a distributed cron/queue) is required before horizontal scaling. See Roadmap.

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
   http://localhost:8080/api/v1/youtube/callback           ← development
   https://your-backend.onrender.com/api/v1/youtube/callback ← production
   ```
7. Client ID aur Secret copy karke `.env` mein daal do

---

## 🚢 Deployment

### Backend (Render — current production host)

1. [Render](https://render.com) pe GitHub repo connect karo
2. Root directory: `backend`
3. Build command: `npm install`
4. Start command: `npm start`
5. Environment variables Render dashboard's **Environment** tab mein set karo (never commit `.env`)
6. Render's free tier cold-starts and sleeps on idle — code already accounts for this (see `youtube.service.js`'s 30-minute OAuth state cache, sized for cold-start delay)

A `Dockerfile` + `cloudbuild.yaml` also exist in the repo for a Google Cloud Run alternative (`gcloud builds submit --config cloudbuild.yaml`), but Render is what's actually running in production today (see the `.onrender.com` CORS allowance and `trust proxy` setting in `app.js`).

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
5. Environment variable add karo: `VITE_API_URL = https://your-backend.onrender.com/api/v1`

`vercel.json` already hai — SPA routing automatically handle hogi.

### Required Services

| Service | Free Tier | Link |
|---|---|---|
| MongoDB Atlas | 512MB free | [mongodb.com/atlas](https://mongodb.com/atlas) |
| Upstash Redis | 10K commands/day free | [upstash.com](https://upstash.com) |
| Render | Free web service (cold starts on idle) | [render.com](https://render.com) |
| Vercel | Unlimited hobby | [vercel.com](https://vercel.com) |
| Brevo Email | 300 emails/day free | [brevo.com](https://brevo.com) |
| Sentry | 5K errors/month free | [sentry.io](https://sentry.io) |

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

All the critical/high/medium issues that used to be tracked here (video file persistence, `checkUsageLimit` `_id` bug, Cloudinary, email delivery, referral backend, payment gateway, AI prompt injection, trend data) are fixed — see the Roadmap below for what's still genuinely open.

**Currently open:**

- **Single-instance scheduling risk** — `jobs/cron.js` uses plain `setInterval`, which duplicates work (double emails, double analytics syncs) if the backend ever runs as more than one instance. Fine today (single Render instance); needs BullMQ back on a paid Redis plan (or an equivalent distributed scheduler) before horizontal scaling. See Roadmap Phase 3.
- **Zero automated test coverage** — no test files exist anywhere in the repo yet.
- **No CI pipeline** — nothing runs automatically on push/PR before code lands on `main`.

---

## 🗺️ Roadmap

### Phase 1 — Critical Fixes ✅
- [x] Video file → Google Cloud Storage (streamed, not buffered — including a later fix for a staging-file leak on early-exit error paths)
- [x] `checkUsageLimit` `_id` bug fix
- [x] `.dockerignore` add karo
- [x] Email delivery (Brevo HTTP API — not SMTP/Nodemailer, which is why this used to look "misconfigured")
- [x] Referral backend (routes + controller + service — fully built)
- [ ] Confirm `GEMINI_API_KEY` is set in the production environment (Render) — can't be verified from code, needs a manual check

### Phase 2 — Launch Ready ✅
- [x] Payment gateway (Razorpay)
- [x] Cloudinary thumbnail upload
- [x] Admin dashboard + `isAdmin`-gated routes
- [x] Trend data source (YouTube Data API `mostPopular` chart)
- [x] Error monitoring (Sentry — backend + frontend)
- [x] Weekly email reports
- [x] Redis analytics caching (YouTube quota bachao — `analytics.service.js`, 30min-24hr TTLs)
- [x] AI prompt injection sanitization (`sanitize.utils.js`, wired into every AI call site including untrusted YouTube comment text)
- [x] Structured logging (Winston — JSON in prod, replaces raw `console.*`)
- [x] CORS driven entirely by env config (no hardcoded origins)

### Phase 3 — Scale (in progress)

**3A — Hygiene**
- [x] Full README audit (this pass)
- [ ] Remove dead `jobs/videoPublish.job.js` (unreferenced, and broken if it were used — see Job Scheduling)
- [ ] ESLint + Prettier (backend + frontend) — zero lint config currently exists
- [ ] CI pipeline (`.github/workflows`) — lint (+ test once Phase 3B lands) on every push/PR

**3B — Safety net**
- [ ] Test suite (Vitest + Supertest backend, Testing Library frontend) — prioritize auth, payment verification, video upload, AI sanitization, cron reaper

**3C — TypeScript migration** (paired with 3B, incremental — not a rewrite)
- [ ] `allowJs + checkJs` + JSDoc types on the backend first, zero build-step change
- [ ] Convert individual files to real `.ts` once covered by tests, starting with the services with the most implicit shapes (analytics/payment/video)
- [ ] Frontend: `.jsx` → `.tsx` opportunistically via Vite's native TS support

**3D — Feature / scale items**
- [ ] YouTube comment webhooks (real-time, replaces polling, saves quota)
- [ ] CSV / PDF analytics export
- [ ] BullMQ re-enabled on a paid Redis plan — fixes the single-instance scheduling risk, required before any horizontal scaling
- [ ] Mobile PWA (manifest.json + service worker — doesn't exist yet)
- [ ] Play Store publish — final step, gated on the PWA work + store account/signing setup

---

## 🧑‍💻 Tech Stack

**Backend:** Node.js 18+ · Express.js · MongoDB + Mongoose · Redis (ioredis) · JWT · bcryptjs · Multer · Winston (logging) · Sentry (error tracking)  
**Frontend:** React 18 · Vite · Tailwind CSS · Zustand · Axios · Recharts · React Router DOM · Sentry  
**AI:** Anthropic Claude (Opus/Sonnet/Haiku) · Google Gemini · Groq (Llama 3.3, free-tier bulk replies)  
**Infra:** Render (backend) · Vercel (frontend) · MongoDB Atlas · Upstash Redis · Google Cloud Storage (video staging) · Cloudinary (thumbnails) · Brevo (email, HTTP API) · Razorpay (payments)

> **Note on BullMQ:** it's a listed dependency and the queue definitions still exist in code, but it's currently **disabled/stubbed** — Upstash's free Redis tier blocks the Lua scripts (`evalsha`) BullMQ needs. Real scheduling today runs on an in-process cron (`jobs/cron.js`). See [Job Scheduling](#-job-scheduling) and Phase 3D in the Roadmap.

---

<div align="center">

Made with ❤️ by Satish Kumar  
**TubeOS 3.0 — MVP**

</div>
