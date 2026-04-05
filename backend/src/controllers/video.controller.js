// src/controllers/video.controller.js
// Video upload + management controller

const videoService = require('../services/video.service');
const {
  successResponse,
  errorResponse,
  paginatedResponse,
} = require('../utils/response.utils');

// POST /api/v1/videos/draft
const createDraft = async (req, res) => {
  try {
    const { channelId, ...videoData } = req.body;

    if (!channelId) {
      return errorResponse(res, 400, 'Channel ID is required');
    }

    const result = await videoService.createDraft(req.user._id, channelId, videoData);
    return successResponse(res, 201, result.message, result.video);
  } catch (err) {
    return errorResponse(res, err.statusCode || 500, err.message);
  }
};

// POST /api/v1/videos/:videoId/upload
// Expects: multipart/form-data with 'video' file
const uploadVideo = async (req, res) => {
  try {
    const { videoId } = req.params;

    // Check if file was provided
    if (!req.file && !req.body.fileBuffer) {
      return errorResponse(res, 400, 'Video file is required');
    }

    const fileBuffer = req.file ? req.file.buffer : Buffer.from(req.body.fileBuffer, 'base64');
    const mimeType = req.file ? req.file.mimetype : req.body.mimeType || 'video/mp4';

    const result = await videoService.uploadVideo(
      req.user._id,
      videoId,
      fileBuffer,
      mimeType
    );

    return successResponse(res, 200, result.message, {
      video: result.video,
      youtubeVideoId: result.youtubeVideoId,
    });
  } catch (err) {
    return errorResponse(res, err.statusCode || 500, err.message);
  }
};

// PATCH /api/v1/videos/:videoId
const updateVideo = async (req, res) => {
  try {
    const result = await videoService.updateVideo(
      req.user._id,
      req.params.videoId,
      req.body
    );
    return successResponse(res, 200, result.message, result.video);
  } catch (err) {
    return errorResponse(res, err.statusCode || 500, err.message);
  }
};

// DELETE /api/v1/videos/:videoId
const deleteVideo = async (req, res) => {
  try {
    const deleteFromYouTube = req.query.youtube === 'true';
    const result = await videoService.deleteVideo(
      req.user._id,
      req.params.videoId,
      deleteFromYouTube
    );
    return successResponse(res, 200, result.message);
  } catch (err) {
    return errorResponse(res, err.statusCode || 500, err.message);
  }
};

// GET /api/v1/videos
const getMyVideos = async (req, res) => {
  try {
    const result = await videoService.getMyVideos(req.user._id, req.query);
    return paginatedResponse(
      res,
      200,
      'Videos fetched',
      result.videos,
      result.pagination
    );
  } catch (err) {
    return errorResponse(res, err.statusCode || 500, err.message);
  }
};

// GET /api/v1/videos/:videoId
const getVideo = async (req, res) => {
  try {
    const result = await videoService.getVideo(req.user._id, req.params.videoId);
    return successResponse(res, 200, 'Video fetched', result.video);
  } catch (err) {
    return errorResponse(res, err.statusCode || 500, err.message);
  }
};

// GET /api/v1/videos/upcoming
const getUpcoming = async (req, res) => {
  try {
    const result = await videoService.getUpcomingVideos(req.user._id);
    return successResponse(res, 200, 'Upcoming videos', result.videos);
  } catch (err) {
    return errorResponse(res, err.statusCode || 500, err.message);
  }
};

// POST /api/v1/videos/:videoId/cancel
const cancelScheduled = async (req, res) => {
  try {
    const result = await videoService.cancelScheduled(
      req.user._id,
      req.params.videoId
    );
    return successResponse(res, 200, result.message, result.video);
  } catch (err) {
    return errorResponse(res, err.statusCode || 500, err.message);
  }
};

module.exports = {
  createDraft,
  uploadVideo,
  updateVideo,
  deleteVideo,
  getMyVideos,
  getVideo,
  getUpcoming,
  cancelScheduled,
};
