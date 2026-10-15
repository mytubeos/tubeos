const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth.middleware');
const { authLimiter } = require('../middlewares/rateLimiter.middleware');
const Report = require('../models/content-report.model');
router.post('/', protect, authLimiter, async (req, res) => {
  const { source, reason, excerpt = '', details = '' } = req.body;
  const reasons = [
    'unsafe',
    'hate_harassment',
    'sexual_content',
    'child_safety',
    'misleading',
    'other',
  ];
  if (
    typeof source !== 'string' ||
    !source.startsWith('/') ||
    source.length > 200 ||
    !reasons.includes(reason) ||
    typeof excerpt !== 'string' ||
    excerpt.length > 10000 ||
    typeof details !== 'string' ||
    details.length > 2000 ||
    (!excerpt.trim() && !details.trim())
  ) {
    return res.status(400).json({
      success: false,
      message:
        'Choose a reason and include the content or a description (up to 10,000 / 2,000 characters).',
    });
  }
  try {
    const report = await Report.create({ userId: req.user.id, source, reason, excerpt, details });
    return res
      .status(201)
      .json({ success: true, data: { id: report._id }, message: 'Report received for review.' });
  } catch {
    return res
      .status(503)
      .json({ success: false, message: 'Could not send your report. Please try again.' });
  }
});
module.exports = router;
