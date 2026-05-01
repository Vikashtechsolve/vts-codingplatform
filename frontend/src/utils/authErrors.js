/**
 * Maps axios/auth failures to user-visible messages (network vs validation vs server).
 */
export function formatAuthRequestError(error, fallbackMessage) {
  if (!error) return fallbackMessage;
  const serverMsg = error.response?.data?.message;
  if (typeof serverMsg === 'string' && serverMsg.trim()) return serverMsg;
  if (Array.isArray(error.response?.data?.errors) && error.response.data.errors[0]?.msg) {
    return error.response.data.errors[0].msg;
  }

  if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
    return (
      'Cannot reach the API server. Try another network or VPN off, disable ad blockers for this site, ' +
      'and confirm your organization allows calls to the API domain. If the website address starts with https://, ' +
      'the API must use https:// as well (or use same-origin /api proxying).'
    );
  }

  if (error.response?.status === 403) {
    return 'Access forbidden. Check that you are using the correct site URL.';
  }

  if (error.message?.includes('API URL is not configured')) {
    return error.message;
  }

  return error.message || fallbackMessage;
}
