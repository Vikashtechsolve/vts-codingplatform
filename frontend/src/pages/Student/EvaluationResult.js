import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import axiosInstance from '../../utils/axios';
import './EvaluationResult.css';

const EvaluationResult = () => {
  const { submissionId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const backPath = location.state?.backPath || '/student/assignments';
  const backLabel = location.state?.backLabel || 'Back to Dashboard';
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [evalStatus, setEvalStatus] = useState(null);

  const getStatusInfo = (status) => {
    switch (status) {
      case 'pending_evaluation':
        return { icon: '⏳', title: 'Evaluation Pending', message: 'Your submission is in the queue and will be evaluated shortly. Please check back later.' };
      case 'evaluating':
        return { icon: '🔄', title: 'Evaluation In Progress', message: 'Your project is currently being evaluated by AI. This may take a few minutes.' };
      case 'failed':
        return { icon: '⚠️', title: 'Evaluation Failed', message: 'Something went wrong during evaluation. Please contact your instructor or try again later.' };
      default:
        return { icon: '📋', title: 'Not Yet Evaluated', message: 'Your submission has not been evaluated yet. Please check back later.' };
    }
  };

  const fetchEvaluationResult = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await axiosInstance.get(`/project-submissions/${submissionId}/result`);
      if (data.success) {
        setResult(data.result);
      } else {
        setEvalStatus(data.status || null);
        setError(data.message || 'Failed to fetch evaluation result');
      }
    } catch (err) {
      const respData = err.response?.data;
      if (respData?.status && respData.status !== 'evaluated') {
        setEvalStatus(respData.status);
        setError(respData.message || 'Submission not yet evaluated');
      } else {
        setError('Failed to fetch evaluation result. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }, [submissionId]);

  useEffect(() => {
    fetchEvaluationResult();
  }, [fetchEvaluationResult]);

  const getGradeColor = (grade) => {
    const colors = {
      'A+': '#4caf50',
      'A': '#66bb6a',
      'B+': '#9ccc65',
      'B': '#d4e157',
      'C+': '#ffee58',
      'C': '#ffa726',
      'D': '#ff7043',
      'F': '#f44336'
    };
    return colors[grade] || '#999';
  };

  const getSeverityColor = (severity) => {
    const colors = {
      'critical': '#f44336',
      'high': '#ff9800',
      'medium': '#ffc107',
      'low': '#2196f3'
    };
    return colors[severity] || '#999';
  };

  if (loading) {
    return (
      <div className="evaluation-result-container">
        <div className="loading">Loading evaluation results...</div>
      </div>
    );
  }

  if (error) {
    const statusInfo = evalStatus ? getStatusInfo(evalStatus) : null;

    return (
      <div className="evaluation-result-container">
        {statusInfo ? (
          <div className="eval-status-card">
            <div className="eval-status-icon">{statusInfo.icon}</div>
            <h2 className="eval-status-title">{statusInfo.title}</h2>
            <p className="eval-status-message">{statusInfo.message}</p>
          </div>
        ) : (
          <div className="error-message">{error}</div>
        )}
        <button className="back-dashboard-button" onClick={() => navigate(backPath)}>
          {backLabel}
        </button>
      </div>
    );
  }

  if (!result) {
    return null;
  }

  return (
    <div className="evaluation-result-container">
      <div className="result-header">
        <button className="back-button" onClick={() => navigate(backPath)}>
          ← {backLabel}
        </button>
        <h1>📊 Evaluation Results</h1>
      </div>

      {/* Overall Score Card */}
      <div className="score-card">
        <div className="score-card-left">
          <div className="grade-circle" style={{ borderColor: getGradeColor(result.grade) }}>
            <span className="grade-text" style={{ color: getGradeColor(result.grade) }}>
              {result.grade}
            </span>
          </div>
          <div className="performance-level">
            {result.overallFeedback?.performanceLevel || 'Good'}
          </div>
        </div>
        <div className="score-card-right">
          <h2>{result.assignmentId?.title}</h2>
          <div className="score-details">
            <div className="score-item">
              <span className="score-label">Total Score</span>
              <span className="score-value">
                {result.totalScore} / {result.totalPossibleScore}
              </span>
            </div>
            <div className="score-item">
              <span className="score-label">Percentage</span>
              <span className="score-value">{result.percentage}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Category Scores */}
      <div className="section-card">
        <h3>📈 Category-wise Performance</h3>
        <div className="categories-grid">
          {Object.entries(result.categoryScores || {}).map(([key, value]) => (
            <div key={key} className="category-item">
              <div className="category-header">
                <span className="category-name">
                  {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                </span>
                <span className="category-score">
                  {value.score?.toFixed(1)}/{value.maxScore}
                </span>
              </div>
              <div className="category-bar">
                <div
                  className="category-bar-fill"
                  style={{ width: `${value.percentage}%` }}
                />
              </div>
              <span className="category-percentage">{value.percentage?.toFixed(1)}%</span>
            </div>
          ))}
        </div>
      </div>

      {/* Feature Evaluation */}
      <div className="section-card">
        <h3>✅ Feature Implementation</h3>
        <div className="features-list">
          {result.featureEvaluation?.map((feature, index) => (
            <div key={index} className="feature-item">
              <div className="feature-header">
                <div className="feature-title">
                  <span className={`feature-status status-${feature.status}`}>
                    {feature.status === 'implemented' ? '✓' : 
                     feature.status === 'partial' ? '◐' : '✗'}
                  </span>
                  <span className="feature-name">{feature.feature}</span>
                </div>
                <span className="feature-marks">
                  {feature.scoredMarks}/{feature.expectedMarks}
                </span>
              </div>
              <p className="feature-analysis">{feature.aiAnalysis}</p>
              {feature.suggestions?.length > 0 && (
                <div className="feature-suggestions">
                  <strong>Suggestions:</strong>
                  <ul>
                    {feature.suggestions.map((suggestion, idx) => (
                      <li key={idx}>{suggestion}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* AI Analysis Summary */}
      <div className="section-card">
        <h3>🤖 AI Analysis</h3>
        <p className="analysis-summary">{result.aiAnalysis?.summary}</p>

        <div className="analysis-section">
          <h4>💪 Strengths</h4>
          <ul className="analysis-list strengths">
            {result.aiAnalysis?.strengths?.map((strength, index) => (
              <li key={index}>{strength}</li>
            ))}
          </ul>
        </div>

        <div className="analysis-section">
          <h4>🎯 Areas for Improvement</h4>
          <ul className="analysis-list improvements">
            {result.aiAnalysis?.weaknesses?.map((weakness, index) => (
              <li key={index}>{weakness}</li>
            ))}
          </ul>
        </div>
      </div>

      {/* Code Quality Issues */}
      {result.aiAnalysis?.codeQualityIssues?.length > 0 && (
        <div className="section-card">
          <h3>🔍 Code Quality Issues</h3>
          <div className="issues-list">
            {result.aiAnalysis.codeQualityIssues.map((issue, index) => (
              <div key={index} className="issue-item">
                <div className="issue-header">
                  <span 
                    className="issue-severity"
                    style={{ background: getSeverityColor(issue.severity) }}
                  >
                    {issue.severity}
                  </span>
                  <span className="issue-location">{issue.location}</span>
                </div>
                <p className="issue-description">{issue.issue}</p>
                <p className="issue-suggestion">
                  <strong>Fix:</strong> {issue.suggestion}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Security Issues */}
      {result.aiAnalysis?.securityIssues?.length > 0 && (
        <div className="section-card security-section">
          <h3>🔒 Security Issues</h3>
          <div className="issues-list">
            {result.aiAnalysis.securityIssues.map((issue, index) => (
              <div key={index} className="issue-item">
                <div className="issue-header">
                  <span 
                    className="issue-severity"
                    style={{ background: getSeverityColor(issue.severity) }}
                  >
                    {issue.severity}
                  </span>
                  <span className="issue-location">{issue.location}</span>
                </div>
                <p className="issue-description">{issue.issue}</p>
                <p className="issue-suggestion">
                  <strong>Fix:</strong> {issue.suggestion}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Commit & Late Commit Analysis */}
      {result.commitAnalysis && (
        <div className={`section-card commit-analysis-card ${result.commitAnalysis.hasLateCommits ? 'has-penalty' : ''}`}>
          <h3>📋 Commit Analysis</h3>
          <div className="commit-analysis-summary">
            <div className="commit-stats-row">
              <div className="commit-stat">
                <span className="commit-stat-label">Total Commits</span>
                <span className="commit-stat-value">{result.commitAnalysis.totalCommits}</span>
              </div>
              <div className="commit-stat">
                <span className="commit-stat-label">Last Commit</span>
                <span className="commit-stat-value">
                  {result.commitAnalysis.lastCommitAt
                    ? new Date(result.commitAnalysis.lastCommitAt).toLocaleString()
                    : '—'}
                </span>
              </div>
              {result.commitAnalysis.timerEndAt && (
                <div className="commit-stat">
                  <span className="commit-stat-label">Timer Ended</span>
                  <span className="commit-stat-value">
                    {new Date(result.commitAnalysis.timerEndAt).toLocaleString()}
                  </span>
                </div>
              )}
            </div>
            {result.commitAnalysis.lastCommitHash && (
              <div className="last-commit-detail">
                <strong>Latest commit:</strong>{' '}
                <code>{result.commitAnalysis.lastCommitHash}</code>
                {result.commitAnalysis.lastCommitMessage && (
                  <span className="commit-message-preview"> — {result.commitAnalysis.lastCommitMessage}</span>
                )}
              </div>
            )}
            <div className={`commit-penalty-box ${result.commitAnalysis.hasLateCommits ? 'penalty' : 'ok'}`}>
              <h4>{result.commitAnalysis.hasLateCommits ? '⚠️ Late Commits Detected' : '✅ All Commits On Time'}</h4>
              <p>{result.commitAnalysis.summary}</p>
              {result.commitAnalysis.hasLateCommits && (
                <>
                  <div className="penalty-detail">
                    <strong>Minutes after timer:</strong> {result.commitAnalysis.minutesLate} min
                  </div>
                  <div className="penalty-detail">
                    <strong>Penalty applied:</strong> -{result.commitAnalysis.latePenaltyMarks} marks
                  </div>
                  {result.commitAnalysis.lateCommits?.length > 0 && (
                    <div className="late-commits-list">
                      <h5>Commits made after timer ended:</h5>
                      {result.commitAnalysis.lateCommits.map((c, i) => (
                        <div key={i} className="late-commit-item">
                          <span className="late-commit-hash">{c.hash?.substring(0, 7)}</span>
                          <span className="late-commit-msg">{c.message}</span>
                          <span className="late-commit-time">
                            {c.minutesAfterTimer} min after timer · {new Date(c.date).toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Git Analysis */}
      {result.gitAnalysis?.commitQuality && (
        <div className="section-card">
          <h3>📝 Git Practices</h3>
          <div className="git-stats">
            <div className="git-stat">
              <span className="git-stat-label">Commit Quality Score</span>
              <span className="git-stat-value">{result.gitAnalysis.commitQuality.score}/10</span>
            </div>
            <div className="git-stat">
              <span className="git-stat-label">Good Commits</span>
              <span className="git-stat-value good">{result.gitAnalysis.commitQuality.goodCommits}</span>
            </div>
            <div className="git-stat">
              <span className="git-stat-label">Poor Commits</span>
              <span className="git-stat-value poor">{result.gitAnalysis.commitQuality.poorCommits}</span>
            </div>
          </div>
          {result.gitAnalysis.commitQuality.examples?.length > 0 && (
            <div className="commit-examples">
              <h4>Commit Examples:</h4>
              {result.gitAnalysis.commitQuality.examples.map((example, index) => (
                <div key={index} className={`commit-example ${example.quality}`}>
                  <div className="commit-message">{example.message}</div>
                  <div className="commit-feedback">{example.feedback}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Documentation Analysis */}
      {result.documentationAnalysis?.readmeQuality && (
        <div className="section-card">
          <h3>📚 Documentation Quality</h3>
          <div className="doc-score">
            README Score: {result.documentationAnalysis.readmeQuality.score}/10
          </div>
          <div className="doc-checklist">
            <div className={`doc-item ${result.documentationAnalysis.readmeQuality.hasSetupInstructions ? 'yes' : 'no'}`}>
              {result.documentationAnalysis.readmeQuality.hasSetupInstructions ? '✓' : '✗'} Setup Instructions
            </div>
            <div className={`doc-item ${result.documentationAnalysis.readmeQuality.hasFeatureDescription ? 'yes' : 'no'}`}>
              {result.documentationAnalysis.readmeQuality.hasFeatureDescription ? '✓' : '✗'} Feature Description
            </div>
            <div className={`doc-item ${result.documentationAnalysis.readmeQuality.hasUsageExamples ? 'yes' : 'no'}`}>
              {result.documentationAnalysis.readmeQuality.hasUsageExamples ? '✓' : '✗'} Usage Examples
            </div>
            <div className={`doc-item ${result.documentationAnalysis.readmeQuality.hasDependencies ? 'yes' : 'no'}`}>
              {result.documentationAnalysis.readmeQuality.hasDependencies ? '✓' : '✗'} Dependencies List
            </div>
          </div>
          <p className="doc-feedback">{result.documentationAnalysis.readmeQuality.feedback}</p>
        </div>
      )}

      {/* Overall Feedback - Detailed */}
      <div className="section-card feedback-card feedback-card-detailed">
        <h3>💡 Detailed Feedback</h3>
        {result.overallFeedback?.summary && (
          <div className="feedback-summary-block">
            <h4>Summary</h4>
            <p className="feedback-summary">{result.overallFeedback.summary}</p>
          </div>
        )}

        <div className="feedback-grid">
          {result.overallFeedback?.topStrengths?.length > 0 && (
            <div className="feedback-section feedback-strengths">
              <h4>🌟 Top Strengths</h4>
              <ul className="feedback-list-detailed">
                {result.overallFeedback.topStrengths.map((strength, index) => (
                  <li key={index}><span className="bullet">✓</span>{strength}</li>
                ))}
              </ul>
            </div>
          )}

          {result.overallFeedback?.areasForImprovement?.length > 0 && (
            <div className="feedback-section feedback-improvements">
              <h4>🎯 Areas for Improvement</h4>
              <ul className="feedback-list-detailed">
                {result.overallFeedback.areasForImprovement.map((area, index) => (
                  <li key={index}><span className="bullet">→</span>{area}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {result.overallFeedback?.nextSteps?.length > 0 && (
          <div className="feedback-section feedback-next-steps">
            <h4>📝 Recommended Next Steps</h4>
            <ol className="feedback-list-ordered">
              {result.overallFeedback.nextSteps.map((step, index) => (
                <li key={index}>{step}</li>
              ))}
            </ol>
          </div>
        )}

        {result.overallFeedback?.recommendedResources?.length > 0 && (
          <div className="feedback-section feedback-resources">
            <h4>📚 Recommended Resources</h4>
            <ul className="feedback-list-detailed">
              {result.overallFeedback.recommendedResources.map((resource, index) => (
                <li key={index}><span className="bullet">•</span>{resource}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="result-footer">
        <p>Evaluated on: {new Date(result.evaluatedAt).toLocaleString()}</p>
        <button 
          className="back-dashboard-button"
          onClick={() => navigate(backPath)}
        >
          {backLabel}
        </button>
      </div>
    </div>
  );
};

export default EvaluationResult;
