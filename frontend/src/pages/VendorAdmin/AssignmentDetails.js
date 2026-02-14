import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axiosInstance from '../../utils/axios';
import RichTextDisplay from '../../components/RichTextDisplay';
import './AssignmentDetails.css';

const AssignmentDetails = () => {
  const { id: assignmentId } = useParams();
  const navigate = useNavigate();
  const [assignment, setAssignment] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchAssignment = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await axiosInstance.get(`/assignments/${assignmentId}`);
      if (data.success) {
        setAssignment(data.assignment);
      }
    } catch (err) {
      console.error('Error fetching assignment:', err);
    } finally {
      setLoading(false);
    }
  }, [assignmentId]);

  useEffect(() => {
    fetchAssignment();
  }, [fetchAssignment]);

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
      <div className="assignment-details-container">
        <div className="loading">Loading assignment details...</div>
      </div>
    );
  }

  if (!assignment) {
    return (
      <div className="assignment-details-container">
        <div className="error-message">Assignment not found.</div>
        <button
          className="back-button"
          onClick={() => navigate('/vendor-admin/tests?type=project')}
        >
          ← Back
        </button>
      </div>
    );
  }

  return (
    <div className="assignment-details-container">
      <div className="assignment-details-header">
        <button
          className="back-button"
          onClick={() => navigate('/vendor-admin/tests?type=project')}
        >
          ← Back
        </button>
        <h1>{assignment.title}</h1>
        <div className="assignment-meta-row">
          <span
            className="status-badge"
            style={{ background: getStatusColor(assignment.status) }}
          >
            {assignment.status}
          </span>
          <span className="meta-chip category">{assignment.category}</span>
          <span
            className="meta-chip difficulty"
            style={{ background: getDifficultyColor(assignment.difficulty) }}
          >
            {assignment.difficulty}
          </span>
          <span className="meta-chip marks">{assignment.totalMarks} marks</span>
          <span className="meta-chip duration">{assignment.duration} min</span>
        </div>
      </div>

      <div className="assignment-details-content">
        {assignment.description && (
          <section className="detail-section">
            <h2>Description</h2>
            <div className="rich-content">
              <RichTextDisplay content={assignment.description} />
            </div>
          </section>
        )}

        {assignment.featureChecklist?.length > 0 && (
          <section className="detail-section">
            <h2>Feature Checklist</h2>
            <ul className="feature-list">
              {assignment.featureChecklist.map((f, i) => (
                <li key={i}>
                  <strong>{f.feature}</strong>
                  {f.marks > 0 && <span className="feature-marks"> ({f.marks} marks)</span>}
                  {f.required && <span className="required-badge">Required</span>}
                  {f.description && (
                    <div className="feature-description">
                      <RichTextDisplay content={f.description} />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {assignment.additionalInstructions && (
          <section className="detail-section">
            <h2>Additional Instructions</h2>
            <div className="rich-content">
              <RichTextDisplay content={assignment.additionalInstructions} />
            </div>
          </section>
        )}

        {assignment.deadline && (
          <section className="detail-section">
            <h2>Deadline</h2>
            <p>{new Date(assignment.deadline).toLocaleString()}</p>
          </section>
        )}

        <div className="detail-actions">
          <button
            className="action-btn edit"
            onClick={() => navigate(`/vendor-admin/assignments/${assignmentId}/edit`)}
          >
            Edit Assignment
          </button>
          <button
            className="action-btn primary"
            onClick={() => navigate(`/vendor-admin/assignments/${assignmentId}/assign`)}
          >
            Assign to Students
          </button>
          <button
            className="action-btn secondary"
            onClick={() => navigate(`/vendor-admin/assignments/${assignmentId}/submissions`)}
          >
            View Submissions ({assignment.totalSubmitted || 0})
          </button>
          <button
            className="action-btn secondary"
            onClick={() => navigate('/vendor-admin/assignments')}
          >
            Back to List
          </button>
        </div>
      </div>
    </div>
  );
};

export default AssignmentDetails;
