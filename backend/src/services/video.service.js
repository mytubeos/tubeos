// src/services/video.service.js
// Video upload to YouTube + video management

const Video = require('../models/video.model');
const YoutubeChannel = require('../models/youtube-channel.model');
const User = require('../models/user.model');
const { getValidAccessToken } = require('./youtube.service');
const { youtubeRequest, QUOTA_COSTS } = require('../config/youtube.config');
const { setCache, getCache } = require('../config/redis');

// ==================== CREATE DRAFT ====================
const createDraft = async (userId, channelId, videoData) => {
  // 1. Verify channel belongs to user
  const channel = await YoutubeChannel.findOne({
    _id: { $eq: channelId },
    userId: { $eq: userId },
    isActive: true,
  });

  if (!channel) {
    const err = new Error('Channel not found or not connected');
    err.statusCode = 404;
    throw err;
  }

  // 2. Create video draft
  const video = await Video.create({
    userId,
    channelId,
    title: videoData.title,
    description: videoData.description || '',
    tags: videoData.tags || [],
    category: videoData.category || '22',
    privacy: videoData.privacy || 'private',
    scheduledAt: videoData.scheduledAt || null,
    status: 'draft',
    notes: videoData.notes || null,
    isShort: videoData.isShort || false,
    thumbnail: {
      url: videoData.thumbnailUrl || null,
      isCustom: !!videoData.thumbnailUrl,
    },
  });

  return { video, message: 'Draft saved successfully' };
};

// ==================== UPLOAD VIDEO TO YOUTUBE ====================
const uploadVideo = async (userId, videoId, fileBuffer, mimeType) => {
  // 1. Get video
  const video = await Video.findOne({ _id: videoId, userId });
  if (!video) {
    const err = new Error('Video not found');
    err.statusCode = 404;
    throw err;
  }

  if (!['draft', 'failed'].includes(video.status)) {
    const err = new Error(`Cannot upload video with status: ${video.status}`);
    err.statusCode = 400;
    throw err;
  }

  // 2. Get channel with OAuth tokens
  const channel = await YoutubeChannel.findOne({
    _id: video.channelId,
    userId,
    isActive: true,
  }).select('+oauth.accessToken +oauth.refreshToken +oauth.expiresAt');

  if (!channel) {
    const err = new Error('Channel not found');
    err.statusCode = 404;
    throw err;
  }

  // 3. Check upload quota
  await channel.resetDailyQuotaIfNeeded();
  if (channel.quota.uploadCount >= channel.quota.uploadDailyLimit) {
    const err = new Error(
      `Daily upload limit reached (${channel.quota.uploadDailyLimit}/day). Try again tomorrow.`
    );
    err.statusCode = 429;
    throw err;
  }

  // 4. Check user plan upload limit
  const user = await User.findById(userId);
  if (!user.hasUsageLeft('uploads')) {
    const err = new Error(
      `Monthly upload limit reached. Upgrade your plan for more uploads.`
    );
    err.statusCode = 429;
    throw err;
  }

  // 5. Get valid access token
  const accessToken = await getValidAccessToken(channel);

  // 6. Update video status to uploading
  video.status = 'uploading';
  video.uploadInfo.uploadStartedAt = new Date();
  await video.save();

  try {
    // 7. Prepare video metadata for YouTube
    const videoResource = {
      snippet: {
        title: video.title,
        description: video.description,
        tags: video.tags,
        categoryId: video.category,
        defaultLanguage: video.language,
      },
      status: {
        privacyStatus: video.scheduledAt ? 'private' : video.privacy,
        // If scheduled, YouTube will make it public at scheduled time
        publishAt: video.scheduledAt ? video.scheduledAt.toISOString() : undefined,
        selfDeclaredMadeForKids: false,
      },
    };

    // 8. Upload to YouTube using resumable upload
    const youtubeVideoId = await uploadToYouTube(
      accessToken,
      videoResource,
      fileBuffer,
      mimeType
    );

    // 9. Upload custom thumbnail if provided
    if (video.thumbnail.url && video.thumbnail.isCustom) {
      await uploadThumbnailToYouTube(accessToken, youtubeVideoId, video.thumbnail.url);
    }

    // 10. Update video with YouTube data
    video.youtubeVideoId = youtubeVideoId;
    video.youtubeUrl = `https://www.youtube.com/watch?v=${youtubeVideoId}`;
    video.status = video.scheduledAt ? 'scheduled' : 'processing';
    video.uploadInfo.uploadCompletedAt = new Date();
    await video.save();

    // 11. Update channel quota + user usage
    await YoutubeChannel.findByIdAndUpdate(channel._id, {
      $inc: {
        'quota.dailyUsed': QUOTA_COSTS.videos_insert,
        'quota.uploadCount': 1,
      },
    });

    await User.findByIdAndUpdate({ $eq: userId }, {
      $inc: { 'usage.uploadsUsed': 1 },
    });

    return {
      video,
      youtubeVideoId,
      message: video.scheduledAt
        ? `Video scheduled for ${video.scheduledAt.toISOString()}`
        : 'Video uploaded successfully! YouTube is processing it.',
    };
  } catch (err) {
    // Update video status to failed
    video.status = 'failed';
    video.lastError = {
      message: err.message,
      code: err.code || 'UPLOAD_FAILED',
      occurredAt: new Date(),
    };
    video.retryCount += 1;
    await video.save();

    throw err;
  }
};

