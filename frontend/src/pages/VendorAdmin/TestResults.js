import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axiosInstance from '../../utils/axios';
import './VendorAdminCommon.css';
import './TestResults.css';

const SECTION_LABELS = {
  english_grammar: 'Grammar',
  english_vocabulary: 'Vocabulary',
  english_reading: 'Reading',
  english_essay: 'Writing',
  english_speaking: 'Speaking',
  english_listening: 'Listening',
};

const TestResults = () => {
  const { testId } = useParams();
  const [results, setResults] = useState([]);
  const [test, setTest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [speakingAnalytics, setSpeakingAnalytics] = useState(null);

  useEffect(() => {
    fetchResults();
    fetchTest();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run when testId changes
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
      if (response.data?.type === 'english') fetchSpeakingAnalytics();
    } catch (error) {
      console.error('Error fetching test:', error);
    }
  };

  const fetchSpeakingAnalytics = async () => {
    try {
      const response = await axiosInstance.get(`/vendor-admin/tests/${testId}/speaking-analytics`);
      if (response.data?.totalSubmissions > 0) setSpeakingAnalytics(response.data);
    } catch { /* optional */ }
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  const getScoreClass = (percentage) => {
    if (percentage >= 70) return 'excellent';
    if (percentage >= 50) return 'good';
    return 'poor';
  };

  const isEnglishTest = test?.type === 'english';

  const getSectionAnalytics = () => {
    if (!isEnglishTest || results.length === 0) return null;
    const completedResults = results.filter(r => r.status === 'completed');
    if (completedResults.length === 0) return null;

    const sectionTypes = [...new Set(
      completedResults.flatMap(r => (r.sectionScores || []).map(s => s.sectionType))
    )];

    return sectionTypes.map(type => {
      const scores = completedResults
        .map(r => (r.sectionScores || []).find(s => s.sectionType === type))
        .filter(Boolean);
      const percentages = scores.map(s => s.maxScore > 0 ? Math.round((s.score / s.maxScore) * 100) : 0);
      return {
        type,
        label: SECTION_LABELS[type] || type,
        avgPercent: percentages.length > 0 ? Math.round(percentages.reduce((a, b) => a + b, 0) / percentages.length) : 0,
        highest: percentages.length > 0 ? Math.max(...percentages) : 0,
        lowest: percentages.length > 0 ? Math.min(...percentages) : 0,
        count: scores.length,
      };
    });
  };

  const sectionAnalytics = getSectionAnalytics();

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

      {sectionAnalytics && sectionAnalytics.length > 0 && (
        <div className="stats-card-modern">
          <h2>Section-wise Analytics</h2>
          <div className="english-section-analytics-grid">
            {sectionAnalytics.map(sec => (
              <div key={sec.type} className="english-section-analytics-card">
                <h3>{sec.label}</h3>
                <div className="section-analytics-bar-wrap">
                  <div
                    className={`section-analytics-bar ${getScoreClass(sec.avgPercent)}`}
                    style={{ width: `${sec.avgPercent}%` }}
                  />
                </div>
                <div className="section-analytics-stats">
                  <span>Avg: <strong>{sec.avgPercent}%</strong></span>
                  <span>High: <strong>{sec.highest}%</strong></span>
                  <span>Low: <strong>{sec.lowest}%</strong></span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {speakingAnalytics && (
        <div className="stats-card-modern">
          <h2>Speaking Analytics</h2>
          <div className="speaking-analytics-overview">
            <div className="sa-stat">
              <span className="sa-stat-value">{speakingAnalytics.totalSubmissions}</span>
              <span className="sa-stat-label">Submissions</span>
            </div>
            <div className="sa-stat">
              <span className="sa-stat-value">{speakingAnalytics.avgSpeakingRate}</span>
              <span className="sa-stat-label">Avg WPM</span>
            </div>
            <div className="sa-stat">
              <span className="sa-stat-value">{speakingAnalytics.avgFillerWords}</span>
              <span className="sa-stat-label">Avg Filler Words</span>
            </div>
            <div className="sa-stat">
              <span className="sa-stat-value">{speakingAnalytics.avgVocabDiversity}%</span>
              <span className="sa-stat-label">Vocab Diversity</span>
            </div>
          </div>

          <h3 style={{ marginTop: '20px', fontSize: '1em', fontWeight: 700 }}>Skill Breakdown (Avg %)</h3>
          <div className="sa-skills-grid">
            {Object.entries(speakingAnalytics.averages || {}).map(([key, val]) => (
              <div key={key} className="sa-skill-row">
                <span className="sa-skill-label">{key.charAt(0).toUpperCase() + key.slice(1)}</span>
                <div className="sa-skill-bar-wrap">
                  <div className={`sa-skill-bar ${val >= 70 ? 'excellent' : val >= 50 ? 'good' : 'poor'}`} style={{ width: `${val}%` }} />
                </div>
                <span className="sa-skill-value">{val}%</span>
              </div>
            ))}
          </div>

          <h3 style={{ marginTop: '20px', fontSize: '1em', fontWeight: 700 }}>Score Distribution</h3>
          <div className="sa-distribution">
            {Object.entries(speakingAnalytics.distribution || {}).map(([key, count]) => (
              <div key={key} className={`sa-dist-item ${key}`}>
                <span className="sa-dist-label">{key}</span>
                <span className="sa-dist-count">{count}</span>
              </div>
            ))}
          </div>

          {speakingAnalytics.topPerformers && speakingAnalytics.topPerformers.length > 0 && (
            <>
              <h3 style={{ marginTop: '20px', fontSize: '1em', fontWeight: 700 }}>Top Performers</h3>
              <div className="sa-top-list">
                {speakingAnalytics.topPerformers.map((p, i) => (
                  <div key={i} className="sa-top-item">
                    <span className="sa-top-rank">#{i + 1}</span>
                    <span className="sa-top-name">{p.name}</span>
                    <span className="sa-top-score">{p.score}/{p.maxScore}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default TestResults;

