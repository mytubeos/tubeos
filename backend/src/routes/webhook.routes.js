// src/routes/webhook.routes.js
// Public routes — no JWT auth (YouTube hub calls these directly)

const express = require('express');
const router = express.Router();
const webhookController = require('../controllers/webhook.controller');

// YouTube PubSubHubbub challenge verification
router.get('/youtube', webhookController.verifyWebhook);

// YouTube new-video push notification (raw XML body — see app.js rawBody setup)
router.post('/youtube', webhookController.handleNotification);

module.exports = router;
