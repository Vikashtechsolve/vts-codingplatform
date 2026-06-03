const { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
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

module.exports = {
  uploadToR2,
  deleteFromR2,
  downloadFromR2,
  getKeyFromUrl,
};
