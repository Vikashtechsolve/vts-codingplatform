function parsePagination(query = {}, { defaultLimit = 50, maxLimit = 100 } = {}) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const rawLimit = parseInt(query.limit, 10);
  const limit = Math.min(
    maxLimit,
    Math.max(1, Number.isFinite(rawLimit) ? rawLimit : defaultLimit)
  );
  const skip = (page - 1) * limit;
  const search = String(query.search || query.q || '').trim();
  return { page, limit, skip, search };
}

function paginatedResponse({ items, page, limit, total, extra = {} }) {
  const safeTotal = Math.max(0, Number(total) || 0);
  const totalPages = safeTotal ? Math.ceil(safeTotal / limit) : 0;
  return {
    items: items || [],
    page,
    limit,
    total: safeTotal,
    totalPages,
    hasMore: page * limit < safeTotal,
    ...extra,
  };
}

function isPaginatedRequest(query = {}) {
  return query.page != null || query.limit != null || query.search != null || query.q != null;
}

module.exports = {
  parsePagination,
  paginatedResponse,
  isPaginatedRequest,
};
