/** Normalize list API responses — supports legacy arrays and paginated objects. */
export function normalizePaginatedResponse(data) {
  if (Array.isArray(data)) {
    return {
      items: data,
      page: 1,
      limit: data.length,
      total: data.length,
      totalPages: 1,
      hasMore: false,
    };
  }

  const items = Array.isArray(data?.items) ? data.items : [];
  const page = data?.page || 1;
  const limit = data?.limit || items.length;
  const total = typeof data?.total === 'number' ? data.total : items.length;

  return {
    items,
    page,
    limit,
    total,
    totalPages: data?.totalPages ?? (limit ? Math.ceil(total / limit) : 1),
    hasMore: Boolean(data?.hasMore),
    vendorTotal: data?.vendorTotal,
    globalTotal: data?.globalTotal,
    source: data?.source,
    summary: data?.summary,
  };
}

export function mergePaginatedPages(prevItems, nextItems) {
  const seen = new Set(prevItems.map((item) => String(item._id || item.id)));
  const merged = [...prevItems];
  nextItems.forEach((item) => {
    const key = String(item._id || item.id);
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(item);
    }
  });
  return merged;
}
