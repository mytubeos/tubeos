// src/routes/video.routes.js
// All video management routes

const express = require('express');
const router = express.Router();
const videoController = require('../controllers/video.controller');
const { protect, checkUsageLimit } = require('../middlewares/auth.middleware');
const { uploadLimiter } = require('../middlewares/rateLimiter.middleware');
const { uploadVideoFile } = require('../middlewares/upload.middleware');

const multer = require('multer');

// Video upload: streams to GCS when configured, else buffers in RAM (dev).
const parseVideoUpload = uploadVideoFile;

const thumbnailUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB (YouTube limit)
  fileFilter: (req, file, cb) => {
    if (!/^image\/(jpeg|png|webp)$/i.test(file.mimetype)) {
      return cb(new Error('Only JPEG/PNG/WebP thumbnails are allowed'));
    }
    cb(null, true);
  },
}).single('thumbnail');

/**
 * @route   GET /api/v1/videos
 * @desc    Get all my videos (with filters + pagination)
 * @access  Private
 * @query   page, limit, status, channelId, search
 */
router.get('/', protect, videoController.getMyVideos);

/**
 * @route   GET /api/v1/videos/upcoming
 * @desc    Get upcoming scheduled videos
 * @access  Private
 */
router.get('/upcoming', protect, videoController.getUpcoming);

/**
 * @route   GET /api/v1/videos/:videoId
 * @desc    Get single video details
 * @access  Private
 */
router.get('/:videoId', protect, videoController.getVideo);

/**
 * @route   POST /api/v1/videos/draft
 * @desc    Create a video draft (metadata only, no file)
 * @access  Private
 * @body    { channelId, title, description, tags, category, privacy, scheduledAt }
 */
router.post('/draft', protect, videoController.createDraft);

/**
 * @route   POST /api/v1/videos/:videoId/upload
 * @desc    Upload video file to YouTube
 * @access  Private
 * @body    multipart/form-data with 'video' file
 */
router.post(
  '/:videoId/upload',
  protect,
  uploadLimiter,
  checkUsageLimit('upload'),
  parseVideoUpload,
  videoController.uploadVideo
);

/**
 * @route   PATCH /api/v1/videos/:videoId
 * @desc    Update video metadata
 * @access  Private
 */
router.patch('/:videoId', protect, videoController.updateVideo);

/**
 * @route   POST /api/v1/videos/:videoId/cancel
 * @desc    Cancel a scheduled video
 * @access  Private
 */
router.post('/:videoId/cancel', protect, videoController.cancelScheduled);

/**
 * @route   DELETE /api/v1/videos/:videoId
 * @desc    Delete a video
 * @access  Private
 * @query   youtube=true to also delete from YouTube
 */
router.delete('/:videoId', protect, videoController.deleteVideo);

/**
 * @route   POST /api/v1/videos/:videoId/thumbnail
 * @desc    Upload custom thumbnail to Cloudinary (max 2MB, JPEG/PNG/WebP)
 */
router.post('/:videoId/thumbnail', protect, thumbnailUpload, videoController.uploadThumbnail);

/**
 * @route   DELETE /api/v1/videos/:videoId/thumbnail
 * @desc    Remove custom thumbnail
 */
router.delete('/:videoId/thumbnail', protect, videoController.deleteThumbnail);

module.exports = router;