// ==================== UPLOAD TO YOUTUBE (Resumable Upload) ====================
const uploadToYouTube = async (accessToken, videoResource, fileBuffer, mimeType) => {
  // Step 1: Initiate resumable upload session
  const initResponse = await fetch(
    'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Upload-Content-Type': mimeType,
        'X-Upload-Content-Length': fileBuffer.length,
      },
      body: JSON.stringify(videoResource),
    }
  );

  if (!initResponse.ok) {
    const error = await initResponse.json().catch(() => ({}));
    throw new Error(error.error?.message || 'Failed to initiate YouTube upload');
  }

  // Get upload URL from response headers
  const uploadUrl = initResponse.headers.get('location');
  if (!uploadUrl) {
    throw new Error('No upload URL received from YouTube');
  }

  // Step 2: Upload video content
  const uploadResponse = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': mimeType,
      'Content-Length': fileBuffer.length,
    },
    body: fileBuffer,
  });

  if (!uploadResponse.ok) {
    const error = await uploadResponse.json().catch(() => ({}));
    throw new Error(error.error?.message || 'Failed to upload video to YouTube');
  }

  const uploadedVideo = await uploadResponse.json();
  return uploadedVideo.id;
};

// ==================== UPLOAD THUMBNAIL ====================
const uploadThumbnailToYouTube = async (accessToken, youtubeVideoId, thumbnailUrl) => {
  try {
    // Fetch thumbnail image
    const imageResponse = await fetch(thumbnailUrl);
    if (!imageResponse.ok) return;

    const imageBuffer = await imageResponse.arrayBuffer();
    const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';

    await fetch(
      `https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId=${youtubeVideoId}&uploadType=media`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': contentType,
        },
        body: Buffer.from(imageBuffer),
      }
    );
  } catch (err) {
    // Non-critical — don't fail upload if thumbnail fails
    console.error('Thumbnail upload failed:', err.message);
  }
};

