import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axiosInstance from '../../utils/axios';
import './StudentAnalysis.css';

const StudentAnalysis = () => {
  const { studentId } = useParams();
  const [student, setStudent] = useState(null);
  const [results, setResults] = useState([]);
  const [interviewSessions, setInterviewSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [interviewSessionsError, setInterviewSessionsError] = useState(null);

  useEffect(() => {
    fetchStudentData();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run when studentId changes
  }, [studentId]);

  const fetchStudentData = async () => {
    try {
      setLoading(true);
      setInterviewSessionsError(null);
      const [studentRes, resultsRes, sessionsRes] = await Promise.all([
        axiosInstance.get(`/vendor-admin/students/${studentId}`),
        axiosInstance.get(`/results/student/${studentId}`),
        axiosInstance.get(`/interview-sessions/student/${studentId}`).catch((err) => {
          setInterviewSessionsError(err.response?.data?.message || err.message || 'Failed to load interview results');
          return { data: [] };
        })
      ]);

      setStudent(studentRes.data);
      setResults(resultsRes.data || []);
      setInterviewSessions(Array.isArray(sessionsRes?.data) ? sessionsRes.data : []);
    } catch (error) {
      console.error('Error fetching student data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getPerformanceStats = () => {
    const completedResults = results.filter(r => r.status === 'completed');
    const totalTests = completedResults.length;
    const totalInterviews = interviewSessions.length;
    const totalScore = completedResults.reduce((sum, r) => sum + (r.totalScore || 0), 0);
    const totalMaxScore = completedResults.reduce((sum, r) => sum + (r.maxScore || 0), 0);
    const averageScore = totalMaxScore > 0 ? Math.round((totalScore / totalMaxScore) * 100) : 0;

    return {
      totalTests,
      totalInterviews,
      totalScore,
      totalMaxScore,
      averageScore,
      completedResults
    };
  };

  const getTestPerformance = (testId) => {
    const tid = typeof testId === 'object' ? testId?._id : testId;
    const testResults = results.filter(r => (r.testId?._id || r.testId) === tid && r.status === 'completed');
    if (testResults.length === 0) return null;

    const avgScore = testResults.reduce((sum, r) => sum + (r.percentage || 0), 0) / testResults.length;
    const bestScore = Math.max(...testResults.map(r => r.percentage || 0));
    const latestResult = testResults[testResults.length - 1];

    return {
      attempts: testResults.length,
      averageScore: Math.round(avgScore),
      bestScore,
      latestScore: latestResult.percentage,
      latestResult
    };
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  if (!student) {
    return (
      <div className="container">
        <div className="error">Student not found</div>
        <Link to="/vendor-admin/students" className="btn btn-secondary">Back to Students</Link>
      </div>
    );
  }

  const stats = getPerformanceStats();

  const getScoreClass = (score) => {
    if (score >= 70) return 'excellent';
    if (score >= 50) return 'good';
    return 'poor';
  };

  return (
    <div className="container student-analysis-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Student Analysis</h1>
          <p className="student-info-subtitle">{student.name} ({student.email})</p>
        </div>
        <Link to="/vendor-admin/students" className="btn btn-secondary">
          ← Back to Students
        </Link>
      </div>

      <div className="stats-grid-modern">
        <div className="stat-card-analysis tests">
          <h3>Tests Completed</h3>
          <p className="stat-number-analysis">{stats.totalTests}</p>
        </div>
        <div className="stat-card-analysis interviews">
          <h3>Interview</h3>
          <p className="stat-number-analysis">{stats.totalInterviews}</p>
        </div>
        <div className="stat-card-analysis average">
          <h3>Test Avg Score</h3>
          <p className="stat-number-analysis">{stats.averageScore}%</p>
        </div>
        <div className="stat-card-analysis total">
          <h3>Total Score (Tests)</h3>
          <p className="stat-number-analysis">{stats.totalScore}/{stats.totalMaxScore}</p>
        </div>
        <div className="stat-card-analysis status">
          <h3>Status</h3>
          <p className="stat-number-analysis" style={{ fontSize: '1.2em' }}>
            <span className={`status-badge ${student.isActive ? 'active' : 'inactive'}`}>
              {student.isActive ? 'Active' : 'Inactive'}
            </span>
          </p>
        </div>
      </div>

      <div className="performance-section">
        <h2 className="section-title-analysis">Test Performance</h2>
        <div className="performance-table-card">
          {results.length === 0 ? (
            <div className="empty-state-analysis">
              <p>No test results available for this student.</p>
            </div>
          ) : (
            <div className="table-container">
              <table className="performance-table">
                <thead>
                  <tr>
                    <th>Test Title</th>
                    <th>Type</th>
                    <th>Attempts</th>
                    <th>Latest Score</th>
                    <th>Best Score</th>
                    <th>Average Score</th>
                    <th>Last Attempt</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from(new Set(results.map(r => r.testId?._id || r.testId).filter(Boolean))).map(testId => {
                    const testResults = results.filter(r => (r.testId?._id || r.testId) === testId);
                    const test = testResults[0]?.testId;
                    const performance = getTestPerformance(testId);
                    
                    if (!performance || !test) return null;

                    return (
                      <tr key={testId}>
                        <td><strong>{test?.title || 'Test'}</strong></td>
                        <td>
                          <span className={`question-type-badge ${test?.type || 'test'}`}>
                            {(test?.type || 'test').toUpperCase()}
                          </span>
                        </td>
                        <td>{performance.attempts}</td>
                        <td>
                          <span className={`score-badge ${getScoreClass(performance.latestScore)}`}>
                            {performance.latestScore}%
                          </span>
                        </td>
                        <td>
                          <span className="score-badge excellent">{performance.bestScore}%</span>
                        </td>
                        <td>
                          <span className={`score-badge ${getScoreClass(performance.averageScore)}`}>
                            {performance.averageScore}%
                          </span>
                        </td>
                        <td>
                          {performance.latestResult.submittedAt 
                            ? new Date(performance.latestResult.submittedAt).toLocaleDateString()
                            : 'N/A'}
                        </td>
                        <td>
                          <Link 
                            to={`/vendor-admin/results/${performance.latestResult._id}`}
                            className="btn btn-sm btn-primary"
                          >
                            View Details
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="performance-section">
        <h2 className="section-title-analysis">Interview Results</h2>
        <div className="performance-table-card">
          {interviewSessionsError ? (
            <div className="empty-state-analysis" style={{ color: 'var(--error, #c62828)' }}>
              <p>{interviewSessionsError}</p>
            </div>
          ) : interviewSessions.length === 0 ? (
            <div className="empty-state-analysis">
              <p>No interview results for this student.</p>
            </div>
          ) : (
            <div className="table-container">
              <table className="performance-table">
                <thead>
                  <tr>
                    <th>Interview</th>
                    <th>Type · Topic</th>
                    <th>Score</th>
                    <th>Readiness</th>
                    <th>Submitted</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {interviewSessions.map(session => (
                    <tr key={session._id}>
                      <td><strong>{session.interviewId?.title || 'Interview'}</strong></td>
                      <td>
                        <span className="question-type-badge interview">
                          {session.interviewId?.interviewType || session.interviewType} · {session.interviewId?.topic || session.topic}
                        </span>
                      </td>
                      <td>
                        <span className={`score-badge ${getScoreClass(session.overallScore ?? 0)}`}>
                          {session.overallScore ?? '—'}/100
                        </span>
                      </td>
                      <td>{session.readinessPercent != null ? `${session.readinessPercent}%` : '—'}</td>
                      <td>
                        {session.submittedAt
                          ? new Date(session.submittedAt).toLocaleString()
                          : 'N/A'}
                      </td>
                      <td>
                        <Link
                          to={`/vendor-admin/interviews/results/${session._id}`}
                          className="btn btn-sm btn-primary"
                        >
                          View full analysis
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="performance-section">
        <h2 className="section-title-analysis">Recent Test Attempts</h2>
        <div className="performance-table-card">
          {stats.completedResults.length === 0 ? (
            <div className="empty-state-analysis">
              <p>No completed tests yet.</p>
            </div>
          ) : (
            <div className="table-container">
              <table className="performance-table">
                <thead>
                  <tr>
                    <th>Test Title</th>
                    <th>Score</th>
                    <th>Percentage</th>
                    <th>Time Spent</th>
                    <th>Submitted At</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.completedResults.slice(0, 10).map(result => (
                    <tr key={result._id}>
                      <td><strong>{result.testId?.title || 'Test'}</strong></td>
                      <td>{result.totalScore}/{result.maxScore}</td>
                      <td>
                        <span className={`score-badge ${getScoreClass(result.percentage)}`}>
                          {result.percentage}%
                        </span>
                      </td>
                      <td>
                        {result.timeSpent 
                          ? `${Math.floor(result.timeSpent / 60)}m ${result.timeSpent % 60}s`
                          : 'N/A'}
                      </td>
                      <td>
                        {result.submittedAt 
                          ? new Date(result.submittedAt).toLocaleString()
                          : 'N/A'}
                      </td>
                      <td>
                        <Link 
                          to={`/vendor-admin/results/${result._id}`}
                          className="btn btn-sm btn-primary"
                        >
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
      </div>
    </div>
  );
};

export default StudentAnalysis;

