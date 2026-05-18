/**
 * Maps axios/auth failures to user-visible messages.
 */
export function formatAuthRequestError(error, fallbackMessage) {
  if (!error) return fallbackMessage;

  const serverMsg = error.response?.data?.message;
  if (typeof serverMsg === 'string' && serverMsg.trim()) return serverMsg;
  if (Array.isArray(error.response?.data?.errors) && error.response.data.errors[0]?.msg) {
    return error.response.data.errors[0].msg;
  }

  const status = error.response?.status;
  const code = error.code;

  if (code === 'ERR_NETWORK' || error.message === 'Network Error') {
    return 'Cannot reach the API. Check the backend is running and REACT_APP_API_URL is set in frontend/.env.';
  }

  if (code === 'ECONNABORTED' || /timeout/i.test(error.message || '')) {
    return 'Request timed out.';
  }

  if (status === 403) return 'Access forbidden.';
  if (status === 404) return 'API not found. Check REACT_APP_API_URL in frontend/.env.';
  if (status === 502 || status === 503 || status === 504) {
    return `Server unavailable (HTTP ${status}).`;
  }
  if (status >= 500) return `Server error (HTTP ${status}).`;

  if (error.message?.includes('API URL is not configured')) {
    return 'Set REACT_APP_API_URL in frontend/.env and restart or rebuild.';
  }

  return (error.message || fallbackMessage) + (status ? ` (HTTP ${status})` : '');
}
