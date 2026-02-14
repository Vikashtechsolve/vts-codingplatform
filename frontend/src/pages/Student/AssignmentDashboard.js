import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axiosInstance from '../../utils/axios';
import './Dashboard.css';
import './AssignmentDashboard.css';

const AssignmentDashboard = () => {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetchAssignments();
  }, []);

  const fetchAssignments = async () => {
    try {
      setLoading(true);
      const { data } = await axiosInstance.get('/assignments/student/my-assignments');
      if (data.success) {
        setAssignments(data.assignments);
      } else {
        setError(data.message);
      }
    } catch (err) {
      console.error('Error fetching assignments:', err);
      setError('Failed to fetch assignments');
    } finally {
      setLoading(false);
    }
  };

  const filteredAssignments = assignments.filter(item => {
    if (filter === 'all') return true;
    if (filter === 'pending') return ['assigned', 'in_progress'].includes(item.enrollmentStatus);
    if (filter === 'submitted') return item.enrollmentStatus === 'submitted';
    if (filter === 'evaluated') return item.enrollmentStatus === 'evaluated';
    return true;
  });

  if (loading) {
    return (
      <div className="assignment-dashboard-container">
        <div className="loading">Loading assignments...</div>
      </div>
    );
  }

  return (
    <div className="container student-dashboard assignment-dashboard-container">
      <div className="dashboard-header">
        <h1>Project Assignments</h1>
        <p className="dashboard-subtitle">
          Build real-world projects and get AI-powered feedback
        </p>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="filter-tabs">
        <button
          className={filter === 'all' ? 'active' : ''}
          onClick={() => setFilter('all')}
        >
          All ({assignments.length})
        </button>
        <button
          className={filter === 'pending' ? 'active' : ''}
          onClick={() => setFilter('pending')}
        >
          Pending ({assignments.filter(a => ['assigned', 'in_progress'].includes(a.enrollmentStatus)).length})
        </button>
        <button
          className={filter === 'submitted' ? 'active' : ''}
          onClick={() => setFilter('submitted')}
        >
          Submitted ({assignments.filter(a => a.enrollmentStatus === 'submitted').length})
        </button>
        <button
          className={filter === 'evaluated' ? 'active' : ''}
          onClick={() => setFilter('evaluated')}
        >
          Evaluated ({assignments.filter(a => a.enrollmentStatus === 'evaluated').length})
        </button>
      </div>

      <Link to="/student/dashboard" className="btn btn-secondary" style={{ marginBottom: 20 }}>
        ← Back to Dashboard
      </Link>

      {filteredAssignments.length === 0 ? (
        <div className="empty-state">
          <p>No assignments found</p>
        </div>
      ) : (
        <div className="tests-grid">
          {filteredAssignments.map(item => {
            const status = item.enrollmentStatus || 'assigned';
            const assignment = item.assignment;
            const submissionId = item.submission?._id ?? item.submission;
            return (
              <div
                key={assignment._id}
                className={`test-card-modern ${item.isOverdue && status !== 'evaluated' ? 'overdue' : ''}`}
              >
                <div className="test-card-header">
                  <div className="test-title-section">
                    <h3>{assignment.title}</h3>
                    <span className="test-type-badge-modern project">project</span>
                  </div>
                </div>
                <div className="test-meta">
                  <div className="test-meta-item">
                    <strong>Duration:</strong> {assignment.duration} min
                  </div>
                  <div className="test-meta-item">
                    <strong>Category:</strong> {assignment.category}
                  </div>
                  <div className="test-meta-item">
                    <strong>Difficulty:</strong> {assignment.difficulty}
                  </div>
                  <div className="test-meta-item">
                    <strong>Marks:</strong> {assignment.totalMarks}
                  </div>
                  {item.deadline && (
                    <div className="test-meta-item">
                      <strong>Deadline:</strong> {new Date(item.deadline).toLocaleString()}
                    </div>
                  )}
                </div>
                <div className="test-status-section">
                  <span className={`status-badge-modern ${item.isOverdue && status !== 'evaluated' ? 'overdue' : status}`}>
                    {item.isOverdue && status !== 'evaluated' ? 'overdue' : status.replace('_', ' ')}
                  </span>
                  {status === 'assigned' && !item.isOverdue && (
                    <Link to={`/student/submit-assignment/${assignment._id}`} className="test-action-btn btn-primary">
                      Start Assignment →
                    </Link>
                  )}
                  {status === 'in_progress' && !item.isOverdue && (
                    <Link to={`/student/submit-assignment/${assignment._id}`} className="test-action-btn btn-secondary">
                      Submit Project →
                    </Link>
                  )}
                  {status === 'submitted' && (
                    <div className="test-action-buttons">
                      {submissionId && (
                        <Link
                          to={`/student/submission/${submissionId}/result`}
                          className="test-action-btn btn-primary"
                        >
                          Check Status →
                        </Link>
                      )}
                      {item.timerEndAt && new Date(item.timerEndAt) > new Date() && (
                        <Link to={`/student/submit-assignment/${assignment._id}`} className="test-action-btn btn-secondary">
                          View / Edit URL →
                        </Link>
                      )}
                    </div>
                  )}
                  {status === 'evaluated' && submissionId && (
                    <Link
                      to={`/student/submission/${submissionId}/result`}
                      className="test-action-btn btn-secondary"
                    >
                      View Result →
                    </Link>
                  )}
                  {item.isOverdue && status === 'assigned' && (
                    <span className="test-action-btn btn-info" style={{ opacity: 0.9 }}>
                      Deadline passed
                    </span>
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

export default AssignmentDashboard;
