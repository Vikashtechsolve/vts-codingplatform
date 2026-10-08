import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiChevronLeft, FiChevronRight, FiEdit2, FiPlus, FiSearch } from 'react-icons/fi';
import axiosInstance from '../../../utils/axios';
import VendorHubPage from '../../../components/VendorAdmin/VendorHubPage';
import { SUPER_ADMIN_ACCENT } from '../../../constants/superAdminSections';
import { normalizePaginatedResponse } from '../../../utils/paginatedApi';
import '../../../styles/super-admin-pages.css';
import '../../../styles/super-admin-practice.css';

const PAGE_SIZE = 20;
const DIFFICULTIES = ['easy', 'medium', 'hard'];

const capitalize = (value) => (value ? String(value).charAt(0).toUpperCase() + String(value).slice(1) : '—');

const difficultyBadge = (d) => {
  const map = { easy: 'easy', medium: 'medium', hard: 'hard' };
  return map[String(d || '').toLowerCase()] || 'global';
};

const PracticeQuestionsAdmin = () => {
  const [items, setItems] = useState([]);
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [visibility, setVisibility] = useState('all');
  const [difficulty, setDifficulty] = useState('all');
  const [toggling, setToggling] = useState(null);
  const [topicEditId, setTopicEditId] = useState(null);
  const [topicDraft, setTopicDraft] = useState([]);
  const [savingTopics, setSavingTopics] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, visibility, difficulty]);

  useEffect(() => {
    axiosInstance.get('/super-admin/practice/topics').then((res) => setTopics(res.data || []));
  }, []);

  const load = useCallback(
    async (signal) => {
      setLoading(true);
      setError('');
      try {
        const params = {
          source: 'global',
          page,
          limit: PAGE_SIZE,
        };
        if (debouncedSearch) params.search = debouncedSearch;
        if (difficulty !== 'all') params.difficulty = difficulty;
        if (visibility === 'live') params.practiceEnabled = 'true';
        if (visibility === 'hidden') params.practiceEnabled = 'false';

        const { data } = await axiosInstance.get('/super-admin/practice/questions', { params, signal });
        const parsed = normalizePaginatedResponse(data);
        setItems(parsed.items);
        setTotal(parsed.total);
        setTotalPages(Math.max(1, parsed.totalPages || 1));
      } catch (err) {
        if (err.code === 'ERR_CANCELED') return;
        setError(err.response?.data?.message || 'Failed to load questions');
        setItems([]);
      } finally {
        setLoading(false);
      }
    },
    [page, debouncedSearch, visibility, difficulty]
  );

  useEffect(() => {
    const ac = new AbortController();
    load(ac.signal);
    return () => ac.abort();
  }, [load]);

  const togglePractice = async (question, enabled) => {
    setToggling(question._id);
    setError('');
    try {
      await axiosInstance.put(`/super-admin/practice/questions/${question._id}/practice`, {
        practiceEnabled: enabled,
      });
      setItems((prev) =>
        prev.map((q) => (q._id === question._id ? { ...q, practiceEnabled: enabled } : q))
      );
    } catch (err) {
      setError(err.response?.data?.message || 'Could not update practice status');
    } finally {
      setToggling(null);
    }
  };

  const openTopics = (question) => {
    setTopicEditId(question._id);
    setTopicDraft((question.practiceTopics || []).map((t) => String(t._id || t)));
  };

  const saveTopics = async (questionId) => {
    setSavingTopics(true);
    try {
      const { data } = await axiosInstance.put(`/super-admin/practice/questions/${questionId}/practice`, {
        practiceTopics: topicDraft,
      });
      setItems((prev) =>
        prev.map((q) =>
          q._id === questionId
            ? {
                ...q,
                practiceTopics: topics.filter((t) =>
                  (data.practiceTopics || topicDraft).some((id) => String(id) === String(t._id))
                ),
              }
            : q
        )
      );
      setTopicEditId(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save topics');
    } finally {
      setSavingTopics(false);
    }
  };

  const liveCount = items.filter((q) => q.practiceEnabled).length;

  return (
    <VendorHubPage
      className="sa-page sa-practice-page"
      backTo="/super-admin/practice"
      backLabel="Practice"
      eyebrow="Step 3 · Publish"
      title="Practice Questions"
      subtitle="Turn global coding questions on for students. Only items marked In practice appear in the Practice bank."
      accent={SUPER_ADMIN_ACCENT}
      actions={
        <Link
          to="/super-admin/global-questions/coding/create?forPractice=1"
          className="vh-btn vh-btn--primary"
        >
          <FiPlus /> Create coding question
        </Link>
      }
    >
      <div className="vh-stats">
        <div className="vh-stat vh-stat--accent">
          <span className="vh-stat-label">Matching questions</span>
          <span className="vh-stat-value">{total}</span>
        </div>
        <div className="vh-stat">
          <span className="vh-stat-label">On this page · live</span>
          <span className="vh-stat-value">{liveCount}</span>
        </div>
      </div>

      <p className="sa-credits-note">
        Create or edit the problem in the <Link to="/super-admin/global-questions">Global Question Bank</Link>.
        Use this page only to publish it to students and attach DSA topics.
      </p>

      {error && <div className="vh-alert vh-alert--error" style={{ marginBottom: 16 }}>{error}</div>}

      <div className="vh-toolbar">
        <label className="vh-search">
          <FiSearch />
          <input
            type="search"
            placeholder="Search by title or tag…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <div className="vh-select-wrap">
          <select value={visibility} onChange={(e) => setVisibility(e.target.value)}>
            <option value="all">All global coding</option>
            <option value="live">In student practice</option>
            <option value="hidden">Not in practice</option>
          </select>
        </div>
        <div className="vh-select-wrap">
          <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
            <option value="all">Any difficulty</option>
            {DIFFICULTIES.map((d) => (
              <option key={d} value={d}>{capitalize(d)}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="vh-panel">
        <div className="vh-panel-head">
          <div>
            <h2 className="vh-panel-title">Coding questions</h2>
            <p className="vh-panel-desc">
              Toggle In practice to show the problem on the student Practice page.
            </p>
          </div>
        </div>
        <div className="vh-panel-body vh-panel-body--flush">
          {loading ? (
            <div className="vh-loading" style={{ minHeight: 220 }}>
              <div className="vh-spinner" />
              <p>Loading questions…</p>
            </div>
          ) : !items.length ? (
            <div className="vh-empty">
              <div className="vh-empty-icon">⌘</div>
              <h2>No questions match</h2>
              <p>Create a global coding question first, then come back here to publish it for practice.</p>
              <Link to="/super-admin/global-questions" className="vh-btn vh-btn--primary">
                Open question bank
              </Link>
            </div>
          ) : (
            <>
              <div className="vh-table-wrap">
                <table className="vh-table">
                  <thead>
                    <tr>
                      <th>In practice</th>
                      <th>Title</th>
                      <th>Difficulty</th>
                      <th>DSA topics</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((q) => (
                      <tr key={q._id}>
                        <td>
                          <label className="sa-practice-switch" title={q.practiceEnabled ? 'Visible to students' : 'Hidden from students'}>
                            <input
                              type="checkbox"
                              checked={!!q.practiceEnabled}
                              disabled={toggling === q._id}
                              onChange={(e) => togglePractice(q, e.target.checked)}
                            />
                            <span />
                          </label>
                        </td>
                        <td>
                          <div className="vh-person-name sa-truncate">{q.title}</div>
                        </td>
                        <td>
                          <span className={`vh-badge vh-badge--${difficultyBadge(q.difficulty)}`}>
                            {capitalize(q.difficulty)}
                          </span>
                        </td>
                        <td>
                          <div className="sa-practice-topics-cell">
                            {(q.practiceTopics || []).length
                              ? q.practiceTopics.map((t) => (
                                  <span key={t._id || t} className="sa-practice-topic-chip">
                                    {t.label || t}
                                  </span>
                                ))
                              : <span className="vh-cell-muted">None</span>}
                          </div>
                          {topicEditId === q._id && (
                            <div className="sa-practice-topic-picker">
                              <div className="sa-practice-topic-picker-list">
                                {topics.map((t) => (
                                  <label key={t._id}>
                                    <input
                                      type="checkbox"
                                      checked={topicDraft.some((id) => String(id) === String(t._id))}
                                      onChange={(e) => {
                                        const id = String(t._id);
                                        setTopicDraft((prev) =>
                                          e.target.checked
                                            ? [...prev, id]
                                            : prev.filter((x) => String(x) !== id)
                                        );
                                      }}
                                    />
                                    {t.label}
                                  </label>
                                ))}
                              </div>
                              <div className="sa-practice-topic-actions">
                                <button
                                  type="button"
                                  className="vh-btn vh-btn--primary vh-btn--sm"
                                  disabled={savingTopics}
                                  onClick={() => saveTopics(q._id)}
                                >
                                  {savingTopics ? 'Saving…' : 'Save topics'}
                                </button>
                                <button
                                  type="button"
                                  className="vh-btn vh-btn--ghost vh-btn--sm"
                                  onClick={() => setTopicEditId(null)}
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          )}
                        </td>
                        <td>
                          <div className="sa-cell-actions">
                            <button
                              type="button"
                              className="vh-btn vh-btn--ghost vh-btn--sm"
                              onClick={() => openTopics(q)}
                            >
                              Topics
                            </button>
                            <Link
                              to={`/super-admin/global-questions/coding/edit/${q._id}`}
                              className="vh-btn vh-btn--ghost vh-btn--sm"
                            >
                              <FiEdit2 /> Edit
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="sa-practice-pager">
                <span>
                  Page {page} of {totalPages} · {total} question{total === 1 ? '' : 's'}
                </span>
                <div className="sa-practice-pager-btns">
                  <button
                    type="button"
                    className="vh-btn vh-btn--ghost vh-btn--sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    <FiChevronLeft /> Prev
                  </button>
                  <button
                    type="button"
                    className="vh-btn vh-btn--ghost vh-btn--sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next <FiChevronRight />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </VendorHubPage>
  );
};

export default PracticeQuestionsAdmin;
