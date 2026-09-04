const {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutBucketCorsCommand,
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const path = require('path');

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME;
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL;

let s3Client = null;

const getClient = () => {
  if (!s3Client) {
    if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME) {
      throw new Error('Cloudflare R2 environment variables are not configured. Required: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME');
    }
    s3Client = new S3Client({
      region: 'auto',
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
      },
      // Extra checksum query params break browser HLS GETs / CORS.
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    });
  }
  return s3Client;
};

const MIME_TYPES = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.gif': 'image/gif', '.webp': 'image/webp',
  '.mp3': 'audio/mpeg', '.mp4': 'video/mp4', '.wav': 'audio/wav', '.ogg': 'audio/ogg',
  '.webm': 'audio/webm', '.m4a': 'audio/mp4', '.flac': 'audio/flac',
  '.json': 'application/json', '.csv': 'text/csv',
  '.pdf': 'application/pdf',
  '.m3u8': 'application/vnd.apple.mpegurl',
  '.ts': 'video/mp2t',
};

/**
 * Upload a file buffer to R2.
 * @param {Buffer} buffer - File content
 * @param {string} key - Object key (path in bucket), e.g. "logos/vendor-123.png"
 * @param {string} [originalname] - Original filename for mime detection
 * @returns {Promise<string>} Public URL of the uploaded file
 */
const uploadToR2 = async (buffer, key, originalname) => {
  const client = getClient();
  const ext = path.extname(originalname || key).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  await client.send(new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  }));

  if (R2_PUBLIC_URL) {
    return `${R2_PUBLIC_URL.replace(/\/$/, '')}/${key}`;
  }
  return `https://${R2_BUCKET_NAME}.${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${key}`;
};

/**
 * Delete a file from R2.
 * @param {string} key - Object key to delete
 */
const deleteFromR2 = async (key) => {
  try {
    const client = getClient();
    await client.send(new DeleteObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
    }));
  } catch (err) {
    console.warn(`R2 delete warning for key "${key}":`, err.message);
  }
};

/**
 * Download a file from R2 as a Buffer.
 * @param {string} key - Object key
 * @returns {Promise<Buffer>}
 */
const downloadFromR2 = async (key) => {
  const client = getClient();
  const response = await client.send(new GetObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
  }));
  const chunks = [];
  for await (const chunk of response.Body) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
};

/**
 * Extract the R2 object key from a full URL or path.
 * Handles both full URLs (https://...) and legacy paths (/uploads/...).
 */
const getKeyFromUrl = (url) => {
  if (!url) return null;
  if (R2_PUBLIC_URL && url.startsWith(R2_PUBLIC_URL)) {
    return url.slice(R2_PUBLIC_URL.replace(/\/$/, '').length + 1);
  }
  if (url.startsWith('/uploads/')) {
    return url.slice(1); // "uploads/logos/vendor-123.png"
  }
  if (url.startsWith('uploads/')) {
    return url;
  }
  try {
    const parsed = new URL(url);
    return parsed.pathname.slice(1);
  } catch {
    return url;
  }
};

/**
 * Short-lived signed PUT for direct browser → R2 upload (private objects).
 */
const getSignedUploadUrl = async (key, contentType, expiresIn = 900) => {
  const client = getClient();
  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
    ContentType: contentType || 'application/octet-stream',
  });
  return getSignedUrl(client, command, { expiresIn });
};

/**
 * Short-lived signed GET for private objects (video segments, PDFs).
 */
const getSignedDownloadUrl = async (key, expiresIn = 300) => {
  const client = getClient();
  const command = new GetObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
  });
  return getSignedUrl(client, command, { expiresIn });
};

/**
 * Allow browser HLS.js (XHR/MSE) to read objects from this private bucket.
 * Signed URLs still gate access; CORS only unlocks the response for JS.
 */
const ensureR2Cors = async () => {
  const raw = process.env.R2_CORS_ORIGINS || process.env.ALLOWED_ORIGINS || process.env.CORS_ORIGIN || '*';
  const origins = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const client = getClient();
  await client.send(
    new PutBucketCorsCommand({
      Bucket: R2_BUCKET_NAME,
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedOrigins: origins.length ? origins : ['*'],
            AllowedMethods: ['GET', 'HEAD'],
            AllowedHeaders: ['*'],
            ExposeHeaders: [
              'ETag',
              'Content-Length',
              'Content-Type',
              'Content-Range',
              'Accept-Ranges',
            ],
            MaxAgeSeconds: 3600,
          },
        ],
      },
    })
  );
};

/**
 * Pipe an R2 object to an Express response (no 302). Needed so HLS.js
 * does not follow a cross-origin redirect (Origin becomes null → CORS fail).
 */
const streamFromR2 = async (key, res, { contentType, cacheControl } = {}) => {
  const client = getClient();
  const response = await client.send(
    new GetObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
    })
  );
  res.setHeader('Content-Type', contentType || response.ContentType || 'application/octet-stream');
  if (response.ContentLength != null) {
    res.setHeader('Content-Length', String(response.ContentLength));
  }
  if (response.ETag) res.setHeader('ETag', response.ETag);
  res.setHeader('Cache-Control', cacheControl || 'private, max-age=60');
  res.setHeader('Accept-Ranges', 'bytes');

  const body = response.Body;
  if (!body || typeof body.pipe !== 'function') {
    const chunks = [];
    for await (const chunk of body) chunks.push(chunk);
    res.end(Buffer.concat(chunks));
    return;
  }

  body.on('error', (err) => {
    if (!res.headersSent) {
      res.status(500).json({ message: err.message || 'R2 stream error' });
    } else {
      res.destroy(err);
    }
  });
  body.pipe(res);
};

/**
 * Delete all objects under a prefix (best-effort, paginated).
 */
const deletePrefixFromR2 = async (prefix) => {
  if (!prefix) return;
  const client = getClient();
  let continuationToken;
  do {
    const listed = await client.send(
      new ListObjectsV2Command({
        Bucket: R2_BUCKET_NAME,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      })
    );
    const keys = (listed.Contents || []).map((o) => o.Key).filter(Boolean);
    await Promise.all(keys.map((key) => deleteFromR2(key)));
    continuationToken = listed.IsTruncated ? listed.NextContinuationToken : undefined;
  } while (continuationToken);
};

module.exports = {
  uploadToR2,
  deleteFromR2,
  downloadFromR2,
  getKeyFromUrl,
  getSignedUploadUrl,
  getSignedDownloadUrl,
  deletePrefixFromR2,
  ensureR2Cors,
  streamFromR2,
  getBucketName: () => R2_BUCKET_NAME,
  getR2Client: getClient,
};

