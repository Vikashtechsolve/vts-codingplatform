import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FiChevronLeft,
  FiChevronRight,
  FiPlus,
  FiEdit2,
  FiTrash2,
  FiCode,
  FiHelpCircle,
  FiCpu,
  FiBook,
  FiMessageCircle,
  FiSearch,
  FiTarget,
} from 'react-icons/fi';
import axiosInstance from '../../utils/axios';
import VendorHubPage from '../../components/VendorAdmin/VendorHubPage';
import { SUPER_ADMIN_ACCENT } from '../../constants/superAdminSections';
import { normalizePaginatedResponse } from '../../utils/paginatedApi';
import '../../styles/super-admin-pages.css';
import '../../styles/super-admin-practice.css';

const PAGE_SIZE = 20;

const TABS = [
  { id: 'coding', label: 'Coding', icon: FiCode, accent: '#2563eb' },
  { id: 'mcq', label: 'MCQ', icon: FiHelpCircle, accent: '#7c3aed' },
  { id: 'aptitude', label: 'Aptitude', icon: FiCpu, accent: '#059669' },
  { id: 'theory', label: 'Theory', icon: FiBook, accent: '#475569' },
];

const difficultyBadge = (d) => {
  const map = { easy: 'easy', medium: 'medium', hard: 'hard', beginner: 'easy', intermediate: 'medium', advanced: 'hard' };
  return map[d?.toLowerCase()] || 'global';
};

const createLinks = {
  coding: '/super-admin/global-questions/coding/create',
  mcq: '/super-admin/global-questions/mcq/create',
  aptitude: '/super-admin/global-questions/aptitude/create',
  theory: '/super-admin/global-questions/theory/create',
};

const editPath = (type, id) => `/super-admin/global-questions/${type}/edit/${id}`;

