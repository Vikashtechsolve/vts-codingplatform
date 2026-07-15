import { useRef, useState, useCallback } from 'react';

/** Split list fetch UX: full-page load once, inline refresh on search/filter. */
export function useListFetchLoading({ startInLoading = true } = {}) {
  const hasLoadedRef = useRef(false);
  const [initialLoading, setInitialLoading] = useState(startInLoading);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const beginFetch = useCallback((append = false) => {
    if (append) {
      setLoadingMore(true);
      return;
    }
    if (!hasLoadedRef.current) {
      setInitialLoading(true);
    } else {
      setRefreshing(true);
    }
  }, []);

  const endFetch = useCallback(() => {
    hasLoadedRef.current = true;
    setInitialLoading(false);
    setRefreshing(false);
    setLoadingMore(false);
  }, []);

  const resetLoaded = useCallback(() => {
    hasLoadedRef.current = false;
    setInitialLoading(true);
    setRefreshing(false);
    setLoadingMore(false);
  }, []);

  return {
    initialLoading,
    refreshing,
    loadingMore,
    beginFetch,
    endFetch,
    resetLoaded,
    hasLoaded: () => hasLoadedRef.current,
  };
}
