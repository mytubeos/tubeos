// src/app.js

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const mongoSanitize = require('express-mongo-sanitize');
const { config } = require('./config/env');
const routes = require('./routes/index');
const { notFound, globalErrorHandler } = require('./middlewares/error.middleware');
const { apiLimiter } = require('./middlewares/rateLimiter.middleware');
const logger = require('./config/logger');

const app = express();

// ==================== SECURITY MIDDLEWARES ====================
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    // Helmet's default COOP is 'same-origin', which severs window.opener and
    // blocks the parent's `popup.closed` check — breaking the Google OAuth popup
    // (the "Cross-Origin-Opener-Policy would block the window.closed call" errors).
    // 'same-origin-allow-popups' keeps the opener link so the popup flow works.
    crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
  })
);

// CORS — every allowed origin comes from env config, nothing hardcoded here.
const allowedOrigins = [
  config.cors.clientUrl, // .env CLIENT_URL
  ...config.cors.extraOrigins, // .env CORS_EXTRA_ORIGINS (defaults to local dev ports when unset in dev)
];

// Vercel sets VERCEL_URL automatically at build/deploy time (not user-configured)
if (process.env.VERCEL_URL) {
  allowedOrigins.push(`https://${process.env.VERCEL_URL}`);
}
if (process.env.FRONTEND_URL) {
  allowedOrigins.push(process.env.FRONTEND_URL);
}

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (mobile apps, Postman, etc.)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      // FIX: Vercel preview URLs allow karo (*.vercel.app)
      if (origin.endsWith('.vercel.app') || origin.endsWith('.onrender.com')) {
        return callback(null, true);
      }
      return callback(new Error(`CORS: ${origin} not allowed`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// Trust proxy (needed for Render deployment)
app.set('trust proxy', 1);

// ==================== BODY PARSING ====================
// Capture raw body for:
//  - Razorpay webhook signature verification (JSON)
//  - YouTube PubSubHubbub notifications (Atom XML)
app.use((req, res, next) => {
  const url = req.originalUrl;
  if (url === '/api/v1/payment/webhook' || url === '/api/v1/webhooks/youtube') {
    let data = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => {
      data += chunk;
    });
    req.on('end', () => {
      req.rawBody = data;
      if (url === '/api/v1/payment/webhook') {
        req.body = JSON.parse(data || '{}');
      }
      next();
    });
  } else {
    next();
  }
});
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// ==================== DATA SANITIZATION ====================
app.use(mongoSanitize());

// ==================== RATE LIMITING ====================
app.use('/api', apiLimiter);

// ==================== REQUEST LOGGING ====================
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    const status = res.statusCode;
    const level = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';
    logger.log(level, `${req.method} ${req.originalUrl} ${status} - ${duration}ms`, {
      method: req.method,
      url: req.originalUrl,
      status,
      durationMs: duration,
      ip: req.ip,
    });
  });
  next();
});

// ==================== ROUTES ====================
app.use('/api/v1', routes);

app.get('/', (req, res) => {
  res.json({
    success: true,
    message: '🚀 Welcome to TubeOS API',
    version: '1.0.0',
    docs: '/api/v1/health',
  });
});

// ==================== ERROR HANDLERS ====================
app.use(notFound);
app.use(globalErrorHandler);

module.exports = app;
