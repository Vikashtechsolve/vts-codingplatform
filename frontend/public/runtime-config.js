/**
 * Optional: override API URL without rebuilding.
 *
 * Absolute backend (Railway etc.): https://your-app.up.railway.app
 * Same-origin proxy (recommended if some networks block the API host): set to "/api" and add
 * host rewrites so /api/* and /uploads/* forward to your backend (see apiBase.js comment).
 */
window.__RUNTIME_CONFIG__ = window.__RUNTIME_CONFIG__ || {};
// window.__RUNTIME_CONFIG__.REACT_APP_API_URL = 'https://your-app.up.railway.app';
// window.__RUNTIME_CONFIG__.REACT_APP_API_URL = '/api';
