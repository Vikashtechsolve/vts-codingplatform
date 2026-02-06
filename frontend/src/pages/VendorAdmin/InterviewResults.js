import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import axiosInstance from '../../utils/axios';
import './VendorAdminCommon.css';
import './TestResults.css';
import './InterviewResults.css';

const InterviewResults = () => {
  const { interviewId } = useParams();
  const [sessions, setSessions] = useState([]);
  const [interview, setInterview] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [sessionsRes, interviewRes] = await Promise.all([
          axiosInstance.get(`/interview-sessions/interview/${interviewId}`),
          axiosInstance.get(`/interviews/${interviewId}`).catch(() => ({ data: null }))
        ]);
        setSessions(sessionsRes.data || []);
        setInterview(interviewRes.data || null);
      } catch (error) {
        console.error('Error fetching interview sessions:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [interviewId]);

  if (loading) return <div className="loading">Loading...</div>;

  const title = interview?.title || 'Interview Results';

  return (
    <div className="container interview-results">
      <div className="page-header">
        <div>
          <Link to="/vendor-admin/interviews" className="btn btn-secondary" style={{ marginBottom: '12px', display: 'inline-block' }}>
            ← Back to Interviews
          </Link>
          <h1 className="page-title">{title}</h1>
          {interview && (
            <p style={{ marginTop: '4px', color: 'var(--text-secondary)' }}>
              {interview.interviewType} · {interview.topic} · {interview.difficulty}
            </p>
          )}
        </div>
      </div>

      {sessions.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📊</div>
          <h2>No Results Yet</h2>
          <p>Results will appear when students complete this interview.</p>
        </div>
      ) : (
        <div className="results-table-card">
          <h2>Submissions ({sessions.length})</h2>
          <div className="table-container">
            <table className="results-table-modern table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Status</th>
                  <th>Score</th>
                  <th>Readiness</th>
                  <th>Submitted</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map(session => (
                  <tr key={session._id}>
                    <td><strong>{session.studentId?.name}</strong><br /><small>{session.studentId?.email}</small></td>
                    <td>
                      <span className={`status-badge ${session.status === 'completed' ? 'active' : 'inactive'}`}>
                        {session.status}
                      </span>
                    </td>
                    <td><strong>{session.overallScore ?? '—'}/100</strong></td>
                    <td>{session.readinessPercent != null ? `${session.readinessPercent}%` : '—'}</td>
                    <td>{session.submittedAt ? new Date(session.submittedAt).toLocaleString() : '—'}</td>
                    <td>
                      <Link to={`/vendor-admin/interviews/results/${session._id}`} className="btn btn-sm btn-primary">
                        View Details
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default InterviewResults;
