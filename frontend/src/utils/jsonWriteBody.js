const JSON_WRITE_METHODS = new Set(['post', 'put', 'patch']);

/**
 * Express json() is strict by default: a body of `null` is rejected as invalid JSON.
 * Axios JSON.stringify(null) sends exactly that, which 500s test/interview start.
 */
export function normalizeJsonWriteData(data, method) {
  const m = String(method || 'get').toLowerCase();
  if (!JSON_WRITE_METHODS.has(m)) return data;
  if (typeof FormData !== 'undefined' && data instanceof FormData) return data;
  if (data == null) return {};
  if (typeof data !== 'object') return {};
  return data;
}
