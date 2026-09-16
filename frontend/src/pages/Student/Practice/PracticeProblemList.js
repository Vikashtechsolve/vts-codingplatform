import React, { useCallback, useEffect, useState } from 'react';
import axiosInstance from '../../../utils/axios';
import PracticePageLayout from '../../../components/Practice/PracticePageLayout';
import PracticeFilters from '../../../components/Practice/PracticeFilters';
import PracticeLoading from '../../../components/Practice/PracticeLoading';
import PracticeEmptyState from '../../../components/Practice/PracticeEmptyState';
import { PracticeProblemCard, PracticeProblemTable } from '../../../components/Practice/PracticeCards';
import '../../../styles/practice-pages.css';

const PracticeProblemList = () => {
  const [topics, setTopics] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [view, setView] = useState('table');
  const [filters, setFilters] = useState({
    search: '',
    difficulty: '',
    topic: '',
    status: '',
  });

  const fetchQuestions = useCallback(async (pageNum = 1, append = false) => {
    setLoading(true);
    try {
      const { data } = await axiosInstance.get('/practice/questions', {
        params: {
          page: pageNum,
          limit: 20,
          search: filters.search || undefined,
          difficulty: filters.difficulty || undefined,
          topic: filters.topic || undefined,
          status: filters.status || undefined,
        },
      });
      setItems((prev) => (append ? [...prev, ...data.items] : data.items));
      setHasMore(data.hasMore);
      setPage(data.page);
      setTotal(data.total || 0);
    } catch (err) {
      console.error(err);
      if (!append) setItems([]);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    axiosInstance.get('/practice/topics').then((res) => setTopics(res.data || []));
  }, []);

  useEffect(() => {
    fetchQuestions(1, false);
  }, [fetchQuestions]);

  return (
    <PracticePageLayout
      active="problems"
      title="Problem Bank"
      subtitle={`${total} coding problems available. Filter by topic, difficulty, or your progress.`}
      compactHero
    >
      <PracticeFilters filters={filters} onChange={setFilters} topics={topics} />

      <div className="practice-view-toggle">
        <button type="button" className={view === 'table' ? 'is-active' : ''} onClick={() => setView('table')}>
          List view
        </button>
        <button type="button" className={view === 'grid' ? 'is-active' : ''} onClick={() => setView('grid')}>
          Card view
        </button>
      </div>

      {loading && !items.length ? (
        <PracticeLoading message="Loading problems…" />
      ) : !items.length ? (
        <PracticeEmptyState
          title="No problems found"
          description="Try adjusting your filters, or check back later when more questions are added."
        />
      ) : view === 'table' ? (
        <PracticeProblemTable items={items} />
      ) : (
        <div className="practice-problem-grid">
          {items.map((q) => (
            <PracticeProblemCard key={q._id} question={q} />
          ))}
        </div>
      )}

      {hasMore && (
        <button
          type="button"
          className="practice-btn practice-btn-primary"
          style={{ marginTop: 20 }}
          disabled={loading}
          onClick={() => fetchQuestions(page + 1, true)}
        >
          {loading ? 'Loading…' : 'Load more'}
        </button>
      )}
    </PracticePageLayout>
  );
};

export default PracticeProblemList;
