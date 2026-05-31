import { useEffect, useState } from 'react';
import axiosInstance from '../utils/axios';

/** Shared vendor tag registry for filters and autocomplete. */
export default function useQuestionTagRegistry(limit = 200) {
  const [registryTags, setRegistryTags] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await axiosInstance.get('/question-tags', {
          params: { limit },
        });
        if (!cancelled) {
          setRegistryTags(Array.isArray(data) ? data : []);
        }
      } catch {
        if (!cancelled) setRegistryTags([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [limit]);

  return { registryTags, loading };
}
