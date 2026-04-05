// src/app.js
// Express app setup — middlewares, routes, error handlers

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

// Set security HTTP headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// CORS — allow frontend to talk to backend
app.use(cors({
  origin: [
    config.cors.clientUrl,
    'http://localhost:3000',
    'http://localhost:5173', // Vite dev server
  ],
  credentials: true, // Allow cookies
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Trust proxy (needed for Render deployment)
app.set('trust proxy', 1);

// ==================== BODY PARSING ====================

// Parse JSON bodies
app.use(express.json({ limit: '10mb' }));

// Parse URL-encoded bodies
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Parse cookies
app.use(cookieParser());

// ==================== DATA SANITIZATION ====================

// Prevent NoSQL injection attacks
app.use(mongoSanitize());

// ==================== RATE LIMITING ====================

// Apply general rate limit to all /api routes
app.use('/api', apiLimiter);

// ==================== REQUEST LOGGING (Dev only) ====================
if (config.isDev) {
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      const status = res.statusCode;
      const color = status >= 500 ? '\x1b[31m' : status >= 400 ? '\x1b[33m' : '\x1b[32m';
      console.log(
        `${color}${req.method}\x1b[0m ${req.originalUrl} ${color}${status}\x1b[0m - ${duration}ms`
      );
    });
    next();
  });
}

// ==================== ROUTES ====================

// Mount all API routes under /api/v1
app.use('/api/v1', routes);

// Root route
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: '🚀 Welcome to TubeOS API',
    version: '1.0.0',
    docs: '/api/v1/health',
  });
});

// ==================== ERROR HANDLERS ====================

// 404 handler — must be after all routes
app.use(notFound);

// Global error handler — must be last
app.use(globalErrorHandler);

module.exports = app;

