function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

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

async function paginatedFind(Model, {
  filter = {},
  search = '',
  searchFields = [],
  select,
  populate,
  sort = { createdAt: -1 },
  page = 1,
  limit = 20,
}) {
  const query = { ...filter };
  const term = String(search || '').trim();
  if (term && searchFields.length) {
    const rx = new RegExp(escapeRegex(term), 'i');
    const searchClause = { $or: searchFields.map((field) => ({ [field]: rx })) };
    query.$and = [...(Array.isArray(query.$and) ? query.$and : []), searchClause];
  }

  let finder = Model.find(query)
    .sort(sort)
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();
  if (select) finder = finder.select(select);
  if (populate) {
    const pops = Array.isArray(populate) ? populate : [populate];
    for (const pop of pops) {
      finder = finder.populate(pop);
    }
  }

  const [items, total] = await Promise.all([
    finder,
    Model.countDocuments(query),
  ]);
  return paginatedResponse({ items, page, limit, total });
}

module.exports = {
  escapeRegex,
  parsePagination,
  paginatedResponse,
  isPaginatedRequest,
  paginatedFind,
};
