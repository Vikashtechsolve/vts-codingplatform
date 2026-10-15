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
  extraFilter = {},
}) {
  const { page, limit, skip, search } = parsePagination(query, {
    defaultLimit: 40,
    maxLimit: 100,
  });

  const baseFilter =
    source === 'practice'
      ? { isGlobal: true, practiceEnabled: true }
      : source === 'global'
      ? { isGlobal: true }
      : source === 'all'
        ? {
            $or: [
              { isGlobal: true },
              { vendorId, ...VENDOR_SCOPE },
            ],
          }
        : { vendorId, ...VENDOR_SCOPE };

  const searchFilter = buildSearchFilter(search, searchFields);
  const clauses = [baseFilter];
  if (extraFilter && Object.keys(extraFilter).length) clauses.push(extraFilter);
  if (searchFilter) clauses.push(searchFilter);
  const filter = clauses.length === 1 ? clauses[0] : { $and: clauses };

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
    Model.countDocuments({ vendorId, ...VENDOR_SCOPE }),
    Model.countDocuments({ isGlobal: true }),
  ]);

  const mapped = items.map((row) => ({
    ...row,
    source: row.practiceEnabled ? 'practice' : row.isGlobal ? 'global' : 'vendor',
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
