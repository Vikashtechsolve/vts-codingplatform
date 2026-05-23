import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  FiArrowLeft,
  FiAward,
  FiBook,
  FiCheckCircle,
  FiClock,
  FiExternalLink,
  FiGithub,
  FiGitCommit,
  FiAlertTriangle,
  FiShield,
  FiTarget,
  FiTrendingUp,
  FiXCircle,
  FiMinusCircle,
  FiRefreshCw,
  FiLayers,
  FiFileText,
  FiCode,
} from 'react-icons/fi';
import axiosInstance from '../../utils/axios';
import './EvaluationResult.css';

const CATEGORY_META = {
  featureCompletion: { label: 'Feature completion', icon: FiTarget, color: '#6366f1' },
  codeQuality: { label: 'Code quality', icon: FiCode, color: '#0ea5e9' },
  architecture: { label: 'Architecture', icon: FiLayers, color: '#8b5cf6' },
  security: { label: 'Security', icon: FiShield, color: '#dc2626' },
  gitPractices: { label: 'Git practices', icon: FiGitCommit, color: '#059669' },
  documentation: { label: 'Documentation', icon: FiBook, color: '#d97706' },
};

const STATUS_STEPS = ['Submitted', 'Queued', 'AI review', 'Report ready'];

const STATUS_INFO = {
  pending_evaluation: {
    icon: FiClock,
    title: 'Evaluation queued',
    message:
      'Your project is in line for review. Results usually appear within a few minutes once the evaluation window opens.',
    tone: 'pending',
    activeStep: 1,
    badge: 'Waiting in queue',
  },
  evaluating: {
    icon: FiRefreshCw,
    title: 'Evaluation in progress',
    message:
      'Our AI is reviewing your repository — features, code quality, architecture, and documentation. Hang tight.',
    tone: 'progress',
    activeStep: 2,
    badge: 'Reviewing now',
  },
  failed: {
    icon: FiAlertTriangle,
    title: 'Evaluation failed',
    message:
      'Something went wrong during evaluation. Contact your instructor or return to assignments to try again.',
    tone: 'error',
    activeStep: -1,
    badge: 'Needs attention',
  },
};

const gradeColor = (grade) => {
  const map = {
    'A+': '#059669',
    A: '#10b981',
    'B+': '#22c55e',
    B: '#3b82f6',
    'C+': '#eab308',
    C: '#f59e0b',
    D: '#f97316',
    F: '#ef4444',
  };
  return map[grade] || '#64748b';
};

const barColor = (pct) => {
  if (pct >= 80) return '#059669';
  if (pct >= 60) return '#3b82f6';
  if (pct >= 40) return '#f59e0b';
  return '#ef4444';
};

const formatCategoryKey = (key) =>
  CATEGORY_META[key]?.label ||
  key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase());

const severityClass = (s) => `per-severity per-severity--${(s || 'medium').toLowerCase()}`;

const ScoreRing = ({ percentage, grade }) => {
  const r = 54;
  const c = 2 * Math.PI * r;
  const offset = c - (percentage / 100) * c;
  const color = gradeColor(grade);

  return (
    <div className="per-score-ring" style={{ '--ring-color': color }}>
      <svg viewBox="0 0 120 120" className="per-score-ring-svg">
        <circle className="per-score-ring-bg" cx="60" cy="60" r={r} />
        <circle
          className="per-score-ring-fill"
          cx="60"
          cy="60"
          r={r}
          strokeDasharray={c}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="per-score-ring-center">
        <span className="per-score-ring-grade" style={{ color }}>{grade}</span>
        <span className="per-score-ring-pct">{Math.round(percentage)}%</span>
      </div>
    </div>
  );
};

