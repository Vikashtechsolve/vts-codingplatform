const jwt = require('jsonwebtoken');

const MEDIA_SECRET =
  process.env.COURSE_MEDIA_JWT_SECRET ||
  process.env.JWT_SECRET ||
  'course-media-dev-secret';

const DEFAULT_TTL_SEC = parseInt(process.env.COURSE_MEDIA_TOKEN_TTL_SEC || '300', 10);

function signMediaToken(payload, ttlSec = DEFAULT_TTL_SEC) {
  return jwt.sign(
    {
      typ: 'course_media',
      sid: String(payload.studentId),
      cid: String(payload.courseId),
      lid: String(payload.lectureId),
    },
    MEDIA_SECRET,
    { expiresIn: ttlSec }
  );
}

function verifyMediaToken(token) {
  const decoded = jwt.verify(token, MEDIA_SECRET);
  if (decoded.typ !== 'course_media') {
    throw new Error('Invalid media token type');
  }
  return decoded;
}

module.exports = {
  signMediaToken,
  verifyMediaToken,
  DEFAULT_TTL_SEC,
};
