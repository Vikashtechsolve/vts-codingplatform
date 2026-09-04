import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FiCheck, FiLoader, FiSearch } from 'react-icons/fi';

const PAGE_SIZE = 20;

function useDebouncedValue(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export function parseCatalogPage(data) {
  if (Array.isArray(data)) {
    return { items: data, total: data.length, hasMore: false };
  }
  const items = data?.items || data?.questions || [];
  return {
    items,
    total: Number(data?.total) || items.length,
    hasMore: !!data?.hasMore,
  };
}

const CourseBankPicker = ({
  fetchPage,
  getTitle,
  getMeta,
  selectedIds = [],
  onToggle,
  excludeIds = [],
  searchPlaceholder = 'Search…',
  emptyLabel = 'No matching items',
  reloadKey = '',
}) => {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const requestIdRef = useRef(0);

  const load = useCallback(
    async (nextPage, replace) => {
      const requestId = ++requestIdRef.current;
      if (replace) setLoading(true);
      else setLoadingMore(true);
      try {
        const data = await fetchPage({
          page: nextPage,
          search: debouncedSearch,
          limit: PAGE_SIZE,
        });
        if (requestId !== requestIdRef.current) return;
        const nextItems = data.items || [];
        setItems((prev) => (replace ? nextItems : [...prev, ...nextItems]));
        setHasMore(!!data.hasMore);
        setTotal(Number(data.total) || nextItems.length);
        setPage(nextPage);
      } catch {
        if (requestId !== requestIdRef.current) return;
        if (replace) {
          setItems([]);
          setHasMore(false);
          setTotal(0);
        }
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [fetchPage, debouncedSearch]
  );

  useEffect(() => {
    load(1, true);
  }, [load, reloadKey]);

  const exclude = new Set((excludeIds || []).map(String));
  const selected = new Set((selectedIds || []).map(String));
  const visible = items.filter((item) => !exclude.has(String(item._id)));

  return (
    <div className="sa-picker">
      <div className="sa-picker-toolbar">
        <label className="sa-picker-search">
          <FiSearch size={15} aria-hidden />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={searchPlaceholder}
          />
        </label>
        <span className="sa-picker-count">{total.toLocaleString()} found</span>
      </div>

      <div className="sa-picker-list" role="listbox">
        {loading ? (
          <div className="sa-quiz-manager-loading">
            <FiLoader className="sa-spin" size={18} />
            Loading…
          </div>
        ) : !visible.length ? (
          <p className="sa-quiz-empty">{emptyLabel}</p>
        ) : (
          visible.map((item) => {
            const id = String(item._id);
            const isSelected = selected.has(id);
            return (
              <button
                key={id}
                type="button"
                className={`sa-picker-row ${isSelected ? 'is-picked' : ''}`}
                onClick={() => onToggle(item)}
              >
                <span className={`sa-picker-check ${isSelected ? 'is-on' : ''}`} aria-hidden>
                  {isSelected ? <FiCheck size={12} /> : null}
                </span>
                <span className="sa-picker-copy">
                  <strong>{getTitle(item)}</strong>
                  {getMeta ? <em>{getMeta(item)}</em> : null}
                </span>
              </button>
            );
          })
        )}
      </div>

      {hasMore && !loading ? (
        <button
          type="button"
          className="vh-btn vh-btn--secondary vh-btn--sm sa-picker-more"
          onClick={() => load(page + 1, false)}
          disabled={loadingMore}
        >
          {loadingMore ? 'Loading…' : 'Load more'}
        </button>
      ) : null}
    </div>
  );
};

export default CourseBankPicker;