// ==================== UPDATE VIDEO METADATA ====================
const updateVideo = async (userId, videoId, updates) => {
  const video = await Video.findOne({ _id: videoId, userId });
  if (!video) {
    const err = new Error('Video not found');
    err.statusCode = 404;
    throw err;
  }

  if (!video.isEditable) {
    const err = new Error(`Cannot edit video with status: ${video.status}`);
    err.statusCode = 400;
    throw err;
  }

  // Update allowed fields
  const allowedFields = [
    'title', 'description', 'tags', 'category',
    'privacy', 'scheduledAt', 'notes', 'thumbnail',
  ];

  allowedFields.forEach((field) => {
    if (updates[field] !== undefined) {
      video[field] = updates[field];
    }
  });

  await video.save();

  // If video is already on YouTube, update metadata there too
  if (video.youtubeVideoId && video.status !== 'draft') {
    try {
      const channel = await YoutubeChannel.findById(video.channelId)
        .select('+oauth.accessToken +oauth.refreshToken +oauth.expiresAt');
      const accessToken = await getValidAccessToken(channel);

      await youtubeRequest(
        `/videos?part=snippet,status`,
        {
          method: 'PUT',
          headers: { Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify({
            id: video.youtubeVideoId,
            snippet: {
              title: video.title,
              description: video.description,
              tags: video.tags,
              categoryId: video.category,
            },
            status: {
              privacyStatus: video.privacy,
            },
          }),
        }
      );
    } catch (err) {
      console.error('Failed to update YouTube metadata:', err.message);
      // Don't fail — local update succeeded
    }
  }

  return { video, message: 'Video updated successfully' };
};

// ==================== DELETE VIDEO ====================
const deleteVideo = async (userId, videoId, deleteFromYouTube = false) => {
  const video = await Video.findOne({ _id: { $eq: videoId }, userId: { $eq: userId } });
  if (!video) {
    const err = new Error('Video not found');
    err.statusCode = 404;
    throw err;
  }

  // Optionally delete from YouTube
  if (deleteFromYouTube && video.youtubeVideoId) {
    try {
      const channel = await YoutubeChannel.findById(video.channelId)
        .select('+oauth.accessToken +oauth.refreshToken +oauth.expiresAt');
      const accessToken = await getValidAccessToken(channel);

      await youtubeRequest(
        `/videos?id=${video.youtubeVideoId}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );
    } catch (err) {
      console.error('Failed to delete from YouTube:', err.message);
    }
  }

  await video.deleteOne();
  return { message: 'Video deleted successfully' };
};

// ==================== GET MY VIDEOS ====================
const getMyVideos = async (userId, filters = {}) => {
  const {
    page = 1,
    limit = 10,
    status,
    channelId,
    search,
  } = filters;

  const query = { userId };
  if (status) query.status = status;
  if (channelId) query.channelId = channelId;
  if (search) {
    query.$or = [
      { title: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
    ];
  }

  const skip = (page - 1) * limit;
  const [videos, total] = await Promise.all([
    Video.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('channelId', 'channelName thumbnail channelId'),
    Video.countDocuments(query),
  ]);

  return {
    videos,
    pagination: { page: parseInt(page), limit: parseInt(limit), total },
  };
};

// ==================== GET SINGLE VIDEO ====================
const getVideo = async (userId, videoId) => {
  const video = await Video.findOne({ _id: { $eq: videoId }, userId: { $eq: userId } })
    .populate('channelId', 'channelName thumbnail channelId stats');

  if (!video) {
    const err = new Error('Video not found');
    err.statusCode = 404;
    throw err;
  }

  return { video };
};

// ==================== GET UPCOMING SCHEDULED ====================
const getUpcomingVideos = async (userId) => {
  const videos = await Video.find({
    userId,
    status: 'scheduled',
    scheduledAt: { $gte: new Date() },
  })
    .sort({ scheduledAt: 1 })
    .limit(20)
    .populate('channelId', 'channelName thumbnail');

  return { videos };
};

// ==================== CANCEL SCHEDULED VIDEO ====================
const cancelScheduled = async (userId, videoId) => {
  const video = await Video.findOne({ _id: { $eq: videoId }, userId: { $eq: userId }, status: 'scheduled' });
  if (!video) {
    const err = new Error('Scheduled video not found');
    err.statusCode = 404;
    throw err;
  }

  video.status = 'cancelled';
  video.scheduledAt = null;
  await video.save();

  // Cancel BullMQ job if exists (Part 3 will handle this)
  // Will be integrated when scheduler is built

  return { video, message: 'Scheduled video cancelled' };
};

module.exports = {
  createDraft,
  uploadVideo,
  updateVideo,
  deleteVideo,
  getMyVideos,
  getVideo,
  getUpcomingVideos,
  cancelScheduled,
};
