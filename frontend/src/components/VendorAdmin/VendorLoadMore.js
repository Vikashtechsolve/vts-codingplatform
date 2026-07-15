import React, { useEffect, useRef } from 'react';
import './VendorLoadMore.css';

/**
 * Infinite scroll sentinel — auto-loads when scrolled near the bottom.
 * Used across paginated vendor lists (students, tests, questions, etc.).
 */
const VendorLoadMore = ({
  hasMore,
  loading,
  onLoadMore,
  loadedCount = 0,
  total = 0,
  rootMargin = '320px',
}) => {
  const sentinelRef = useRef(null);
  const loadingRef = useRef(loading);
  const hasMoreRef = useRef(hasMore);
  const onLoadMoreRef = useRef(onLoadMore);

  loadingRef.current = loading;
  hasMoreRef.current = hasMore;
  onLoadMoreRef.current = onLoadMore;

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !hasMoreRef.current || loadingRef.current) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting) return;
        if (loadingRef.current || !hasMoreRef.current) return;
        onLoadMoreRef.current?.();
      },
      { root: null, rootMargin, threshold: 0.01 }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, loadedCount, rootMargin, loading]);

  if (!hasMore && !loading) {
    if (total > 0 && loadedCount > 0) {
      return (
        <div className="vendor-load-more vendor-load-more--done">
          <span className="vendor-load-more-count">Showing all {total} items</span>
        </div>
      );
    }
    return null;
  }

  return (
    <div className="vendor-load-more" ref={sentinelRef} aria-live="polite">
      {total > 0 && (
        <span className="vendor-load-more-count">
          Showing {Math.min(loadedCount, total)} of {total}
        </span>
      )}
      {loading && (
        <div className="vendor-load-more-status">
          <span className="vendor-load-more-spinner" aria-hidden />
          <span>Loading more…</span>
        </div>
      )}
    </div>
  );
};

export default VendorLoadMore;
