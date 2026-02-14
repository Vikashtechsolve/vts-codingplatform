import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import axiosInstance from '../../utils/axios';
import './VendorAdminCommon.css';
import './TestResults.css';

const AssignmentSubmissions = () => {
  const { id: assignmentId } = useParams();
  const [submissions, setSubmissions] = useState([]);
  const [assignment, setAssignment] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [submissionsRes, assignmentRes] = await Promise.all([
        axiosInstance.get(`/project-submissions/assignment/${assignmentId}`),
        axiosInstance.get(`/assignments/${assignmentId}`)
      ]);
      if (submissionsRes.data?.success) {
        setSubmissions(submissionsRes.data.submissions || []);
      }
      if (assignmentRes.data?.success) {
        setAssignment(assignmentRes.data.assignment);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }, [assignmentId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRetry = async (submissionId) => {
    if (!window.confirm('Retry evaluation for this submission?')) return;
    try {
      await axiosInstance.post(`/project-submissions/${submissionId}/retry-evaluation`);
      alert('Evaluation queued for retry');
      fetchData();
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to retry');
    }
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  const getScoreClass = (percentage) => {
    if (!percentage && percentage !== 0) return '';
    if (percentage >= 70) return 'excellent';
    if (percentage >= 50) return 'good';
    return 'poor';
  };

  return (
    <div className="container test-results-page">
      <div className="page-header">
        <div>
          <Link to="/vendor-admin/tests?type=project" className="btn btn-secondary" style={{ marginBottom: '20px' }}>
            ← Back to Tests
          </Link>
          <h1 className="page-title">Submissions: {assignment?.title || 'Assignment'}</h1>
        </div>
      </div>

      <div className="results-table-card">
        <h2>Project Submissions ({submissions.length})</h2>
        {submissions.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📊</div>
            <h2>No Submissions Yet</h2>
            <p>No students have submitted this project yet.</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="results-table-modern">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Email</th>
                  <th>Score</th>
                  <th>Grade</th>
                  <th>Status</th>
                  <th>Submitted At</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {submissions.map(sub => (
                  <tr key={sub._id}>
                    <td><strong>{sub.studentId?.name || 'N/A'}</strong></td>
                    <td>{sub.studentId?.email || 'N/A'}</td>
                    <td>
                      {sub.evaluationResult ? (
                        <strong>{sub.evaluationResult.totalScore} / {assignment?.totalMarks || 100}</strong>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td>
                      {sub.evaluationResult?.grade ? (
                        <span className={`score-badge-result ${getScoreClass(sub.evaluationResult.percentage)}`}>
                          {sub.evaluationResult.grade} ({sub.evaluationResult.percentage}%)
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td>
                      <span className={`status-badge ${sub.status === 'evaluated' ? 'active' : 'inactive'}`}>
                        {sub.status}
                      </span>
                    </td>
                    <td>{sub.submittedAt ? new Date(sub.submittedAt).toLocaleString() : 'N/A'}</td>
                    <td>
                      {sub.status === 'evaluated' && (
                        <Link
                          to={`/vendor-admin/submission/${sub._id}/result`}
                          state={{
                            backPath: `/vendor-admin/assignments/${assignmentId}/submissions`,
                            backLabel: 'Back to Submissions'
                          }}
                          className="btn btn-sm btn-primary"
                        >
                          View Result
                        </Link>
                      )}
                      {sub.status === 'failed' && (
                        <button
                          onClick={() => handleRetry(sub._id)}
                          className="btn btn-sm btn-secondary"
                        >
                          Retry Evaluation
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AssignmentSubmissions;
