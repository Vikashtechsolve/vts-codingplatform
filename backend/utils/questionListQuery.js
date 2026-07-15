const { parsePagination, paginatedResponse } = require('./pagination');

const VENDOR_SCOPE = {
  $or: [{ isGlobal: false }, { isGlobal: { $exists: false } }],
};

function buildSearchFilter(search, fields) {
  if (!search) return null;
  const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(escaped, 'i');
  return {
    $or: fields.map((field) => ({ [field]: regex })),
  };
}

async function fetchPaginatedQuestions({
  Model,
  vendorId,
  source = 'vendor',
  query = {},
  listSelect,
  searchFields = ['title'],
  populateGlobal = null,
  populateAll = [],
}) {
  const { page, limit, skip, search } = parsePagination(query, {
    defaultLimit: 40,
    maxLimit: 100,
  });

  const baseFilter =
    source === 'global'
      ? { isGlobal: true }
      : { vendorId, ...VENDOR_SCOPE };

  const searchFilter = buildSearchFilter(search, searchFields);
  const filter = searchFilter ? { $and: [baseFilter, searchFilter] } : baseFilter;

  let q = Model.find(filter).select(listSelect).sort({ createdAt: -1 }).skip(skip).limit(limit);
  populateAll.forEach((spec) => {
    q = q.populate(spec.path, spec.select);
  });
  if (source === 'global' && populateGlobal) {
    q = q.populate(populateGlobal.path, populateGlobal.select);
  }

  const [items, total, vendorTotal, globalTotal] = await Promise.all([
    q.lean(),
    Model.countDocuments(filter),
    source === 'vendor'
      ? Model.countDocuments({ vendorId, ...VENDOR_SCOPE })
      : Promise.resolve(null),
    source === 'global'
      ? Model.countDocuments({ isGlobal: true })
      : Promise.resolve(null),
  ]);

  const mapped = items.map((row) => ({
    ...row,
    source: source === 'global' ? 'global' : 'vendor',
  }));

  return paginatedResponse({
    items: mapped,
    page,
    limit,
    total,
    extra: {
      source,
      vendorTotal: vendorTotal ?? undefined,
      globalTotal: globalTotal ?? undefined,
    },
  });
}

module.exports = {
  VENDOR_SCOPE,
  fetchPaginatedQuestions,
};
