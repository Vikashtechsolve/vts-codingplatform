import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiPlus, FiEdit2, FiTrash2, FiMic } from 'react-icons/fi';
import axiosInstance from '../../utils/axios';
import VendorHubPage from '../../components/VendorAdmin/VendorHubPage';
import '../../styles/super-admin-pages.css';

const difficultyBadge = (d) => {
  const map = { beginner: 'easy', intermediate: 'medium', advanced: 'hard', easy: 'easy', medium: 'medium', hard: 'hard' };
  return map[d?.toLowerCase()] || 'global';
};

const truncate = (text, max = 100) => {
  if (!text) return 'Untitled question';
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max).trim()}…`;
};

const InterviewQuestions = () => {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchQuestions();
  }, []);

  const fetchQuestions = async () => {
    try {
      setLoading(true);
      const response = await axiosInstance.get('/super-admin/interview-questions');
      setQuestions(response.data || []);
    } catch (error) {
      console.error('Error fetching interview questions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this interview question?')) return;
    try {
      await axiosInstance.delete(`/super-admin/interview-questions/${id}`);
      fetchQuestions();
    } catch (error) {
      alert(error.response?.data?.message || 'Error deleting question');
    }
  };

  return (
    <VendorHubPage
      className="sa-page"
      loading={loading}
      eyebrow="Interview content"
      title="Interview question bank"
      subtitle="Global mock-interview questions shared across all vendors."
      accent="#c026d3"
      actions={
        <Link to="/super-admin/interview-questions/create" className="vh-btn vh-btn--primary">
          <FiPlus /> Create question
        </Link>
      }
    >
      <div className="vh-stats">
        <div className="vh-stat vh-stat--accent">
          <span className="vh-stat-label">Total questions</span>
          <span className="vh-stat-value">{questions.length}</span>
        </div>
      </div>

      <div className="vh-panel">
        <div className="vh-panel-head">
          <div>
            <h2 className="vh-panel-title">All interview questions</h2>
            <p className="vh-panel-desc">
              {questions.length} question{questions.length !== 1 ? 's' : ''} in the global pool.
            </p>
          </div>
        </div>
        <div className="vh-panel-body vh-panel-body--flush">
          {questions.length === 0 ? (
            <div className="vh-empty">
              <div className="vh-empty-icon">
                <FiMic />
              </div>
              <h2>No interview questions</h2>
              <p>Create global interview questions for all vendors to use in mock interviews.</p>
              <Link to="/super-admin/interview-questions/create" className="vh-btn vh-btn--primary">
                <FiPlus /> Create question
              </Link>
            </div>
          ) : (
            <div className="vh-table-wrap">
              <table className="vh-table">
                <thead>
                  <tr>
                    <th>Question</th>
                    <th>Type</th>
                    <th>Topic</th>
                    <th>Difficulty</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {questions.map((q) => (
                    <tr key={q._id}>
                      <td>
                        <div className="vh-person-name sa-truncate">{truncate(q.question)}</div>
                      </td>
                      <td>
                        <span className="vh-badge vh-badge--global">{q.interviewType || '—'}</span>
                      </td>
                      <td className="vh-cell-muted">{q.topic || '—'}</td>
                      <td>
                        <span className={`vh-badge vh-badge--${difficultyBadge(q.difficulty)}`}>
                          {q.difficulty || '—'}
                        </span>
                      </td>
                      <td>
                        <div className="sa-cell-actions">
                          <Link
                            to={`/super-admin/interview-questions/edit/${q._id}`}
                            className="vh-btn vh-btn--ghost vh-btn--sm"
                          >
                            <FiEdit2 /> Edit
                          </Link>
                          <button
                            type="button"
                            className="vh-btn vh-btn--ghost vh-btn--sm"
                            onClick={() => handleDelete(q._id)}
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

export default InterviewQuestions;
