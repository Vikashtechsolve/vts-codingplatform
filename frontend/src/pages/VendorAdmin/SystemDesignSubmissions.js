import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axiosInstance from '../../utils/axios';
import './SystemDesignList.css';

const SystemDesignSubmissions = () => {
  const { id: problemId } = useParams();
  const navigate = useNavigate();
  const [problem, setProblem] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchSubmissions = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await axiosInstance.get(`/system-design-problems/${problemId}/submissions`);
      if (data.success) {
        setProblem(data.problem);
        setSubmissions(data.submissions);
      }
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  }, [problemId]);

  useEffect(() => { fetchSubmissions(); }, [fetchSubmissions]);

  const formatTime = (seconds) => {
    if (!seconds) return '-';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s}s`;
  };

  const getStatusColor = (status) => {
    const colors = { not_started: '#999', in_progress: '#ff9800', submitted: '#2196f3', evaluating: '#9c27b0', follow_up: '#e91e63', evaluated: '#4caf50' };
    return colors[status] || '#999';
  };

  const getGrade = (pct) => {
    if (pct >= 90) return 'A';
    if (pct >= 80) return 'B';
    if (pct >= 70) return 'C';
    if (pct >= 60) return 'D';
    return 'F';
  };

  if (loading) return <div className="sd-list-container"><div className="loading">Loading...</div></div>;

  const avgScore = submissions.filter(s => s.status === 'evaluated').length > 0
    ? Math.round(submissions.filter(s => s.status === 'evaluated').reduce((sum, s) => sum + (s.percentage || 0), 0) / submissions.filter(s => s.status === 'evaluated').length)
    : 0;

  return (
    <div className="sd-list-container">
      <div className="sd-list-header">
        <div>
          <h1>Submissions</h1>
          {problem && <p style={{ color: 'var(--text-secondary, #666)', margin: '4px 0 0' }}>{problem.title} - {problem.difficulty}</p>}
        </div>
        <button className="sd-action-btn edit" onClick={() => navigate('/vendor-admin/system-designs')}>Back to List</button>
      </div>

      {submissions.length > 0 && (
        <div className="sd-card-stats" style={{ maxWidth: 500, margin: '0 0 24px', padding: '16px 24px', background: 'var(--bg-primary, #fff)', borderRadius: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <div className="sd-stat"><span className="sd-stat-val">{submissions.length}</span><span className="sd-stat-label">Total</span></div>
          <div className="sd-stat"><span className="sd-stat-val">{submissions.filter(s => s.status === 'evaluated').length}</span><span className="sd-stat-label">Evaluated</span></div>
          <div className="sd-stat"><span className="sd-stat-val">{avgScore}%</span><span className="sd-stat-label">Avg Score</span></div>
        </div>
      )}

      {submissions.length === 0 ? (
        <div className="sd-empty"><p>No submissions yet.</p></div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="sd-submissions-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Status</th>
                <th>Score</th>
                <th>Grade</th>
                <th>Time Spent</th>
                <th>Hints</th>
                <th>Violations</th>
                <th>Submitted</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {submissions.map(s => (
                <tr key={s._id}>
                  <td>
                    <strong>{s.studentId?.name || 'Unknown'}</strong>
                    <br /><small>{s.studentId?.email}</small>
                  </td>
                  <td>
                    <span className="sd-status-pill" style={{ background: getStatusColor(s.status) }}>
                      {s.status?.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="sd-score-cell">{s.status === 'evaluated' ? `${s.percentage || 0}%` : '-'}</td>
                  <td className={`sd-grade-cell ${s.percentage >= 70 ? 'grade-pass' : s.percentage >= 50 ? 'grade-avg' : 'grade-fail'}`}>
                    {s.status === 'evaluated' ? getGrade(s.percentage) : '-'}
                  </td>
                  <td>{formatTime(s.timeSpent)}</td>
                  <td>{s.hintsUsed?.length || 0}</td>
                  <td className={s.violationCount > 0 ? 'sd-violation' : ''}>{s.violationCount || 0}</td>
                  <td>{s.submittedAt ? new Date(s.submittedAt).toLocaleString() : '-'}</td>
                  <td>
                    <button className="sd-action-btn subs" onClick={() => navigate(`/vendor-admin/system-design-result/${s._id}`)}>
                      View Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default SystemDesignSubmissions;
