import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axiosInstance from '../../utils/axios';
import RichTextDisplay from '../../components/RichTextDisplay';
import './AssignmentList.css';

const AssignmentList = () => {
  const navigate = useNavigate();
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');

  useEffect(() => {
    fetchAssignments();
  }, []);

  const fetchAssignments = async () => {
    try {
      setLoading(true);
      const { data } = await axiosInstance.get('/assignments');
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

  const handleDelete = async (assignmentId, submissionCount = 0) => {
    const message = submissionCount > 0
      ? `Are you sure you want to delete this assignment? ${submissionCount} submission(s) and all related results will be permanently deleted. This cannot be undone.`
      : 'Are you sure you want to delete this assignment? This action cannot be undone.';
    if (!window.confirm(message)) return;

    try {
      const { data } = await axiosInstance.delete(`/assignments/${assignmentId}`);
      if (data.success) {
        alert('Assignment deleted successfully!');
        fetchAssignments();
      } else {
        alert(data.message);
      }
    } catch (err) {
      console.error('Error deleting assignment:', err);
      alert('Failed to delete assignment');
    }
  };

  const filteredAssignments = assignments.filter(assignment => {
    if (filterStatus !== 'all' && assignment.status !== filterStatus) return false;
    if (filterCategory !== 'all' && assignment.category !== filterCategory) return false;
    return true;
  });

  const getDifficultyColor = (difficulty) => {
    switch (difficulty) {
      case 'easy': return '#4caf50';
      case 'medium': return '#ff9800';
      case 'hard': return '#f44336';
      default: return '#999';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return '#4caf50';
      case 'draft': return '#ff9800';
      case 'archived': return '#999';
      default: return '#999';
    }
  };

  if (loading) {
    return (
      <div className="assignment-list-container">
        <div className="loading">Loading assignments...</div>
      </div>
    );
  }

  return (
    <div className="assignment-list-container">
      <div className="assignment-list-header">
        <h1>📚 Project Assignments</h1>
        <button 
          className="create-button"
          onClick={() => navigate('/vendor-admin/create-assignment')}
        >
          + Create Assignment
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="filters-section">
        <div className="filter-group">
          <label>Status:</label>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="all">All</option>
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            <option value="archived">Archived</option>
          </select>
        </div>

        <div className="filter-group">
          <label>Category:</label>
          <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
            <option value="all">All</option>
            <option value="frontend">Frontend</option>
            <option value="backend">Backend</option>
            <option value="fullstack">Full Stack</option>
            <option value="mobile">Mobile</option>
            <option value="devops">DevOps</option>
            <option value="data-science">Data Science</option>
          </select>
        </div>
      </div>

      {filteredAssignments.length === 0 ? (
        <div className="empty-state">
          <p>No assignments found</p>
          <button onClick={() => navigate('/vendor-admin/create-assignment')}>
            Create Your First Assignment
          </button>
        </div>
      ) : (
        <div className="assignments-grid">
          {filteredAssignments.map(assignment => (
            <div key={assignment._id} className="assignment-card">
              <div className="assignment-card-header">
                <h3>{assignment.title}</h3>
                <span 
                  className="status-badge"
                  style={{ background: getStatusColor(assignment.status) }}
                >
                  {assignment.status}
                </span>
              </div>

              <p className="assignment-description">
                <RichTextDisplay content={assignment.description} truncate={120} />
              </p>

              <div className="assignment-meta">
                <div className="meta-item">
                  <span className="meta-label">Category:</span>
                  <span className="meta-value">{assignment.category}</span>
                </div>
                <div className="meta-item">
                  <span className="meta-label">Difficulty:</span>
                  <span 
                    className="meta-value difficulty"
                    style={{ color: getDifficultyColor(assignment.difficulty) }}
                  >
                    {assignment.difficulty}
                  </span>
                </div>
                <div className="meta-item">
                  <span className="meta-label">Total Marks:</span>
                  <span className="meta-value">{assignment.totalMarks}</span>
                </div>
                <div className="meta-item">
                  <span className="meta-label">Duration:</span>
                  <span className="meta-value">{assignment.duration} min</span>
                </div>
              </div>

              <div className="assignment-stats">
                <div className="stat-item">
                  <span className="stat-value">{assignment.totalAssigned || 0}</span>
                  <span className="stat-label">Assigned</span>
                </div>
                <div className="stat-item">
                  <span className="stat-value">{assignment.totalSubmitted || 0}</span>
                  <span className="stat-label">Submitted</span>
                </div>
                <div className="stat-item">
                  <span className="stat-value">{assignment.totalEvaluated || 0}</span>
                  <span className="stat-label">Evaluated</span>
                </div>
              </div>

              <div className="assignment-deadline">
                Deadline: {new Date(assignment.deadline).toLocaleString()}
              </div>

              <div className="assignment-actions">
                <button
                  className="action-button view"
                  onClick={() => navigate(`/vendor-admin/assignments/${assignment._id}`)}
                >
                  View Details
                </button>

                <button
                  className="action-button edit"
                  onClick={() => navigate(`/vendor-admin/assignments/${assignment._id}/edit`)}
                >
                  Edit
                </button>

                {assignment.status !== 'archived' && (
                  <button
                    className="action-button assign"
                    onClick={() => navigate(`/vendor-admin/assignments/${assignment._id}/assign`)}
                  >
                    Assign to Students
                  </button>
                )}

                <button
                  className="action-button submissions"
                  onClick={() => navigate(`/vendor-admin/assignments/${assignment._id}/submissions`)}
                >
                  Submissions ({assignment.totalSubmitted || 0})
                </button>

                <button
                  className="action-button delete"
                  onClick={() => handleDelete(assignment._id, assignment.totalSubmitted || 0)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AssignmentList;
