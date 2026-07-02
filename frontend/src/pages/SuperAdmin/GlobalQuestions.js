import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { FiPlus, FiEdit2, FiTrash2, FiCode, FiHelpCircle, FiCpu } from 'react-icons/fi';
import axiosInstance from '../../utils/axios';
import VendorHubPage from '../../components/VendorAdmin/VendorHubPage';
import { SUPER_ADMIN_ACCENT } from '../../constants/superAdminSections';
import '../../styles/super-admin-pages.css';

const TABS = [
  { id: 'coding', label: 'Coding', icon: FiCode, accent: '#2563eb' },
  { id: 'mcq', label: 'MCQ', icon: FiHelpCircle, accent: '#7c3aed' },
  { id: 'aptitude', label: 'Aptitude', icon: FiCpu, accent: '#059669' },
];

const difficultyBadge = (d) => {
  const map = { easy: 'easy', medium: 'medium', hard: 'hard', beginner: 'easy', intermediate: 'medium', advanced: 'hard' };
  return map[d?.toLowerCase()] || 'global';
};

const GlobalQuestions = () => {
  const [codingQuestions, setCodingQuestions] = useState([]);
  const [mcqQuestions, setMcqQuestions] = useState([]);
  const [aptitudeQuestions, setAptitudeQuestions] = useState([]);
  const [activeTab, setActiveTab] = useState('coding');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchQuestions();
  }, []);

  const fetchQuestions = async () => {
    try {
      setLoading(true);
      const [codingRes, mcqRes, aptitudeRes] = await Promise.all([
        axiosInstance.get('/super-admin/global-questions/coding'),
        axiosInstance.get('/super-admin/global-questions/mcq'),
        axiosInstance.get('/super-admin/global-questions/aptitude'),
      ]);
      setCodingQuestions(codingRes.data || []);
      setMcqQuestions(mcqRes.data || []);
      setAptitudeQuestions(aptitudeRes.data || []);
    } catch (error) {
      console.error('Error fetching global questions:', error);
    } finally {
      setLoading(false);
    }
  };

  const counts = useMemo(
    () => ({
      coding: codingQuestions.length,
      mcq: mcqQuestions.length,
      aptitude: aptitudeQuestions.length,
    }),
    [codingQuestions, mcqQuestions, aptitudeQuestions]
  );

  const activeQuestions = useMemo(() => {
    if (activeTab === 'mcq') return mcqQuestions;
    if (activeTab === 'aptitude') return aptitudeQuestions;
    return codingQuestions;
  }, [activeTab, codingQuestions, mcqQuestions, aptitudeQuestions]);

  const handleDelete = async (id, type) => {
    if (!window.confirm('Delete this global question?')) return;
    try {
      await axiosInstance.delete(`/super-admin/global-questions/${type}/${id}`);
      fetchQuestions();
    } catch (error) {
      alert(error.response?.data?.message || 'Error deleting question');
    }
  };

  const createLinks = {
    coding: '/super-admin/global-questions/coding/create',
    mcq: '/super-admin/global-questions/mcq/create',
    aptitude: '/super-admin/global-questions/aptitude/create',
  };

  const editPath = (type, id) => `/super-admin/global-questions/${type}/edit/${id}`;

  return (
    <VendorHubPage
      className="sa-page"
      loading={loading}
      eyebrow="Content library"
      title="Global question bank"
      subtitle="Platform-wide questions available to all vendors."
      accent={SUPER_ADMIN_ACCENT}
      actions={
        <Link to={createLinks[activeTab]} className="vh-btn vh-btn--primary">
          <FiPlus /> Create {activeTab} question
        </Link>
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

      <div className="vh-chips">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              className={`vh-chip ${activeTab === tab.id ? 'active' : ''}`}
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
              {activeQuestions.length} global question{activeQuestions.length !== 1 ? 's' : ''} in this category.
            </p>
          </div>
        </div>
        <div className="vh-panel-body vh-panel-body--flush">
          {activeQuestions.length === 0 ? (
            <div className="vh-empty">
              <div className="vh-empty-icon">📚</div>
              <h2>No {activeTab} questions yet</h2>
              <p>Create global questions that all vendors can use in their assessments.</p>
              <Link to={createLinks[activeTab]} className="vh-btn vh-btn--primary">
                <FiPlus /> Create question
              </Link>
            </div>
          ) : (
            <div className="vh-table-wrap">
              <table className="vh-table">
                <thead>
                  <tr>
                    {activeTab === 'coding' && (
                      <>
                        <th>Title</th>
                        <th>Created by</th>
                        <th>Difficulty</th>
                        <th>Languages</th>
                        <th>Test cases</th>
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
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {activeTab === 'coding' &&
                    codingQuestions.map((q) => (
                      <tr key={q._id}>
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
                        <td>{q.testCases?.length || 0}</td>
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
                    mcqQuestions.map((q) => (
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
                    aptitudeQuestions.map((q) => (
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
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </VendorHubPage>
  );
};

export default GlobalQuestions;