const GlobalQuestions = () => {
  const [activeTab, setActiveTab] = useState('coding');
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [counts, setCounts] = useState({ coding: 0, mcq: 0, aptitude: 0, theory: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [toggling, setToggling] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, activeTab]);

  const fetchTab = useCallback(async (tabId, pageNum, searchTerm, signal) => {
    const { data } = await axiosInstance.get(`/super-admin/global-questions/${tabId}`, {
      params: { page: pageNum, limit: PAGE_SIZE, search: searchTerm || undefined },
      signal,
    });
    return normalizePaginatedResponse(data);
  }, []);

  useEffect(() => {
    const ac = new AbortController();
    let cancelled = false;
    setLoading(true);
    setError('');
    fetchTab(activeTab, page, debouncedSearch, ac.signal)
      .then((parsed) => {
        if (cancelled) return;
        setItems(parsed.items);
        setTotal(parsed.total);
        setTotalPages(Math.max(1, parsed.totalPages || 1));
        if (!debouncedSearch) {
          setCounts((prev) => ({ ...prev, [activeTab]: parsed.total }));
        }
      })
      .catch((err) => {
        if (err.code === 'ERR_CANCELED' || cancelled) return;
        setError(err.response?.data?.message || 'Failed to load questions');
        setItems([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [activeTab, page, debouncedSearch, fetchTab]);

  useEffect(() => {
    const ac = new AbortController();
    Promise.all(
      TABS.map((t) => fetchTab(t.id, 1, '', ac.signal).then((parsed) => [t.id, parsed.total]))
    )
      .then((pairs) => setCounts(Object.fromEntries(pairs)))
      .catch(() => {});
    return () => ac.abort();
  }, [fetchTab]);

  const handleDelete = async (id, type) => {
    if (!window.confirm('Delete this global question?')) return;
    try {
      await axiosInstance.delete(`/super-admin/global-questions/${type}/${id}`);
      setItems((prev) => prev.filter((q) => q._id !== id));
      setTotal((n) => Math.max(0, n - 1));
      setCounts((prev) => ({ ...prev, [type]: Math.max(0, (prev[type] || 1) - 1) }));
    } catch (err) {
      alert(err.response?.data?.message || 'Error deleting question');
    }
  };

  const togglePractice = async (question, enabled) => {
    setToggling(question._id);
    try {
      await axiosInstance.put(`/super-admin/practice/questions/${question._id}/practice`, {
        practiceEnabled: enabled,
      });
      setItems((prev) =>
        prev.map((q) => (q._id === question._id ? { ...q, practiceEnabled: enabled } : q))
      );
    } catch (err) {
      alert(err.response?.data?.message || 'Could not update practice status');
    } finally {
      setToggling(null);
    }
  };

  return (
    <VendorHubPage
      className="sa-page sa-practice-page"
      eyebrow="Content library"
      title="Global question bank"
      subtitle="Platform-wide questions for every vendor. Coding items can be published into the student Practice bank."
      accent={SUPER_ADMIN_ACCENT}
      actions={
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link to="/super-admin/practice/questions" className="vh-btn vh-btn--secondary">
            <FiTarget /> Practice bank
          </Link>
          <Link to="/super-admin/global-questions/english" className="vh-btn vh-btn--secondary">
            <FiMessageCircle /> English bank
          </Link>
          <Link to={createLinks[activeTab]} className="vh-btn vh-btn--primary">
            <FiPlus /> Create {activeTab} question
          </Link>
        </div>
      }
    >
      <div className="vh-stats">
        {TABS.map((tab) => (
          <div key={tab.id} className="vh-stat" style={{ '--vh-accent': tab.accent }}>
            <span className="vh-stat-label">{tab.label}</span>
            <span className="vh-stat-value" style={{ color: tab.accent }}>
              {counts[tab.id]}
            </span>
          </div>
        ))}
      </div>

      <p className="sa-credits-note">
        Coding questions live here. To show one on the student Practice page, open{' '}
        <Link to="/super-admin/practice/questions">Practice Questions</Link> and switch it on — or use the
        In practice toggle on the Coding tab.
      </p>

      {error && <div className="vh-alert vh-alert--error" style={{ marginBottom: 16 }}>{error}</div>}

      <div className="vh-toolbar">
        <label className="vh-search">
          <FiSearch />
          <input
            type="search"
            placeholder={`Search ${activeTab} questions…`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
      </div>

      <div className="vh-chips">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              className={`vh-chip ${activeTab === tab.id ? 'active' : ''}`}
              style={{ '--chip-accent': tab.accent }}
              onClick={() => setActiveTab(tab.id)}
            >
              <Icon /> {tab.label}
              <span className="vh-chip-count">{counts[tab.id]}</span>
            </button>
          );
        })}
      </div>

      <div className="vh-panel">
        <div className="vh-panel-head">
          <div>
            <h2 className="vh-panel-title">
              {TABS.find((t) => t.id === activeTab)?.label} questions
            </h2>
            <p className="vh-panel-desc">
              {total} global question{total !== 1 ? 's' : ''} in this category.
            </p>
          </div>
        </div>
        <div className="vh-panel-body vh-panel-body--flush">
          {loading ? (
            <div className="vh-loading" style={{ minHeight: 240 }}>
              <div className="vh-spinner" />
              <p>Loading questions…</p>
            </div>
          ) : items.length === 0 ? (
            <div className="vh-empty">
              <div className="vh-empty-icon">📚</div>
              <h2>No {activeTab} questions yet</h2>
              <p>Create global questions that all vendors can use in their assessments.</p>
              <Link to={createLinks[activeTab]} className="vh-btn vh-btn--primary">
                <FiPlus /> Create question
              </Link>
            </div>
          ) : (
            <>
              <div className="vh-table-wrap">
                <table className="vh-table">
                  <thead>
                    <tr>
                      {activeTab === 'coding' && (
                        <>
                          <th>In practice</th>
                          <th>Title</th>
                          <th>Created by</th>
                          <th>Difficulty</th>
                          <th>Languages</th>
                        </>
                      )}
                      {activeTab === 'mcq' && (
                        <>
                          <th>Question</th>
                          <th>Created by</th>
                          <th>Difficulty</th>
                          <th>Options</th>
                          <th>Points</th>
                        </>
                      )}
                      {activeTab === 'aptitude' && (
                        <>
                          <th>Question</th>
                          <th>Created by</th>
                          <th>Section</th>
                          <th>Type</th>
                          <th>Difficulty</th>
                        </>
                      )}
                      {activeTab === 'theory' && (
                        <>
                          <th>Question</th>
                          <th>Created by</th>
                          <th>Difficulty</th>
                          <th>Points</th>
                        </>
                      )}
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeTab === 'coding' &&
                      items.map((q) => (
                        <tr key={q._id}>
                          <td>
                            <label className="sa-practice-switch" title={q.practiceEnabled ? 'In student practice' : 'Not in practice'}>
                              <input
                                type="checkbox"
                                checked={q.practiceEnabled === true || q.source === 'practice'}
                                disabled={toggling === q._id}
                                onChange={(e) => togglePractice(q, e.target.checked)}
                              />
                              <span />
                            </label>
                          </td>
                          <td>
                            <div className="vh-person-name sa-truncate">{q.title}</div>
                          </td>
                          <td className="vh-cell-muted">{q.createdBy?.name || '—'}</td>
                          <td>
                            <span className={`vh-badge vh-badge--${difficultyBadge(q.difficulty)}`}>
                              {q.difficulty}
                            </span>
                          </td>
                          <td className="vh-cell-muted">{q.allowedLanguages?.join(', ') || '—'}</td>
                          <td>
                            <div className="sa-cell-actions">
                              <Link to={editPath('coding', q._id)} className="vh-btn vh-btn--ghost vh-btn--sm">
                                <FiEdit2 /> Edit
                              </Link>
                              <button
                                type="button"
                                className="vh-btn vh-btn--ghost vh-btn--sm"
                                onClick={() => handleDelete(q._id, 'coding')}
                                style={{ color: '#dc2626' }}
                              >
                                <FiTrash2 />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}

                    {activeTab === 'mcq' &&
                      items.map((q) => (
                        <tr key={q._id}>
                          <td>
                            <div className="vh-person-name sa-truncate">{q.question}</div>
                          </td>
                          <td className="vh-cell-muted">{q.createdBy?.name || '—'}</td>
                          <td>
                            <span className={`vh-badge vh-badge--${difficultyBadge(q.difficulty)}`}>
                              {q.difficulty}
                            </span>
                          </td>
                          <td>{q.options?.length || 0}</td>
                          <td>{q.points ?? '—'}</td>
                          <td>
                            <div className="sa-cell-actions">
                              <Link to={editPath('mcq', q._id)} className="vh-btn vh-btn--ghost vh-btn--sm">
                                <FiEdit2 /> Edit
                              </Link>
                              <button
                                type="button"
                                className="vh-btn vh-btn--ghost vh-btn--sm"
                                onClick={() => handleDelete(q._id, 'mcq')}
                                style={{ color: '#dc2626' }}
                              >
                                <FiTrash2 />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}

                    {activeTab === 'aptitude' &&
                      items.map((q) => (
                        <tr key={q._id}>
                          <td>
                            <div className="vh-person-name sa-truncate">{q.question}</div>
                          </td>
                          <td className="vh-cell-muted">{q.createdBy?.name || '—'}</td>
                          <td>{q.section || '—'}</td>
                          <td>{q.questionType || '—'}</td>
                          <td>
                            <span className={`vh-badge vh-badge--${difficultyBadge(q.difficulty)}`}>
                              {q.difficulty}
                            </span>
                          </td>
                          <td>
                            <div className="sa-cell-actions">
                              <Link to={editPath('aptitude', q._id)} className="vh-btn vh-btn--ghost vh-btn--sm">
                                <FiEdit2 /> Edit
                              </Link>
                              <button
                                type="button"
                                className="vh-btn vh-btn--ghost vh-btn--sm"
                                onClick={() => handleDelete(q._id, 'aptitude')}
                                style={{ color: '#dc2626' }}
                              >
                                <FiTrash2 />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}

                    {activeTab === 'theory' &&
                      items.map((q) => (
                        <tr key={q._id}>
                          <td>
                            <div className="vh-person-name sa-truncate">{q.questionText}</div>
                          </td>
                          <td className="vh-cell-muted">{q.createdBy?.name || '—'}</td>
                          <td>
                            <span className={`vh-badge vh-badge--${difficultyBadge(q.difficulty)}`}>
                              {q.difficulty}
                            </span>
                          </td>
                          <td>{q.points ?? q.maxMarks ?? '—'}</td>
                          <td>
                            <div className="sa-cell-actions">
                              <Link to={editPath('theory', q._id)} className="vh-btn vh-btn--ghost vh-btn--sm">
                                <FiEdit2 /> Edit
                              </Link>
                              <button
                                type="button"
                                className="vh-btn vh-btn--ghost vh-btn--sm"
                                onClick={() => handleDelete(q._id, 'theory')}
                                style={{ color: '#dc2626' }}
                              >
                                <FiTrash2 />
                              </button>
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

export default GlobalQuestions;
