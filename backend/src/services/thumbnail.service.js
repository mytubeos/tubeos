// src/services/thumbnail.service.js
// Cloudinary-backed thumbnail upload. Falls back to no-op if Cloudinary
// is not configured (so the rest of the app keeps working).

const Video = require('../models/video.model');
const logger = require('../config/logger');

let cloudinary = null;
try {
  // Optional dependency — won't crash boot if missing
  cloudinary = require('cloudinary').v2;
} catch {
  logger.warn('[thumbnail] cloudinary package not installed — uploads disabled');
}

const isConfigured = () => {
  return !!(
    cloudinary &&
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  );
};

if (cloudinary && isConfigured()) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

const uploadThumbnail = async (userId, videoId, fileBuffer, mimeType) => {
  if (!isConfigured()) {
    const err = new Error('Thumbnail upload unavailable — Cloudinary not configured');
    err.statusCode = 503;
    throw err;
  }

  const video = await Video.findOne({ _id: videoId, userId });
  if (!video) {
    const err = new Error('Video not found');
    err.statusCode = 404;
    throw err;
  }

  if (!fileBuffer || fileBuffer.length === 0) {
    const err = new Error('Thumbnail file is required');
    err.statusCode = 400;
    throw err;
  }

  // YouTube limit: 2 MB
  if (fileBuffer.length > 2 * 1024 * 1024) {
    const err = new Error('Thumbnail must be under 2 MB');
    err.statusCode = 400;
    throw err;
  }

  // Delete old thumbnail if exists
  if (video.thumbnail?.cloudinaryId) {
    try {
      await cloudinary.uploader.destroy(video.thumbnail.cloudinaryId);
    } catch (err) {
      logger.warn('[thumbnail] old destroy failed', { error: err.message });
    }
  }

  // Upload via stream
  const result = await new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: `tubeos/thumbnails/${userId}`,
        resource_type: 'image',
        transformation: [{ width: 1280, height: 720, crop: 'limit', quality: 'auto:good' }],
      },
      (err, res) => (err ? reject(err) : resolve(res))
    );
    stream.end(fileBuffer);
  });

  video.thumbnail = {
    url: result.secure_url,
    cloudinaryId: result.public_id,
    isCustom: true,
    width: result.width,
    height: result.height,
  };
  await video.save();

  return { thumbnail: video.thumbnail, message: 'Thumbnail uploaded' };
};

const deleteThumbnail = async (userId, videoId) => {
  const video = await Video.findOne({ _id: videoId, userId });
  if (!video) {
    const err = new Error('Video not found');
    err.statusCode = 404;
    throw err;
  }

  if (video.thumbnail?.cloudinaryId && isConfigured()) {
    try {
      await cloudinary.uploader.destroy(video.thumbnail.cloudinaryId);
    } catch (err) {
      logger.warn('[thumbnail] destroy failed', { error: err.message });
    }
  }

  video.thumbnail = { url: null, cloudinaryId: null, isCustom: false };
  await video.save();
  return { message: 'Thumbnail removed' };
};

module.exports = { uploadThumbnail, deleteThumbnail, isConfigured };
