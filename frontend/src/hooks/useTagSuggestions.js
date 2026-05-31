import { useCallback, useEffect, useRef, useState } from 'react';
import axiosInstance from '../utils/axios';
import { tagSlug } from '../utils/tagUtils';

let cachedPopularTags = null;
let cachePromise = null;

const loadPopularTags = async () => {
  if (cachedPopularTags) return cachedPopularTags;
  if (cachePromise) return cachePromise;

  cachePromise = axiosInstance
    .get('/question-tags', { params: { limit: 100 } })
    .then(({ data }) => {
      cachedPopularTags = Array.isArray(data) ? data : [];
      return cachedPopularTags;
    })
    .catch(() => {
      cachedPopularTags = [];
      return cachedPopularTags;
    })
    .finally(() => {
      cachePromise = null;
    });

  return cachePromise;
};

/** Invalidate after creating a new tag so next open sees it. */
export const invalidateTagSuggestionCache = () => {
  cachedPopularTags = null;
};

export default function useTagSuggestions() {
  const [popularTags, setPopularTags] = useState(cachedPopularTags || []);
  const [remoteTags, setRemoteTags] = useState([]);
  const [loading, setLoading] = useState(false);
  const requestIdRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    loadPopularTags().then((tags) => {
      if (!cancelled) setPopularTags(tags);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const searchTags = useCallback(async (query) => {
    const trimmed = String(query || '').trim();
    const requestId = ++requestIdRef.current;

    if (!trimmed) {
      setRemoteTags([]);
      setLoading(false);
      return popularTags.length ? popularTags : loadPopularTags().then((tags) => {
        if (requestId === requestIdRef.current) setPopularTags(tags);
        return tags;
      });
    }

    setLoading(true);
    try {
      const { data } = await axiosInstance.get('/question-tags', {
        params: { q: trimmed, limit: 20 },
      });
      if (requestId !== requestIdRef.current) return;
      const results = Array.isArray(data) ? data : [];
      setRemoteTags(results);
      return results;
    } catch {
      if (requestId === requestIdRef.current) setRemoteTags([]);
      return [];
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [popularTags]);

  const filterLocal = useCallback(
    (query, excludeSlugs = new Set()) => {
      const trimmed = String(query || '').trim().toLowerCase();
      const pool = popularTags.length ? popularTags : remoteTags;
      const filtered = pool.filter((tag) => {
        if (excludeSlugs.has(tag.slug)) return false;
        if (!trimmed) return true;
        return (
          tag.label.toLowerCase().includes(trimmed) ||
          tag.slug.includes(trimmed)
        );
      });
      return filtered.slice(0, 12);
    },
    [popularTags, remoteTags]
  );

  const registerTag = useCallback(async (label) => {
    const trimmed = String(label || '').trim().replace(/\s+/g, ' ');
    if (!trimmed) return trimmed;

    try {
      const { data } = await axiosInstance.post('/question-tags', { tag: trimmed });
      invalidateTagSuggestionCache();
      const fresh = await loadPopularTags();
      setPopularTags(fresh);
      if (Array.isArray(data) && data[0]?.label) return data[0].label;
    } catch {
      /* use trimmed */
    }
    return trimmed;
  }, []);

  return {
    popularTags,
    remoteTags,
    loading,
    searchTags,
    filterLocal,
    registerTag,
    tagSlug,
  };
};
