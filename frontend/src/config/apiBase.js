/**
 * Single source of truth for API base URL.
 *
 * Priority: runtime-config.js → REACT_APP_API_URL (inlined at build time) → dev localhost.
 *
 * Same-origin mode (fixes many “works on my laptop, not others” / Network Error cases):
 *   Set REACT_APP_API_URL=/api
 *   On Vercel: set BACKEND_ORIGIN=https://your-backend.up.railway.app (see frontend/middleware.js).
 *   Browsers only call your frontend host for /api and /uploads (restricted networks often block Railway directly).
 *
 * Absolute URL mode:
 *   Use https://... for the API when the site is https:// — http:// APIs are blocked as mixed content for everyone on strict browsers.
 */
const DEV_FALLBACK = 'http://localhost:5000/api';

/** Strip BOM, CRLF-only junk, and outer whitespace (common copy/paste issues from hosting dashboards). */
export function sanitizeEnvUrl(raw) {
  if (raw == null) return '';
  return String(raw)
    .replace(/^\uFEFF/, '')
    .trim()
    .replace(/\r/g, '')
    .replace(/\s+/g, '');
}

function readRuntimeUrl() {
  if (typeof window === 'undefined') return '';
  const rt = window.__RUNTIME_CONFIG__ && window.__RUNTIME_CONFIG__.REACT_APP_API_URL;
  return sanitizeEnvUrl(rt);
}

function readEnvUrl() {
  return sanitizeEnvUrl(process.env.REACT_APP_API_URL);
}

/** Normalize absolute URL to end with /api (no trailing slash after api). */
export function normalizeApiBaseUrl(url) {
  let u = sanitizeEnvUrl(url).replace(/\/+$/, '');
  if (!u.startsWith('http://') && !u.startsWith('https://')) {
    return '';
  }
  if (!u.endsWith('/api')) {
    u += '/api';
  }
  return u;
}

/**
 * Same-origin API path → full URL using current window origin (requires host rewrites to backend).
 */
function resolveRelativeApiPath(pathInput) {
  if (typeof window === 'undefined') return '';
  let path = sanitizeEnvUrl(pathInput).replace(/\/+$/, '') || '/api';
  if (!path.startsWith('/')) {
    path = `/${path}`;
  }
  if (!path.endsWith('/api')) {
    path = `${path}/api`.replace(/\/+/g, '/');
  }
  return `${window.location.origin}${path}`;
}

/** Full axios base URL including /api segment. */
export function getAxiosBaseURL() {
  const picked = readRuntimeUrl() || readEnvUrl();
  if (!picked || picked === 'undefined') {
    if (process.env.NODE_ENV === 'development') {
      return DEV_FALLBACK;
    }
    // Production default: same-origin proxy (vercel.json / _redirects forward to backend).
    // Avoids ISP blocks on third-party API domains (e.g. Jio + railway.app).
    return resolveRelativeApiPath('/api');
  }

  if (picked.startsWith('/') && !picked.startsWith('//')) {
    return resolveRelativeApiPath(picked);
  }

  return normalizeApiBaseUrl(picked);
}

/** Origin for static files (/uploads/...) — same host when using relative /api proxy. */
export function getPublicApiOrigin() {
  const picked = readRuntimeUrl() || readEnvUrl();
  if (picked.startsWith('/') && !picked.startsWith('//') && typeof window !== 'undefined') {
    return window.location.origin;
  }
  const base = getAxiosBaseURL();
  if (!base) return '';
  return base.replace(/\/api\/?$/, '');
}

/** Non-null string when HTTPS page would block http:// API calls (mixed content). */
export function getMixedContentApiWarning() {
  if (typeof window === 'undefined') return null;
  const base = getAxiosBaseURL();
  if (!base) return null;
  if (window.location.protocol !== 'https:') return null;
  if (base.startsWith('http://')) {
    return (
      'This app is on HTTPS but the API is HTTP. Browsers will block those requests for many users. ' +
      'Use an https:// API URL, or set REACT_APP_API_URL=/api and proxy /api to your backend on the same host.'
    );
  }
  return null;
}