const EvaluationResult = () => {
  const { submissionId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const backPath = location.state?.backPath || '/student/assignments';
  const backLabel = location.state?.backLabel || 'Back to assignments';

  const [result, setResult] = useState(null);
  const [submission, setSubmission] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [evalStatus, setEvalStatus] = useState(null);
  const [featureFilter, setFeatureFilter] = useState('all');
  const [expandedFeatures, setExpandedFeatures] = useState({});

  const fetchSubmission = useCallback(async () => {
    try {
      const { data } = await axiosInstance.get(`/project-submissions/${submissionId}`);
      if (data.success) setSubmission(data.submission);
    } catch {
      setSubmission(null);
    }
  }, [submissionId]);

  const fetchEvaluationResult = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const { data } = await axiosInstance.get(`/project-submissions/${submissionId}/result`);
      if (data.success) {
        setResult(data.result);
        setEvalStatus(null);
        setError('');
      } else {
        setEvalStatus(data.status || null);
        setError(data.message || 'Failed to fetch evaluation result');
        setResult(null);
      }
    } catch (err) {
      const respData = err.response?.data;
      if (respData?.status && respData.status !== 'evaluated') {
        setEvalStatus(respData.status);
        setError(respData.message || 'Submission not yet evaluated');
        setResult(null);
      } else {
        setError('Failed to fetch evaluation result. Please try again.');
        setResult(null);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [submissionId]);

  useEffect(() => {
    fetchSubmission();
    fetchEvaluationResult();
  }, [fetchSubmission, fetchEvaluationResult]);

  useEffect(() => {
    if (!evalStatus || evalStatus === 'evaluated') return undefined;
    const interval = setInterval(() => {
      fetchEvaluationResult(true);
      fetchSubmission();
    }, 12000);
    return () => clearInterval(interval);
  }, [evalStatus, fetchEvaluationResult, fetchSubmission]);

  const featureStats = useMemo(() => {
    const list = result?.featureEvaluation || [];
    return {
      total: list.length,
      implemented: list.filter((f) => f.status === 'implemented').length,
      partial: list.filter((f) => f.status === 'partial').length,
      missing: list.filter((f) => f.status === 'missing' || f.status === 'error').length,
    };
  }, [result]);

  const filteredFeatures = useMemo(() => {
    const list = result?.featureEvaluation || [];
    if (featureFilter === 'all') return list;
    if (featureFilter === 'missing') {
      return list.filter((f) => f.status === 'missing' || f.status === 'error');
    }
    return list.filter((f) => f.status === featureFilter);
  }, [result, featureFilter]);

  const categories = useMemo(() => {
    if (!result?.categoryScores) return [];
    return Object.entries(result.categoryScores).map(([key, value]) => ({
      key,
      ...value,
      meta: CATEGORY_META[key],
    }));
  }, [result]);

  const toggleFeature = (index) => {
    setExpandedFeatures((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  if (loading && !result) {
    return (
      <div className="per-page">
        <div className="per-loading">
          <div className="per-spinner" />
          <p>Loading evaluation report…</p>
        </div>
      </div>
    );
  }

  if (!result && (evalStatus || error)) {
    const info = evalStatus ? STATUS_INFO[evalStatus] : null;
    const StatusIcon = info?.icon || FiAlertTriangle;
    const tone = info?.tone || 'error';
    const isWaiting = tone === 'pending' || tone === 'progress';
    const assignmentMeta = submission?.assignmentId;
    const assignmentTitle =
      typeof assignmentMeta === 'object' ? assignmentMeta?.title : null;
    const activeStep = info?.activeStep ?? -1;

    return (
      <div className="per-page per-page--status" style={{ '--per-accent': '#6366f1' }}>
        <header className="per-status-header">
          <button type="button" className="per-back" onClick={() => navigate(backPath)}>
            <FiArrowLeft /> {backLabel}
          </button>
        </header>

        <div className={`per-status-shell per-status-shell--${tone}`}>
          <div className="per-status-glow" aria-hidden />

          <div className="per-status-main">
            <div className={`per-status-icon-ring per-status-icon-ring--${tone}`}>
              <StatusIcon
                className={
                  tone === 'progress' ? 'per-status-icon per-spin' : 'per-status-icon'
                }
                aria-hidden
              />
            </div>

            {info?.badge && (
              <span className={`per-status-badge per-status-badge--${tone}`}>{info.badge}</span>
            )}

            <h1 className="per-status-title">{info?.title || 'Unable to load results'}</h1>
            <p className="per-status-message">{info?.message || error}</p>

            {assignmentTitle && (
              <div className="per-status-context">
                <span className="per-status-context-label">Project</span>
                <strong>{assignmentTitle}</strong>
                {assignmentMeta?.category && (
                  <span className="per-status-context-pill">{assignmentMeta.category}</span>
                )}
              </div>
            )}

            {submission?.githubRepoUrl && (
              <a
                href={submission.githubRepoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="per-status-repo-link"
              >
                <FiGithub /> View submitted repository
                <FiExternalLink />
              </a>
            )}

            {isWaiting && activeStep >= 0 && (
              <ol className="per-status-steps" aria-label="Evaluation progress">
                {STATUS_STEPS.map((label, idx) => {
                  const done = idx < activeStep;
                  const active = idx === activeStep;
                  return (
                    <li
                      key={label}
                      className={`per-status-step${done ? ' done' : ''}${active ? ' active' : ''}`}
                    >
                      <span className="per-status-step-dot" aria-hidden>
                        {done ? <FiCheckCircle /> : active ? <span className="per-status-step-pulse" /> : null}
                      </span>
                      <span className="per-status-step-label">{label}</span>
                    </li>
                  );
                })}
              </ol>
            )}

            {isWaiting && (
              <div className="per-status-refresh" role="status" aria-live="polite">
                <span className="per-status-refresh-icon per-spin" aria-hidden>
                  <FiRefreshCw />
                </span>
                <div className="per-status-refresh-text">
                  <strong>Checking for results</strong>
                  <span>Auto-refresh every 12 seconds — no need to reload the page</span>
                </div>
                <div className="per-status-refresh-bar" aria-hidden>
                  <span className="per-status-refresh-bar-fill" />
                </div>
              </div>
            )}

            <div className="per-status-actions">
              <button
                type="button"
                className="per-btn per-btn-primary"
                onClick={() => fetchEvaluationResult()}
              >
                <FiRefreshCw /> Check now
              </button>
              <button type="button" className="per-btn per-btn-secondary" onClick={() => navigate(backPath)}>
                {backLabel}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!result) return null;

  const assignment = result.assignmentId;
  const accent = '#6366f1';

  return (
    <div className="per-page" style={{ '--per-accent': accent }}>
      <header className="per-header">
        <button type="button" className="per-back" onClick={() => navigate(backPath)}>
          <FiArrowLeft /> {backLabel}
        </button>
        <div className="per-header-main">
          <span className="per-eyebrow">Project evaluation</span>
          <h1>{assignment?.title || 'Evaluation report'}</h1>
          <div className="per-header-meta">
            {assignment?.category && <span className="per-pill">{assignment.category}</span>}
            {assignment?.difficulty && <span className="per-pill">{assignment.difficulty}</span>}
            {result.evaluatedAt && (
              <span className="per-pill per-pill-muted">
                <FiClock /> {new Date(result.evaluatedAt).toLocaleString()}
              </span>
            )}
            {result.aiModel && <span className="per-pill per-pill-muted">AI · {result.aiModel}</span>}
          </div>
        </div>
      </header>

      {/* Hero score */}
      <section className="per-hero">
        <div className="per-hero-score">
          <ScoreRing percentage={result.percentage} grade={result.grade} />
          <div className="per-hero-labels">
            <span className="per-performance">
              <FiAward /> {result.overallFeedback?.performanceLevel || 'Evaluated'}
            </span>
            <p className="per-score-line">
              <strong>{result.totalScore}</strong>
              <span> / {result.totalPossibleScore} marks</span>
            </p>
          </div>
        </div>
        <div className="per-hero-stats">
          <div className="per-stat">
            <span className="per-stat-value">{featureStats.implemented}</span>
            <span className="per-stat-label">Features done</span>
          </div>
          <div className="per-stat">
            <span className="per-stat-value">{featureStats.partial}</span>
            <span className="per-stat-label">Partial</span>
          </div>
          <div className="per-stat">
            <span className="per-stat-value">{featureStats.missing}</span>
            <span className="per-stat-label">Missing</span>
          </div>
          {(result.aiAnalysis?.codeQualityIssues?.length > 0 || result.aiAnalysis?.securityIssues?.length > 0) && (
            <div className="per-stat per-stat-warn">
              <span className="per-stat-value">
                {(result.aiAnalysis?.codeQualityIssues?.length || 0) +
                  (result.aiAnalysis?.securityIssues?.length || 0)}
              </span>
              <span className="per-stat-label">Issues flagged</span>
            </div>
          )}
        </div>
        {(submission?.githubRepoUrl || submission?.liveUrl) && (
          <div className="per-hero-links">
            {submission.githubRepoUrl && (
              <a href={submission.githubRepoUrl} target="_blank" rel="noopener noreferrer" className="per-link-btn">
                <FiGithub /> Repository <FiExternalLink />
              </a>
            )}
            {submission.liveUrl && (
              <a href={submission.liveUrl} target="_blank" rel="noopener noreferrer" className="per-link-btn per-link-btn--live">
                <FiExternalLink /> Live demo
              </a>
            )}
          </div>
        )}
      </section>

      {/* Category breakdown */}
      {categories.length > 0 && (
        <section className="per-section">
          <h2 className="per-section-title"><FiTrendingUp /> Score breakdown</h2>
          <div className="per-category-grid">
            {categories.map(({ key, score, maxScore, percentage, meta }) => {
              const Icon = meta?.icon || FiTarget;
              const color = meta?.color || accent;
              const pct = percentage ?? (maxScore ? (score / maxScore) * 100 : 0);
              return (
                <div key={key} className="per-category-card" style={{ '--cat-color': color }}>
                  <div className="per-category-top">
                    <span className="per-category-icon"><Icon /></span>
                    <div>
                      <span className="per-category-name">{formatCategoryKey(key)}</span>
                      <span className="per-category-marks">
                        {score?.toFixed?.(1) ?? score}/{maxScore}
                      </span>
                    </div>
                    <span className="per-category-pct">{pct.toFixed(0)}%</span>
                  </div>
                  <div className="per-category-bar">
                    <div
                      className="per-category-bar-fill"
                      style={{ width: `${Math.min(100, pct)}%`, background: barColor(pct) }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Features */}
      {result.featureEvaluation?.length > 0 && (
        <section className="per-section">
          <div className="per-section-head">
            <h2 className="per-section-title"><FiCheckCircle /> Feature implementation</h2>
            <div className="per-filter-tabs">
              {[
                ['all', `All (${featureStats.total})`],
                ['implemented', `Done (${featureStats.implemented})`],
                ['partial', `Partial (${featureStats.partial})`],
                ['missing', `Missing (${featureStats.missing})`],
              ].map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  className={`per-filter-tab ${featureFilter === key ? 'active' : ''}`}
                  onClick={() => setFeatureFilter(key)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="per-feature-list">
            {filteredFeatures.map((feature, index) => {
              const globalIndex = result.featureEvaluation.indexOf(feature);
              const expanded = expandedFeatures[globalIndex] ?? feature.status !== 'implemented';
              const statusIcon =
                feature.status === 'implemented' ? FiCheckCircle :
                feature.status === 'partial' ? FiMinusCircle : FiXCircle;
              const StatusIcon = statusIcon;
              return (
                <article
                  key={globalIndex}
                  className={`per-feature-card per-feature-card--${feature.status}`}
                >
                  <button
                    type="button"
                    className="per-feature-head"
                    onClick={() => toggleFeature(globalIndex)}
                  >
                    <StatusIcon className="per-feature-status-icon" />
                    <span className="per-feature-name">{feature.feature}</span>
                    <span className="per-feature-marks">
                      {feature.scoredMarks}/{feature.expectedMarks}
                    </span>
                    <span className={`per-feature-badge per-feature-badge--${feature.status}`}>
                      {feature.status}
                    </span>
                  </button>
                  {expanded && (
                    <div className="per-feature-body">
                      <p>{feature.aiAnalysis}</p>
                      {feature.suggestions?.length > 0 && (
                        <ul className="per-feature-suggestions">
                          {feature.suggestions.map((s, i) => (
                            <li key={i}>{s}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      )}

      {/* AI summary */}
      {result.aiAnalysis?.summary && (
        <section className="per-section per-section-highlight">
          <h2 className="per-section-title">AI evaluation summary</h2>
          <p className="per-summary-text">{result.aiAnalysis.summary}</p>
          <div className="per-two-col">
            {result.aiAnalysis.strengths?.length > 0 && (
              <div className="per-insight per-insight--good">
                <h3>Strengths</h3>
                <ul>
                  {result.aiAnalysis.strengths.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>
            )}
            {result.aiAnalysis.weaknesses?.length > 0 && (
              <div className="per-insight per-insight--warn">
                <h3>Areas to improve</h3>
                <ul>
                  {result.aiAnalysis.weaknesses.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          {result.aiAnalysis.architectureAnalysis && (
            <div className="per-arch-block">
              <h3>Architecture notes</h3>
              <p>{result.aiAnalysis.architectureAnalysis}</p>
            </div>
          )}
          {(result.aiAnalysis.bestPracticesFollowed?.length > 0 ||
            result.aiAnalysis.bestPracticesViolated?.length > 0) && (
            <div className="per-practices-grid">
              {result.aiAnalysis.bestPracticesFollowed?.length > 0 && (
                <div className="per-practices per-practices--ok">
                  <h4>Best practices followed</h4>
                  <ul>
                    {result.aiAnalysis.bestPracticesFollowed.map((b, i) => (
                      <li key={i}>{b}</li>
                    ))}
                  </ul>
                </div>
              )}
              {result.aiAnalysis.bestPracticesViolated?.length > 0 && (
                <div className="per-practices per-practices--bad">
                  <h4>Violations</h4>
                  <ul>
                    {result.aiAnalysis.bestPracticesViolated.map((b, i) => (
                      <li key={i}>{b}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* Issues */}
      {(result.aiAnalysis?.codeQualityIssues?.length > 0 ||
        result.aiAnalysis?.securityIssues?.length > 0) && (
        <section className="per-section">
          <h2 className="per-section-title"><FiAlertTriangle /> Issues found</h2>
          <div className="per-issues-grid">
            {result.aiAnalysis.codeQualityIssues?.length > 0 && (
              <div className="per-issues-col">
                <h3><FiCode /> Code quality</h3>
                {result.aiAnalysis.codeQualityIssues.map((issue, i) => (
                  <div key={i} className="per-issue-card">
                    <div className="per-issue-top">
                      <span className={severityClass(issue.severity)}>{issue.severity}</span>
                      {issue.location && <code className="per-issue-loc">{issue.location}</code>}
                    </div>
                    <p className="per-issue-desc">{issue.issue}</p>
                    {issue.suggestion && (
                      <p className="per-issue-fix"><strong>Fix:</strong> {issue.suggestion}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
            {result.aiAnalysis.securityIssues?.length > 0 && (
              <div className="per-issues-col per-issues-col--security">
                <h3><FiShield /> Security</h3>
                {result.aiAnalysis.securityIssues.map((issue, i) => (
                  <div key={i} className="per-issue-card per-issue-card--security">
                    <div className="per-issue-top">
                      <span className={severityClass(issue.severity)}>{issue.severity}</span>
                      {issue.location && <code className="per-issue-loc">{issue.location}</code>}
                    </div>
                    <p className="per-issue-desc">{issue.issue}</p>
                    {issue.suggestion && (
                      <p className="per-issue-fix"><strong>Fix:</strong> {issue.suggestion}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Commit analysis */}
      {result.commitAnalysis && (
        <section className={`per-section ${result.commitAnalysis.hasLateCommits ? 'per-section-alert' : ''}`}>
          <h2 className="per-section-title"><FiGitCommit /> Commit timeline</h2>
          <div className="per-commit-stats">
            <div><span>Total commits</span><strong>{result.commitAnalysis.totalCommits}</strong></div>
            <div>
              <span>Last commit</span>
              <strong>
                {result.commitAnalysis.lastCommitAt
                  ? new Date(result.commitAnalysis.lastCommitAt).toLocaleString()
                  : '—'}
              </strong>
            </div>
            {result.commitAnalysis.timerEndAt && (
              <div>
                <span>Timer ended</span>
                <strong>{new Date(result.commitAnalysis.timerEndAt).toLocaleString()}</strong>
              </div>
            )}
          </div>
          {result.commitAnalysis.lastCommitHash && (
            <p className="per-commit-latest">
              <code>{result.commitAnalysis.lastCommitHash.slice(0, 7)}</code>
              {result.commitAnalysis.lastCommitMessage && (
                <span> — {result.commitAnalysis.lastCommitMessage}</span>
              )}
            </p>
          )}
          <div className={`per-commit-verdict ${result.commitAnalysis.hasLateCommits ? 'bad' : 'ok'}`}>
            <h3>{result.commitAnalysis.hasLateCommits ? 'Late commits detected' : 'All commits on time'}</h3>
            <p>{result.commitAnalysis.summary}</p>
            {result.commitAnalysis.hasLateCommits && (
              <div className="per-penalty-grid">
                <span><strong>Minutes after timer:</strong> {result.commitAnalysis.minutesLate}</span>
                <span><strong>Penalty:</strong> −{result.commitAnalysis.latePenaltyMarks} marks</span>
              </div>
            )}
            {result.commitAnalysis.lateCommits?.length > 0 && (
              <ul className="per-late-list">
                {result.commitAnalysis.lateCommits.map((c, i) => (
                  <li key={i}>
                    <code>{c.hash?.slice(0, 7)}</code> {c.message}
                    <span className="per-late-meta">
                      +{c.minutesAfterTimer} min · {new Date(c.date).toLocaleString()}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}

      {/* Git practices */}
      {result.gitAnalysis?.commitQuality && (
        <section className="per-section">
          <h2 className="per-section-title"><FiGitCommit /> Git practices</h2>
          <div className="per-mini-stats">
            <div className="per-mini-stat">
              <span>Commit quality</span>
              <strong>{result.gitAnalysis.commitQuality.score}/10</strong>
            </div>
            <div className="per-mini-stat per-mini-stat--good">
              <span>Good commits</span>
              <strong>{result.gitAnalysis.commitQuality.goodCommits}</strong>
            </div>
            <div className="per-mini-stat per-mini-stat--bad">
              <span>Poor commits</span>
              <strong>{result.gitAnalysis.commitQuality.poorCommits}</strong>
            </div>
            {result.gitAnalysis.commitFrequency && (
              <div className="per-mini-stat">
                <span>Total commits</span>
                <strong>{result.gitAnalysis.commitFrequency.totalCommits}</strong>
              </div>
            )}
          </div>
          {result.gitAnalysis.branchingStrategy?.analysis && (
            <p className="per-git-note"><strong>Branching:</strong> {result.gitAnalysis.branchingStrategy.analysis}</p>
          )}
          {result.gitAnalysis.commitQuality.examples?.length > 0 && (
            <div className="per-commit-examples">
              {result.gitAnalysis.commitQuality.examples.map((ex, i) => (
                <div key={i} className={`per-commit-ex ${ex.quality}`}>
                  <code>{ex.message}</code>
                  <p>{ex.feedback}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Documentation */}
      {result.documentationAnalysis?.readmeQuality && (
        <section className="per-section">
          <h2 className="per-section-title"><FiFileText /> Documentation</h2>
          <div className="per-doc-score">
            README score: <strong>{result.documentationAnalysis.readmeQuality.score}/10</strong>
          </div>
          <div className="per-doc-checklist">
            {[
              ['hasSetupInstructions', 'Setup instructions'],
              ['hasFeatureDescription', 'Feature description'],
              ['hasUsageExamples', 'Usage examples'],
              ['hasDependencies', 'Dependencies listed'],
            ].map(([key, label]) => {
              const ok = result.documentationAnalysis.readmeQuality[key];
              return (
                <div key={key} className={`per-doc-item ${ok ? 'yes' : 'no'}`}>
                  {ok ? <FiCheckCircle /> : <FiXCircle />} {label}
                </div>
              );
            })}
          </div>
          {result.documentationAnalysis.readmeQuality.feedback && (
            <p className="per-doc-feedback">{result.documentationAnalysis.readmeQuality.feedback}</p>
          )}
          {result.documentationAnalysis.codeComments && (
            <p className="per-doc-feedback">
              Code comments: {result.documentationAnalysis.codeComments.commentedFunctions}/
              {result.documentationAnalysis.codeComments.totalFunctions} functions documented
              {result.documentationAnalysis.codeComments.quality &&
                ` · ${result.documentationAnalysis.codeComments.quality}`}
            </p>
          )}
        </section>
      )}

      {/* Time & tests */}
      {(result.timeAnalysis || result.automatedTests?.executed) && (
        <section className="per-section">
          <h2 className="per-section-title">Additional metrics</h2>
          {result.timeAnalysis && (
            <div className="per-metrics-row">
              {result.timeAnalysis.timeSpent != null && (
                <span>Time spent: <strong>{result.timeAnalysis.timeSpent} min</strong></span>
              )}
              {result.timeAnalysis.efficiency && (
                <span>Efficiency: <strong>{result.timeAnalysis.efficiency}</strong></span>
              )}
              {result.timeAnalysis.timeManagement && (
                <span>Time management: <strong>{result.timeAnalysis.timeManagement}</strong></span>
              )}
            </div>
          )}
          {result.automatedTests?.executed && (
            <p className="per-metrics-row">
              Automated tests: <strong>{result.automatedTests.passed}/{result.automatedTests.total}</strong> passed
            </p>
          )}
        </section>
      )}

      {/* Detailed feedback */}
      {result.overallFeedback && (
        <section className="per-section per-section-feedback">
          <h2 className="per-section-title">Personalized feedback</h2>
          {result.overallFeedback.summary && (
            <p className="per-feedback-summary">{result.overallFeedback.summary}</p>
          )}
          <div className="per-two-col">
            {result.overallFeedback.topStrengths?.length > 0 && (
              <div className="per-feedback-block">
                <h3>Top strengths</h3>
                <ol>
                  {result.overallFeedback.topStrengths.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ol>
              </div>
            )}
            {result.overallFeedback.areasForImprovement?.length > 0 && (
              <div className="per-feedback-block">
                <h3>Focus next</h3>
                <ol>
                  {result.overallFeedback.areasForImprovement.map((a, i) => (
                    <li key={i}>{a}</li>
                  ))}
                </ol>
              </div>
            )}
          </div>
          {result.overallFeedback.nextSteps?.length > 0 && (
            <div className="per-next-steps">
              <h3>Recommended next steps</h3>
              <ol>
                {result.overallFeedback.nextSteps.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ol>
            </div>
          )}
          {result.overallFeedback.recommendedResources?.length > 0 && (
            <div className="per-resources">
              <h3>Resources</h3>
              <ul>
                {result.overallFeedback.recommendedResources.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {result.manualOverride?.enabled && (
        <section className="per-section per-section-override">
          <p>
            <strong>Instructor adjustment:</strong> Score updated from {result.manualOverride.originalScore} to{' '}
            {result.manualOverride.adjustedScore}. {result.manualOverride.reason}
          </p>
        </section>
      )}

      <footer className="per-footer">
        <button type="button" className="per-btn per-btn-primary" onClick={() => navigate(backPath)}>
          {backLabel}
        </button>
      </footer>
    </div>
  );
};

export default EvaluationResult;
