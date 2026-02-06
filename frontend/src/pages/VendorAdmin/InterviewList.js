import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axiosInstance from '../../utils/axios';
import './VendorAdminCommon.css';
import './InterviewList.css';

const InterviewList = () => {
  const [interviews, setInterviews] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchInterviews();
  }, []);

  const fetchInterviews = async () => {
    try {
      const response = await axiosInstance.get('/interviews');
      setInterviews(response.data || []);
    } catch (error) {
      console.error('Error fetching interviews:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this interview?')) return;
    try {
      await axiosInstance.delete(`/interviews/${id}`);
      fetchInterviews();
    } catch (error) {
      alert(error.response?.data?.message || 'Error deleting interview');
    }
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="container interview-list-page">
      <div className="page-header">
        <h1 className="page-title">Interview Tests</h1>
        <div className="btn-group">
          <Link to="/vendor-admin/interviews/create" className="btn btn-primary">
            ➕ Create Interview
          </Link>
          <Link to="/vendor-admin/interview-questions" className="btn btn-secondary">
            Manage Questions
          </Link>
        </div>
      </div>

      {interviews.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🎤</div>
          <h2>No Interviews Yet</h2>
          <p>Create your first interview test.</p>
          <Link to="/vendor-admin/interviews/create" className="btn btn-primary">
            Create Interview
          </Link>
        </div>
      ) : (
        <>
          <div className="interview-results-section-header">
            <h2>📊 Results & analysis</h2>
            <p>View student submissions and full feedback (scores, readiness, strengths, improvements) for each interview.</p>
          </div>
          <div className="interview-grid">
            {interviews.map(interview => (
              <div key={interview._id} className="interview-card">
                <div className="interview-card-header">
                  <div>
                    <h3>{interview.title}</h3>
                    <p>{interview.interviewType} · {interview.topic} · {interview.difficulty}</p>
                  </div>
                  <span className={`status-badge-modern ${interview.isActive ? 'active' : 'inactive'}`}>
                    {interview.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div className="interview-meta">
                  <span><strong>Duration:</strong> {interview.duration} min</span>
                  <span><strong>Questions:</strong> {interview.questionCount || interview.questions?.length || 0}</span>
                </div>
                <div className="interview-actions">
                  <Link to={`/vendor-admin/interviews/${interview._id}/assign`} className="btn btn-primary btn-sm">
                    Assign
                  </Link>
                  <Link to={`/vendor-admin/interviews/${interview._id}/results`} className="btn btn-primary btn-sm interview-results-btn">
                    📊 View results
                  </Link>
                  <button onClick={() => handleDelete(interview._id)} className="btn btn-danger btn-sm">
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default InterviewList;
