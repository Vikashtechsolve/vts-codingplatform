import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axiosInstance from '../../utils/axios';
import { formatScheduleDateTime } from '../../utils/datetimeLocal';
import { normalizeInterviewItem } from '../../utils/studentSectionItems';
import {
  formatInterviewCardSubtitle,
  truncateCardPreview,
} from '../../utils/interviewCardText';
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
          {interviews.map((interview) => {
            const item = normalizeInterviewItem(interview);
            const primary = item.primary || {};
            return (
            <div key={interview._id} className="interview-card">
              <div className="interview-card-header">
                <div>
                  <h3>{interview.title}</h3>
                  <p className="interview-card-subtitle" title={formatInterviewCardSubtitle(interview, { maxTopicLength: 200 })}>
                    {formatInterviewCardSubtitle(interview)}
                  </p>
                  {interview.description && (
                    <p className="interview-card-desc" title={interview.description}>
                      {truncateCardPreview(interview.description, 90)}
                    </p>
                  )}
                </div>
                <span className={`status-badge-modern ${item.statusKey || interview.enrollmentStatus || 'assigned'}`}>
                  {item.statusLabel || interview.enrollmentStatus || 'assigned'}
                </span>
              </div>
              <div className="interview-meta">
                <div><strong>Duration:</strong> {interview.duration} min</div>
                {(interview.scheduleWindowStart || interview.startDate) && (
                  <div><strong>Starts:</strong> {formatScheduleDateTime(interview.scheduleWindowStart || interview.startDate)}</div>
                )}
                {(interview.scheduleWindowEnd || interview.endDate) && (
                  <div><strong>Ends:</strong> {formatScheduleDateTime(interview.scheduleWindowEnd || interview.endDate)}</div>
                )}
              </div>
              {primary.hint && <p className="interview-schedule-hint">{primary.hint}</p>}
              <div className="interview-actions">
                {primary.disabled ? (
                  <span className="btn btn-secondary btn-disabled">{primary.label}</span>
                ) : (
                  <Link to={primary.link || `/student/interviews/${interview._id}`} className="btn btn-primary">
                    {primary.label} →
                  </Link>
                )}
                {item.secondary?.link && (
                  <Link to={item.secondary.link} className="btn btn-secondary">
                    {item.secondary.label}
                  </Link>
                )}
              </div>
            </div>
          );
          })}
        </div>
      )}
    </div>
  );
};

export default MockInterviews;
