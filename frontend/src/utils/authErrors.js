/**
 * Maps axios/auth failures to user-visible messages (network vs validation vs server vs CORS).
 * Always include a hint to /diagnostics so users can self-debug from a problem device.
 */
const DIAG_HINT = ' Visit /diagnostics on this site for a detailed connectivity check.';

export function formatAuthRequestError(error, fallbackMessage) {
  if (!error) return fallbackMessage;

  const serverMsg = error.response?.data?.message;
  if (typeof serverMsg === 'string' && serverMsg.trim()) return serverMsg;
  if (Array.isArray(error.response?.data?.errors) && error.response.data.errors[0]?.msg) {
    return error.response.data.errors[0].msg;
  }

  const status = error.response?.status;
  const code = error.code;
  const baseURL = error.config?.baseURL || '';

  if (code === 'ERR_NETWORK' || error.message === 'Network Error') {
    return (
      `Cannot reach the API server (${baseURL || 'no base URL'}). Likely causes: ` +
      'API server is down/sleeping, this network blocks the API host (some ISPs/VPNs block *.railway.app), ' +
      'CORS preflight rejected, or HTTPS site calling HTTP API. ' +
      'For ISP blocks, use REACT_APP_API_URL=/api with vercel.json rewrites or a custom domain on the backend.' +
      DIAG_HINT
    );
  }

  if (code === 'ECONNABORTED' || /timeout/i.test(error.message || '')) {
    return 'Request timed out. The server may be cold-starting or your network is slow.' + DIAG_HINT;
  }

  if (status === 403) return 'Access forbidden by the server (CORS or permissions).' + DIAG_HINT;
  if (status === 404) return `Endpoint not found at ${baseURL}. The API URL is wrong, or the proxy is missing.` + DIAG_HINT;
  if (status === 502 || status === 503 || status === 504) {
    return `API gateway error (HTTP ${status}). The backend is unhealthy or restarting.` + DIAG_HINT;
  }
  if (status >= 500) return `Server error (HTTP ${status}). Check the backend logs.` + DIAG_HINT;

  if (error.message?.includes('API URL is not configured')) return error.message + DIAG_HINT;

  return (error.message || fallbackMessage) + (status ? ` (HTTP ${status})` : '');
}

