import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axiosInstance from '../../utils/axios';
import './MockInterviews.css';

const MockInterviews = () => {
  const [interviews, setInterviews] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchInterviews = async () => {
      try {
        const response = await axiosInstance.get('/interviews/assigned');
        setInterviews(response.data || []);
      } catch (error) {
        console.error('❌ Error fetching interviews:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchInterviews();
  }, []);

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="container student-dashboard">
      <div className="interview-list-header">
        <div>
          <h1>Interview Tests</h1>
          <p>Practice with AI interviewer and get instant feedback.</p>
        </div>
        <Link to="/student/dashboard" className="btn btn-secondary">
          Back to Dashboard
        </Link>
      </div>

      {interviews.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🎤</div>
          <h2>No Interview Tests Assigned</h2>
          <p>Your institute will assign tests here.</p>
        </div>
      ) : (
        <div className="interview-grid">
          {interviews.map(interview => (
            <div key={interview._id} className="interview-card">
              <div className="interview-card-header">
                <div>
                  <h3>{interview.title}</h3>
                  <p>{interview.description || 'AI-driven interview session'}</p>
                </div>
                <span className={`status-badge-modern ${interview.enrollmentStatus || 'assigned'}`}>
                  {interview.enrollmentStatus || 'assigned'}
                </span>
              </div>
              <div className="interview-meta">
                <div><strong>Type:</strong> {interview.interviewType}</div>
                <div><strong>Topic:</strong> {interview.topic}</div>
                <div><strong>Level:</strong> {interview.difficulty}</div>
                <div><strong>Duration:</strong> {interview.duration} min</div>
              </div>
              <div className="interview-actions">
                <Link to={`/student/interviews/${interview._id}`} className="btn btn-primary">
                  Start Interview →
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MockInterviews;
