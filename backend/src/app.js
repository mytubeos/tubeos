// src/app.js
// FIX: CORS — env variable se URL lo, hardcode mat karo
// FIX: credentials false since cross-origin cookies don't work on free hosting

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const mongoSanitize = require('express-mongo-sanitize');
const { config } = require('./config/env');
const routes = require('./routes/index');
const { notFound, globalErrorHandler } = require('./middlewares/error.middleware');
const { apiLimiter } = require('./middlewares/rateLimiter.middleware');

const app = express();

// ==================== SECURITY MIDDLEWARES ====================
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// FIX: CORS — sab allowed origins env se lo
const allowedOrigins = [
  config.cors.clientUrl,          // .env se CLIENT_URL
  'http://localhost:3000',
  'http://localhost:5173',
];

// Extra Vercel URLs .env se add karo agar set hain
if (process.env.VERCEL_URL) {
  allowedOrigins.push(`https://${process.env.VERCEL_URL}`);
}
if (process.env.FRONTEND_URL) {
  allowedOrigins.push(process.env.FRONTEND_URL);
}

app.use(cors({
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
}));

// Trust proxy (needed for Render deployment)
app.set('trust proxy', 1);

// ==================== BODY PARSING ====================
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// ==================== DATA SANITIZATION ====================
app.use(mongoSanitize());

// ==================== RATE LIMITING ====================
app.use('/api', apiLimiter);

// ==================== REQUEST LOGGING (Dev only) ====================
if (config.isDev) {
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      const status = res.statusCode;
      const color = status >= 500 ? '\x1b[31m' : status >= 400 ? '\x1b[33m' : '\x1b[32m';
      console.log(`${color}${req.method}\x1b[0m ${req.originalUrl} ${color}${status}\x1b[0m - ${duration}ms`);
    });
    next();
  });
}

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
