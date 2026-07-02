import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  FiRefreshCw,
  FiFileText,
  FiMessageCircle,
  FiClock,
  FiMail,
  FiHash,
  FiBarChart2,
  FiExternalLink,
  FiAlertCircle,
} from 'react-icons/fi';
import axiosInstance from '../../utils/axios';
import VendorHubPage from '../../components/VendorAdmin/VendorHubPage';
import VendorScoreBadge from '../../components/VendorAdmin/VendorScoreBadge';
import { formatDateTime } from '../../utils/vendorAssessmentUi';
import './StudentAnalysis.css';

const ACCENT = '#059669';

const getInitials = (name) => {
  if (!name) return '?';
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
};

const formatDuration = (seconds) => {
  if (seconds == null) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
};

const formatShortDate = (value) => {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleDateString(undefined, { dateStyle: 'medium' });
  } catch {
    return '—';
  }
};

const TYPE_LABELS = {
  coding: 'Coding',
  mcq: 'MCQ',
  aptitude: 'Aptitude',
  theory: 'Theory',
  mixed: 'Mixed',
  sql: 'SQL',
  english: 'English',
};

const StudentAnalysis = () => {
  const { studentId } = useParams();
  const [student, setStudent] = useState(null);
  const [results, setResults] = useState([]);
  const [interviewSessions, setInterviewSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState('');
  const [interviewSessionsError, setInterviewSessionsError] = useState(null);
  const [activeTab, setActiveTab] = useState('tests');

  const fetchStudentData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      setFetchError('');
      setInterviewSessionsError(null);

      const [studentRes, resultsRes, sessionsRes] = await Promise.all([
        axiosInstance.get(`/vendor-admin/students/${studentId}`),
        axiosInstance.get(`/results/student/${studentId}`),
        axiosInstance.get(`/interview-sessions/student/${studentId}`).catch((err) => {
          setInterviewSessionsError(
            err.response?.data?.message || err.message || 'Failed to load interview results'
          );
          return { data: [] };
        }),
      ]);

      setStudent(studentRes.data);
      setResults(resultsRes.data || []);
      setInterviewSessions(Array.isArray(sessionsRes?.data) ? sessionsRes.data : []);
    } catch (error) {
      console.error('Error fetching student data:', error);
      setFetchError(error.response?.data?.message || 'Failed to load student analysis.');
      setStudent(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [studentId]);

  useEffect(() => {
    fetchStudentData();
  }, [fetchStudentData]);

  const completedResults = useMemo(
    () =>
      [...results.filter((r) => r.status === 'completed')].sort(
        (a, b) => new Date(b.submittedAt || 0) - new Date(a.submittedAt || 0)
      ),
    [results]
  );

  const stats = useMemo(() => {
    const totalScore = completedResults.reduce((sum, r) => sum + (r.totalScore || 0), 0);
    const totalMaxScore = completedResults.reduce((sum, r) => sum + (r.maxScore || 0), 0);
    const averageScore =
      totalMaxScore > 0 ? Math.round((totalScore / totalMaxScore) * 100) : 0;
    const bestTestScore = completedResults.length
      ? Math.max(...completedResults.map((r) => r.percentage || 0))
      : null;

    return {
      totalTests: completedResults.length,
      totalInterviews: interviewSessions.length,
      averageScore,
      totalScore,
      totalMaxScore,
      bestTestScore,
      enrolledTests: student?.enrolledTests?.length || 0,
      enrolledInterviews: student?.enrolledInterviews?.length || 0,
      enrolledAssignments: student?.enrolledAssignments?.length || 0,
    };
  }, [completedResults, interviewSessions.length, student]);

  const testPerformanceRows = useMemo(() => {
    const byTest = new Map();

    results.forEach((result) => {
      const testId = result.testId?._id || result.testId;
      if (!testId) return;

      const key = String(testId);
      if (!byTest.has(key)) {
        byTest.set(key, { testId: key, test: result.testId, attempts: [] });
      }
      if (result.status === 'completed') {
        byTest.get(key).attempts.push(result);
      }
    });

    return [...byTest.values()]
      .filter((row) => row.attempts.length > 0)
      .map((row) => {
        const sorted = [...row.attempts].sort(
          (a, b) => new Date(a.submittedAt || 0) - new Date(b.submittedAt || 0)
        );
        const latest = sorted[sorted.length - 1];
        const percentages = sorted.map((r) => r.percentage || 0);
        const averageScore = Math.round(
          percentages.reduce((sum, p) => sum + p, 0) / percentages.length
        );
        const bestScore = Math.max(...percentages);

        return {
          ...row,
          attempts: sorted.length,
          latest,
          averageScore,
          bestScore,
          latestScore: latest.percentage,
        };
      })
      .sort(
        (a, b) =>
          new Date(b.latest?.submittedAt || 0) - new Date(a.latest?.submittedAt || 0)
      );
  }, [results]);

  const sortedInterviews = useMemo(
    () =>
      [...interviewSessions].sort(
        (a, b) => new Date(b.submittedAt || 0) - new Date(a.submittedAt || 0)
      ),
    [interviewSessions]
  );

  const subtitle = student
    ? [
        student.enrollmentNumber ? `Enrollment ${student.enrollmentNumber}` : null,
        student.email,
      ]
        .filter(Boolean)
        .join(' · ')
    : 'Performance across tests and interviews';

  if (!loading && !student) {
    return (
      <VendorHubPage
        className="vsa-page"
        backTo="/vendor-admin/students"
        backLabel="Back to students"
        eyebrow="Student profile"
        title="Student not found"
        subtitle={fetchError || 'This student may have been removed or you may not have access.'}
        accent={ACCENT}
      >
        <div className="vh-panel">
          <div className="vh-panel-body">
            <div className="vh-empty">
              <div className="vh-empty-icon">
                <FiAlertCircle />
              </div>
              <h2>Unable to load profile</h2>
              <p>{fetchError || 'The requested student could not be found.'}</p>
              <Link to="/vendor-admin/students" className="vh-btn vh-btn--primary">
                Return to students
              </Link>
            </div>
          </div>
        </div>
      </VendorHubPage>
    );
  }

  return (
    <VendorHubPage
      className="vsa-page"
      loading={loading}
      backTo="/vendor-admin/students"
      backLabel="Back to students"
      eyebrow="Student profile"
      title={student?.name || 'Student analysis'}
      subtitle={subtitle}
      accent={ACCENT}
      actions={
        <button
          type="button"
          className="vh-btn vh-btn--ghost"
          onClick={() => fetchStudentData(true)}
          disabled={refreshing}
        >
          <FiRefreshCw className={refreshing ? 'vsa-spin' : ''} />
          Refresh
        </button>
      }
    >
      {student && (
        <>
          <section className="vsa-profile">
            <div className="vsa-profile-main">
              <span className="vsa-avatar">{getInitials(student.name)}</span>
              <div className="vsa-profile-text">
                <h2 className="vsa-profile-name">{student.name}</h2>
                <div className="vsa-profile-meta">
                  {student.enrollmentNumber && (
                    <span className="vsa-meta-chip">
                      <FiHash aria-hidden />
                      {student.enrollmentNumber}
                    </span>
                  )}
                  <span className="vsa-meta-chip">
                    <FiMail aria-hidden />
                    {student.email}
                  </span>
                  <span
                    className={`vh-badge ${
                      student.isActive !== false ? 'vh-badge--active' : 'vh-badge--inactive'
                    }`}
                  >
                    {student.isActive !== false ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
            </div>
            <div className="vsa-profile-side">
              <div className="vsa-enrolled-grid">
                <div className="vsa-enrolled-item">
                  <span className="vsa-enrolled-label">Assigned tests</span>
                  <strong>{stats.enrolledTests}</strong>
                </div>
                <div className="vsa-enrolled-item">
                  <span className="vsa-enrolled-label">Interviews</span>
                  <strong>{stats.enrolledInterviews}</strong>
                </div>
                <div className="vsa-enrolled-item">
                  <span className="vsa-enrolled-label">Projects</span>
                  <strong>{stats.enrolledAssignments}</strong>
                </div>
              </div>
              {stats.averageScore > 0 && (
                <div className="vsa-avg-block">
                  <div className="vsa-avg-head">
                    <span>Test average</span>
                    <strong>{stats.averageScore}%</strong>
                  </div>
                  <div className="vsa-avg-bar" aria-hidden>
                    <span style={{ width: `${Math.min(stats.averageScore, 100)}%` }} />
                  </div>
                </div>
              )}
            </div>
          </section>

          <div className="vh-stats vsa-stats">
            <div className="vh-stat vh-stat--accent">
              <span className="vh-stat-label">Tests completed</span>
              <span className="vh-stat-value">{stats.totalTests}</span>
            </div>
            <div className="vh-stat">
              <span className="vh-stat-label">Interviews</span>
              <span className="vh-stat-value">{stats.totalInterviews}</span>
            </div>
            <div className="vh-stat">
              <span className="vh-stat-label">Avg score</span>
              <span className="vh-stat-value">{stats.averageScore}%</span>
            </div>
            <div className="vh-stat">
              <span className="vh-stat-label">Best test score</span>
              <span className="vh-stat-value">
                {stats.bestTestScore != null ? `${stats.bestTestScore}%` : '—'}
              </span>
            </div>
            <div className="vh-stat">
              <span className="vh-stat-label">Total points</span>
              <span className="vh-stat-value">
                {stats.totalScore}/{stats.totalMaxScore}
              </span>
            </div>
          </div>

          <div className="vsa-tabs" role="tablist" aria-label="Performance sections">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'tests'}
              className={`vsa-tab ${activeTab === 'tests' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('tests')}
            >
              <FiBarChart2 />
              Test performance
              {testPerformanceRows.length > 0 && (
                <span className="vsa-tab-count">{testPerformanceRows.length}</span>
              )}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'interviews'}
              className={`vsa-tab ${activeTab === 'interviews' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('interviews')}
            >
              <FiMessageCircle />
              Interviews
              {sortedInterviews.length > 0 && (
                <span className="vsa-tab-count">{sortedInterviews.length}</span>
              )}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'recent'}
              className={`vsa-tab ${activeTab === 'recent' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('recent')}
            >
              <FiClock />
              Recent attempts
              {completedResults.length > 0 && (
                <span className="vsa-tab-count">{Math.min(completedResults.length, 10)}</span>
              )}
            </button>
          </div>

          {activeTab === 'tests' && (
            <div className="vh-panel">
              <div className="vh-panel-head">
                <div>
                  <h2 className="vh-panel-title">Test performance</h2>
                  <p className="vh-panel-desc">
                    Aggregated scores per assigned test — latest, best, and average attempts.
                  </p>
                </div>
              </div>
              <div className="vh-panel-body vh-panel-body--flush">
                {testPerformanceRows.length === 0 ? (
                  <div className="vh-empty vsa-empty">
                    <div className="vh-empty-icon">
                      <FiFileText />
                    </div>
                    <h2>No test results yet</h2>
                    <p>This student has not completed any assigned tests.</p>
                  </div>
                ) : (
                  <div className="vh-table-wrap">
                    <table className="vh-table">
                      <thead>
                        <tr>
                          <th>Test</th>
                          <th>Type</th>
                          <th>Attempts</th>
                          <th>Latest</th>
                          <th>Best</th>
                          <th>Average</th>
                          <th>Last attempt</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {testPerformanceRows.map((row) => {
                          const test = row.test;
                          const type = test?.type || 'test';
                          return (
                            <tr key={row.testId}>
                              <td>
                                <div className="vh-person">
                                  <div>
                                    <div className="vh-person-name">{test?.title || 'Test'}</div>
                                  </div>
                                </div>
                              </td>
                              <td>
                                <span className={`vsa-type-badge vsa-type-badge--${type}`}>
                                  {TYPE_LABELS[type] || type}
                                </span>
                              </td>
                              <td>{row.attempts}</td>
                              <td>
                                <VendorScoreBadge value={row.latestScore} />
                              </td>
                              <td>
                                <VendorScoreBadge value={row.bestScore} />
                              </td>
                              <td>
                                <VendorScoreBadge value={row.averageScore} />
                              </td>
                              <td className="vh-cell-muted">
                                {formatShortDate(row.latest?.submittedAt)}
                              </td>
                              <td>
                                <Link
                                  to={`/vendor-admin/results/${row.latest._id}`}
                                  className="vh-btn vh-btn--ghost vh-btn--sm"
                                >
                                  View <FiExternalLink />
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
          )}

          {activeTab === 'interviews' && (
            <div className="vh-panel">
              <div className="vh-panel-head">
                <div>
                  <h2 className="vh-panel-title">Interview results</h2>
                  <p className="vh-panel-desc">
                    AI interview sessions with scores, readiness, and full analysis links.
                  </p>
                </div>
              </div>
              <div className="vh-panel-body vh-panel-body--flush">
                {interviewSessionsError ? (
                  <div className="vh-alert vh-alert--error vsa-alert">
                    {interviewSessionsError}
                  </div>
                ) : sortedInterviews.length === 0 ? (
                  <div className="vh-empty vsa-empty">
                    <div className="vh-empty-icon">
                      <FiMessageCircle />
                    </div>
                    <h2>No interview results</h2>
                    <p>This student has not completed any assigned interviews.</p>
                  </div>
                ) : (
                  <div className="vh-table-wrap">
                    <table className="vh-table">
                      <thead>
                        <tr>
                          <th>Interview</th>
                          <th>Type · topic</th>
                          <th>Score</th>
                          <th>Readiness</th>
                          <th>Submitted</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {sortedInterviews.map((session) => (
                          <tr key={session._id}>
                            <td>
                              <div className="vh-person-name">
                                {session.interviewId?.title || 'Interview'}
                              </div>
                            </td>
                            <td>
                              <span className="vsa-type-badge vsa-type-badge--interview">
                                {session.interviewId?.interviewType || session.interviewType || '—'}
                                {' · '}
                                {session.interviewId?.topic || session.topic || '—'}
                              </span>
                            </td>
                            <td>
                              {session.overallScore != null ? (
                                <VendorScoreBadge
                                  value={session.overallScore}
                                  suffix="/100"
                                />
                              ) : (
                                <span className="vh-cell-muted">—</span>
                              )}
                            </td>
                            <td>
                              {session.readinessPercent != null ? (
                                <span className="vsa-readiness">{session.readinessPercent}%</span>
                              ) : (
                                <span className="vh-cell-muted">—</span>
                              )}
                            </td>
                            <td className="vh-cell-muted">
                              {formatDateTime(session.submittedAt)}
                            </td>
                            <td>
                              <Link
                                to={`/vendor-admin/interviews/results/${session._id}`}
                                className="vh-btn vh-btn--ghost vh-btn--sm"
                              >
                                Analysis <FiExternalLink />
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
          )}

          {activeTab === 'recent' && (
            <div className="vh-panel">
              <div className="vh-panel-head">
                <div>
                  <h2 className="vh-panel-title">Recent test attempts</h2>
                  <p className="vh-panel-desc">
                    Last {Math.min(completedResults.length, 10)} completed submissions, newest first.
                  </p>
                </div>
              </div>
              <div className="vh-panel-body vh-panel-body--flush">
                {completedResults.length === 0 ? (
                  <div className="vh-empty vsa-empty">
                    <div className="vh-empty-icon">
                      <FiClock />
                    </div>
                    <h2>No completed attempts</h2>
                    <p>Completed test submissions will appear here with scores and timing.</p>
                  </div>
                ) : (
                  <div className="vh-table-wrap">
                    <table className="vh-table">
                      <thead>
                        <tr>
                          <th>Test</th>
                          <th>Score</th>
                          <th>Percentage</th>
                          <th>Time spent</th>
                          <th>Submitted</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {completedResults.slice(0, 10).map((result) => (
                          <tr key={result._id}>
                            <td>
                              <div className="vh-person-name">
                                {result.testId?.title || 'Test'}
                              </div>
                            </td>
                            <td>
                              {result.totalScore}/{result.maxScore}
                            </td>
                            <td>
                              <VendorScoreBadge value={result.percentage} />
                            </td>
                            <td className="vh-cell-muted">{formatDuration(result.timeSpent)}</td>
                            <td className="vh-cell-muted">
                              {formatDateTime(result.submittedAt)}
                            </td>
                            <td>
                              <Link
                                to={`/vendor-admin/results/${result._id}`}
                                className="vh-btn vh-btn--ghost vh-btn--sm"
                              >
                                View <FiExternalLink />
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
          )}
        </>
      )}
    </VendorHubPage>
  );
};

export default StudentAnalysis;
