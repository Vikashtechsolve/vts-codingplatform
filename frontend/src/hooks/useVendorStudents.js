import { useState, useEffect, useCallback, useRef } from 'react';
import axiosInstance from '../utils/axios';
import { normalizePaginatedResponse, mergePaginatedPages } from '../utils/paginatedApi';

/** Paginated vendor student list with debounced server search. */
export function useVendorStudents({ enabled = true } = {}) {
  const hasLoadedRef = useRef(false);
  const [students, setStudents] = useState([]);
  const [initialLoading, setInitialLoading] = useState(enabled);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchStudents = useCallback(
    async ({ pageNum = 1, append = false } = {}) => {
      if (!enabled) return;
      try {
        if (append) {
          setLoadingMore(true);
        } else if (!hasLoadedRef.current) {
          setInitialLoading(true);
        } else {
          setRefreshing(true);
        }

        const params = { page: pageNum, limit: 50 };
        if (debouncedSearch.trim()) params.search = debouncedSearch.trim();

        const { data } = await axiosInstance.get('/vendor-admin/students', { params });
        const parsed = normalizePaginatedResponse(data);
        setStudents((prev) =>
          append ? mergePaginatedPages(prev, parsed.items) : parsed.items
        );
        setPage(parsed.page);
        setHasMore(parsed.hasMore);
        setTotal(parsed.total);
        hasLoadedRef.current = true;
      } catch (err) {
        console.error('Error fetching students:', err);
      } finally {
        setInitialLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      }
    },
    [debouncedSearch, enabled]
  );

  useEffect(() => {
    fetchStudents({ pageNum: 1, append: false });
  }, [fetchStudents]);

  const loadMore = useCallback(() => {
    if (loadingMore || refreshing || !hasMore) return;
    fetchStudents({ pageNum: page + 1, append: true });
  }, [fetchStudents, page, hasMore, loadingMore, refreshing]);

  const refresh = useCallback(
    () => fetchStudents({ pageNum: 1, append: false }),
    [fetchStudents]
  );

  return {
    students,
    loading: initialLoading,
    initialLoading,
    refreshing,
    loadingMore,
    hasMore,
    total,
    page,
    search,
    setSearch,
    loadMore,
    refresh,
  };
}
