/**
 * API base URL from REACT_APP_API_URL in frontend/.env
 */

function sanitizeEnvUrl(raw) {
  if (raw == null) return '';
  return String(raw)
    .replace(/^\uFEFF/, '')
    .trim()
    .replace(/\r/g, '')
    .replace(/\s+/g, '');
}

function normalizeApiBaseUrl(url) {
  let u = sanitizeEnvUrl(url).replace(/\/+$/, '');
  if (!u.startsWith('http://') && !u.startsWith('https://')) {
    return '';
  }
  if (!u.endsWith('/api')) {
    u += '/api';
  }
  return u;
}

/** Axios base URL (includes /api). */
export function getAxiosBaseURL() {
  return normalizeApiBaseUrl(process.env.REACT_APP_API_URL);
}

/** Origin for /uploads paths (strip trailing /api). */
export function getPublicApiOrigin() {
  const base = getAxiosBaseURL();
  if (!base) return '';
  return base.replace(/\/api\/?$/, '');
}

/** Warn when HTTPS site uses HTTP API (mixed content). */
export function getMixedContentApiWarning() {
  if (typeof window === 'undefined') return null;
  const base = getAxiosBaseURL();
  if (!base || window.location.protocol !== 'https:') return null;
  if (base.startsWith('http://')) {
    return 'This site uses HTTPS but the configured API URL uses HTTP. Use an HTTPS API URL in frontend/.env.';
  }
  return null;
}
