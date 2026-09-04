/**
 * Tokenized HLS delivery — no session JWT required.
 * Access is gated by short-lived course media JWT in ?token=
 *
 * Segments are streamed through this API (not 302'd to R2). A cross-origin
 * redirect makes the browser send Origin: null, R2 has no ACAO, and HLS.js
 * buffers forever even though the .ts GET returns 200.
 */
const express = require('express');
const router = express.Router();
const { verifyMediaToken } = require('../utils/courseMediaToken');
const { streamFromR2, downloadFromR2 } = require('../utils/r2Storage');
const { rewritePlaylistToProxy } = require('../utils/courseHlsPlaylist');
const CourseLecture = require('../models/CourseLecture');

const MIME_BY_EXT = {
  '.m3u8': 'application/vnd.apple.mpegurl',
  '.ts': 'video/mp2t',
  '.m4s': 'video/iso.segment',
  '.mp4': 'video/mp4',
  '.key': 'application/octet-stream',
};

function authorizeMedia(req) {
  const token = req.query.token || req.headers['x-course-media-token'];
  if (!token) {
    const err = new Error('Media token required');
    err.status = 401;
    throw err;
  }
  const decoded = verifyMediaToken(token);
  if (
    String(decoded.cid) !== String(req.params.courseId) ||
    String(decoded.lid) !== String(req.params.lectureId)
  ) {
    const err = new Error('Media token mismatch');
    err.status = 403;
    throw err;
  }
  return decoded;
}

function mediaApiOrigin(req) {
  if (process.env.PUBLIC_API_ORIGIN) {
    return process.env.PUBLIC_API_ORIGIN.replace(/\/$/, '');
  }
  const proto = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  const host = req.headers['x-forwarded-host'] || req.get('host');
  return `${proto}://${host}`;
}

function playlistApiBase(req, courseId, lectureId) {
  return `${mediaApiOrigin(req)}/api/courses-media/${courseId}/lectures/${lectureId}/file`;
}

async function sendRewrittenPlaylist(req, res, key) {
  const raw = (await downloadFromR2(key)).toString('utf8');
  const body = rewritePlaylistToProxy(raw, {
    apiBase: playlistApiBase(req, req.params.courseId, req.params.lectureId),
    token: req.query.token,
  });
  res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
  res.setHeader('Cache-Control', 'private, no-store');
  res.send(body);
}

router.get('/:courseId/lectures/:lectureId/master.m3u8', async (req, res) => {
  try {
    authorizeMedia(req);
    const lecture = await CourseLecture.findById(req.params.lectureId);
    if (!lecture?.video?.hlsPrefix) {
      return res.status(404).json({ message: 'HLS not found' });
    }
    const masterKey = `${lecture.video.hlsPrefix}/master.m3u8`;
    await sendRewrittenPlaylist(req, res, masterKey);
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message || 'Server error' });
  }
});

router.get('/:courseId/lectures/:lectureId/file', async (req, res) => {
  try {
    authorizeMedia(req);
    const name = String(req.query.name || '').replace(/[^a-zA-Z0-9._-]/g, '');
    if (!name) return res.status(400).json({ message: 'Invalid file name' });

    const lecture = await CourseLecture.findById(req.params.lectureId);
    if (!lecture?.video?.hlsPrefix) {
      return res.status(404).json({ message: 'HLS not found' });
    }

    const key = `${lecture.video.hlsPrefix}/${name}`;
    const ext = name.includes('.') ? `.${name.split('.').pop().toLowerCase()}` : '';

    if (ext === '.m3u8') {
      return sendRewrittenPlaylist(req, res, key);
    }

    await streamFromR2(key, res, {
      contentType: MIME_BY_EXT[ext] || 'application/octet-stream',
      cacheControl: 'private, max-age=120',
    });
  } catch (error) {
    if (res.headersSent) return;
    const status = error.$metadata?.httpStatusCode || error.status || 500;
    res.status(status).json({ message: error.message || 'Server error' });
  }
});

module.exports = router;
