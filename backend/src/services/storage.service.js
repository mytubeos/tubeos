// src/services/storage.service.js
// Google Cloud Storage (GCS) backed video staging.
//
// Why this exists:
//   Video uploads used to be held entirely in RAM (multer.memoryStorage()),
//   so a single 2 GB upload could OOM the server. Instead we STREAM the
//   incoming file straight to GCS (constant, small memory) and later STREAM
//   it from GCS to YouTube — the full file never lives in process memory.
//
// Falls back to a no-op (isConfigured() === false) when GCS is not set up,
// so local dev keeps working with memoryStorage (see upload.middleware.js).
//
// Auth: on Cloud Run / GCE, Application Default Credentials are picked up
// automatically — you only need GCS_BUCKET. Locally, point
// GOOGLE_APPLICATION_CREDENTIALS at a service-account key file.

const logger = require('../config/logger');

let Storage = null;
try {
  // Optional dependency — won't crash boot if missing
  ({ Storage } = require('@google-cloud/storage'));
} catch (err) {
  logger.warn('[storage] @google-cloud/storage not installed — GCS disabled');
}

let _client = null;
let _bucket = null;

const bucketName = () => process.env.GCS_BUCKET || null;

const isConfigured = () => !!(Storage && bucketName());

// Lazy singletons so we only build the client when actually configured
const getClient = () => {
  if (!isConfigured()) return null;
  if (!_client) {
    _client = new Storage(
      process.env.GCS_PROJECT_ID ? { projectId: process.env.GCS_PROJECT_ID } : {}
    );
  }
  return _client;
};

const getBucket = () => {
  if (!isConfigured()) return null;
  if (!_bucket) _bucket = getClient().bucket(bucketName());
  return _bucket;
};

// ==================== WRITE STREAM ====================
// Returns a GCS write stream you can pipe an incoming multipart stream into.
const createWriteStream = (destination, contentType) => {
  const file = getBucket().file(destination);
  return file.createWriteStream({
    resumable: true, // safe for large (multi-GB) uploads
    contentType: contentType || 'application/octet-stream',
    metadata: { cacheControl: 'private, max-age=0' },
  });
};

// ==================== READ STREAM ====================
// Returns a GCS read stream (used to pipe the file into the YouTube upload).
const createReadStream = (gcsPath) => {
  return getBucket().file(gcsPath).createReadStream();
};

// ==================== METADATA ====================
const getSize = async (gcsPath) => {
  const [meta] = await getBucket().file(gcsPath).getMetadata();
  return Number(meta.size);
};

// ==================== DELETE ====================
// Best-effort delete of a staged object (video already lives on YouTube).
const deleteFile = async (gcsPath) => {
  if (!isConfigured() || !gcsPath) return;
  try {
    await getBucket().file(gcsPath).delete({ ignoreNotFound: true });
  } catch (err) {
    logger.warn('[storage] delete failed', { error: err.message });
  }
};

module.exports = {
  isConfigured,
  bucketName,
  getBucket,
  createWriteStream,
  createReadStream,
  getSize,
  deleteFile,
};
