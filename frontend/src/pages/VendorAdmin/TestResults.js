import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axiosInstance from '../../utils/axios';
import './VendorAdminCommon.css';
import './TestResults.css';

const TestResults = () => {
  const { testId } = useParams();
  const [results, setResults] = useState([]);
  const [test, setTest] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchResults();
    fetchTest();
  }, [testId]);

  const fetchResults = async () => {
    try {
      const response = await axiosInstance.get(`/vendor-admin/tests/${testId}/results`);
      setResults(response.data);
    } catch (error) {
      console.error('Error fetching results:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTest = async () => {
    try {
      const response = await axiosInstance.get(`/tests/${testId}`);
      setTest(response.data);
    } catch (error) {
      console.error('Error fetching test:', error);
    }
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  const getScoreClass = (percentage) => {
    if (percentage >= 70) return 'excellent';
    if (percentage >= 50) return 'good';
    return 'poor';
  };

  return (
    <div className="container test-results-page">
      <div className="page-header">
        <div>
          <Link to="/vendor-admin/tests" className="btn btn-secondary" style={{ marginBottom: '20px' }}>
            ← Back to Tests
          </Link>
          <h1 className="page-title">Test Results: {test?.title}</h1>
        </div>
      </div>

      <div className="results-table-card">
        <h2>Submissions ({results.length})</h2>
        {results.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📊</div>
            <h2>No Submissions Yet</h2>
            <p>No students have submitted this test yet.</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="results-table-modern">
              <thead>
                <tr>
                  <th>Student Name</th>
                  <th>Email</th>
                  <th>Score</th>
                  <th>Percentage</th>
                  <th>Status</th>
                  <th>Submitted At</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {results.map(result => (
                  <tr key={result._id}>
                    <td><strong>{result.studentId?.name || 'N/A'}</strong></td>
                    <td>{result.studentId?.email || 'N/A'}</td>
                    <td><strong>{result.totalScore} / {result.maxScore}</strong></td>
                    <td>
                      <span className={`score-badge-result ${getScoreClass(result.percentage)}`}>
                        {result.percentage}%
                      </span>
                    </td>
                    <td>
                      <span className={`status-badge ${result.status === 'completed' ? 'active' : 'inactive'}`}>
                        {result.status}
                      </span>
                    </td>
                    <td>{result.submittedAt ? new Date(result.submittedAt).toLocaleString() : 'N/A'}</td>
                    <td>
                      <Link to={`/vendor-admin/results/${result._id}`} className="btn btn-sm btn-primary">
                        View Details
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {results.length > 0 && (
        <div className="stats-card-modern">
          <h2>Statistics</h2>
          <div className="stats-grid-results">
            <div className="stat-card-result">
              <h3>Average Score</h3>
              <p className="stat-number-result">
                {results.length > 0
                  ? Math.round(results.reduce((sum, r) => sum + (r.percentage || 0), 0) / results.length)
                  : 0}%
              </p>
            </div>
            <div className="stat-card-result">
              <h3>Highest Score</h3>
              <p className="stat-number-result">
                {results.length > 0
                  ? Math.max(...results.map(r => r.percentage || 0))
                  : 0}%
              </p>
            </div>
            <div className="stat-card-result">
              <h3>Lowest Score</h3>
              <p className="stat-number-result">
                {results.length > 0
                  ? Math.min(...results.map(r => r.percentage || 0))
                  : 0}%
              </p>
            </div>
            <div className="stat-card-result">
              <h3>Completed</h3>
              <p className="stat-number-result">
                {results.filter(r => r.status === 'completed').length}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TestResults;

