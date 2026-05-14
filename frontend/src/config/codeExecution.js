/**
 * Axios timeouts for code-run requests (server may wait up to ~10m for large batches).
 * Without this, the browser shows "pending" forever if the connection stalls.
 */
export const CODE_REQUEST_TIMEOUT_EXECUTE_MS = 150000;
export const CODE_REQUEST_TIMEOUT_BATCH_MS = 660000;
