import axiosInstance from './axios';

function isRetryableExecutionError(err) {
  const status = err.response?.status;
  return status === 429 || status === 503;
}

/**
 * POST to code-execution with automatic retry on transient queue pressure (429/503).
 */
export async function postCodeExecution(url, body, axiosConfig = {}, options = {}) {
  const { maxRetries = 4, onRetry } = options;
  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      return await axiosInstance.post(url, body, axiosConfig);
    } catch (err) {
      lastError = err;
      if (!isRetryableExecutionError(err) || attempt >= maxRetries) {
        throw err;
      }

      const retryAfterHeader = err.response?.headers?.['retry-after'];
      const retryAfterSec = parseInt(retryAfterHeader, 10);
      const delayMs = Number.isFinite(retryAfterSec)
        ? retryAfterSec * 1000
        : Math.min(20000, 1500 * 2 ** attempt);

      onRetry?.(attempt + 1, delayMs, err);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw lastError;
}

export function formatCodeExecutionError(error, fallback = 'Error executing code') {
  if (error?.code === 'ECONNABORTED') {
    return 'Request timed out. The run queue may be busy — please try again in a moment.';
  }
  return (
    error?.response?.data?.error ||
    error?.response?.data?.message ||
    error?.message ||
    fallback
  );
}
