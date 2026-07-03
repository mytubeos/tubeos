// src/middlewares/upload.middleware.js
// Multer configuration for video uploads.
//
// When GCS is configured, the incoming multipart file is STREAMED directly
// to Google Cloud Storage (constant memory). Otherwise we fall back to
// multer.memoryStorage() so local dev without GCS still works.

const multer = require('multer');
const { randomUUID } = require('crypto');
const storageService = require('../services/storage.service');

const MAX_VIDEO_BYTES = 2 * 1024 * 1024 * 1024; // 2 GB

// ---- Custom multer StorageEngine that streams to GCS ----
function GcsStorageEngine() {}

GcsStorageEngine.prototype._handleFile = function (req, file, cb) {
  // Namespaced by user so objects are easy to trace/clean up
  const userId = req.user?.id || 'anon';
  const safeName = (file.originalname || 'video').replace(/[^\w.\-]/g, '_');
  const destination = `staging/${userId}/${randomUUID()}-${safeName}`;

  let uploaded = 0;
  const writeStream = storageService.createWriteStream(destination, file.mimetype);

  file.stream.on('data', (chunk) => {
    uploaded += chunk.length;
    if (uploaded > MAX_VIDEO_BYTES) {
      // Abort oversized uploads without buffering the rest
      file.stream.unpipe(writeStream);
      writeStream.destroy();
      const err = new Error('Video exceeds 2 GB limit');
      err.code = 'LIMIT_FILE_SIZE';
      cb(err);
    }
  });

  file.stream.on('error', cb);
  writeStream.on('error', cb);
  writeStream.on('finish', () => {
    cb(null, {
      gcsPath: destination,
      bucket: storageService.bucketName(),
      size: uploaded,
      mimetype: file.mimetype,
    });
  });

  file.stream.pipe(writeStream);
};

GcsStorageEngine.prototype._removeFile = function (req, file, cb) {
  storageService.deleteFile(file.gcsPath).then(() => cb(), cb);
};

// ---- Pick engine based on config ----
const videoStorage = storageService.isConfigured()
  ? new GcsStorageEngine()
  : multer.memoryStorage();

if (!storageService.isConfigured()) {
  console.warn('[upload] GCS not configured — videos buffered in RAM (dev only)');
}

const uploadVideoFile = multer({
  storage: videoStorage,
  limits: { fileSize: MAX_VIDEO_BYTES },
}).single('video');

module.exports = { uploadVideoFile, MAX_VIDEO_BYTES };
