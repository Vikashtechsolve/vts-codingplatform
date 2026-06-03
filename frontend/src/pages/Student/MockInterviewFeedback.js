import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer
} from 'recharts';
import axiosInstance from '../../utils/axios';
import './MockInterviewFeedback.css';

const SKILL_KEYS = [
  { key: 'correctness', label: 'Correctness' },
  { key: 'depth', label: 'Technical depth' },
  { key: 'structure', label: 'Communication' },
  { key: 'confidence', label: 'Confidence' },
  { key: 'relevance', label: 'Relevance' }
];

const formatTime = (seconds) => {
  if (seconds == null || !Number.isFinite(seconds)) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
};

const getGrade = (pct) => {
  if (pct >= 90) return { grade: 'A+', color: '#10b981' };
  if (pct >= 80) return { grade: 'A', color: '#10b981' };
  if (pct >= 70) return { grade: 'B+', color: '#22c55e' };
  if (pct >= 60) return { grade: 'B', color: '#f59e0b' };
  if (pct >= 50) return { grade: 'C', color: '#f59e0b' };
  return { grade: 'D', color: '#ef4444' };
};

const getTier = (score) => {
  if (score >= 80) return { cls: 'strong', label: 'Strong', icon: '✓' };
  if (score >= 60) return { cls: 'fair', label: 'Fair', icon: '◐' };
  return { cls: 'weak', label: 'Needs work', icon: '!' };
};

const getScoreInsight = (score) => {
  if (score >= 85) return 'Excellent answer — clear, relevant, and well structured.';
  if (score >= 70) return 'Solid response with minor gaps. A few more specifics would strengthen it.';
  if (score >= 55) return 'Partially on track. Add examples and deeper reasoning to improve.';
  return 'Answer needs more depth, clarity, or relevance to the question asked.';
};

const wordCount = (text = '') => {
  const t = text.trim();
  return t ? t.split(/\s+/).filter(Boolean).length : 0;
};

const MetricChip = ({ label, value }) => {
  const val = Math.round(value ?? 0);
  const color = val >= 70 ? '#10b981' : val >= 40 ? '#f59e0b' : '#ef4444';
  return (
    <div className="mir-metric-chip">
      <span className="mir-metric-val" style={{ color }}>{val}</span>
      <span className="mir-metric-label">{label}</span>
    </div>
  );
};

const ScoreBar = ({ label, value, max = 100 }) => {
  const val = Math.min(max, Math.max(0, Math.round(value)));
  const color = val >= 70 ? '#10b981' : val >= 40 ? '#f59e0b' : '#ef4444';
  return (
    <div className="mir-score-bar">
      <div className="mir-score-bar-head">
        <span className="mir-score-bar-label">{label}</span>
        <span className="mir-score-bar-val" style={{ color }}>{val}</span>
      </div>
      <div className="mir-score-bar-track">
        <div className="mir-score-bar-fill" style={{ width: `${val}%`, background: color }} />
      </div>
    </div>
  );
};

const MockInterviewFeedback = () => {
  const { sessionId } = useParams();
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedCards, setExpandedCards] = useState({});
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const response = await axiosInstance.get(`/interview-sessions/${sessionId}`);
        setSession(response.data);
      } catch (error) {
        console.error('Error fetching session:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchSession();
  }, [sessionId]);

  const toggleCard = useCallback((id) => {
    setExpandedCards((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const skillScores = useMemo(() => {
    if (!session?.answers?.length) return [];
    const sums = { correctness: 0, depth: 0, structure: 0, confidence: 0, relevance: 0 };
    session.answers.forEach((a) => {
      const e = a.evaluation;
      if (e) {
        SKILL_KEYS.forEach(({ key }) => {
          if (typeof e[key] === 'number') sums[key] += e[key];
        });
      }
    });
    const n = session.answers.length;
    return SKILL_KEYS.map(({ key, label }) => ({
      key,
      label,
      value: n ? Math.round(sums[key] / n) : 0
    }));
  }, [session]);

  const radarData = useMemo(
    () => skillScores.map((s) => ({ skill: s.label, score: s.value, fullMark: 100 })),
    [skillScores]
  );

  const answerStats = useMemo(() => {
    const answers = session?.answers || [];
    let strong = 0;
    let fair = 0;
    let weak = 0;
    answers.forEach((a) => {
      const s = a.evaluation?.overall ?? 0;
      if (s >= 80) strong += 1;
      else if (s >= 60) fair += 1;
      else weak += 1;
    });
    return { strong, fair, weak, total: answers.length };
  }, [session]);

  const filteredAnswers = useMemo(() => {
    const answers = session?.answers || [];
    if (filter === 'all') return answers;
    if (filter === 'strong') return answers.filter((a) => (a.evaluation?.overall ?? 0) >= 80);
    if (filter === 'weak') return answers.filter((a) => (a.evaluation?.overall ?? 0) < 60);
    return answers.filter((a) => {
      const s = a.evaluation?.overall ?? 0;
      return s >= 60 && s < 80;
    });
  }, [session, filter]);

  const allResources = useMemo(() => {
    const set = new Set();
    (session?.answers || []).forEach((a) => {
      (a.evaluation?.resources || []).forEach((r) => set.add(r));
    });
    return [...set];
  }, [session]);

  if (loading) {
    return (
      <div className="mir-loading">
        <div className="mir-spinner" />
        <span>Loading your interview analysis...</span>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="mir-page">
        <div className="mir-fallback">
          <h2>Feedback not available</h2>
          <p>We could not load this interview session.</p>
          <Link to="/student/tests/interview" className="mir-btn mir-btn-secondary">
            Back to interviews
          </Link>
        </div>
      </div>
    );
  }

  const overallScore = session.overallScore ?? 0;
  const readinessPercent = session.readinessPercent ?? overallScore;
  const { grade, color: gradeColor } = getGrade(overallScore);
  const isPass = overallScore >= 60;
  const ringLen = 327;
  const interview = session.interviewId || {};

  const renderAnswerCard = (answer, idx) => {
    const e = answer.evaluation || {};
    const overall = e.overall ?? 0;
    const tier = getTier(overall);
    const cardId = `q-${idx}`;
    const isExpanded = expandedCards[cardId];
    const transcript = answer.transcript?.trim() || '';
    const hasTranscript = transcript.length > 0;

    return (
      <div key={cardId} className={`mir-card mir-card-${tier.cls}`}>
        <button type="button" className="mir-card-top" onClick={() => toggleCard(cardId)}>
          <div className="mir-card-left">
            <div className={`mir-status-dot mir-status-${tier.cls}`} title={tier.label}>
              {tier.icon}
            </div>
            <div className="mir-card-info">
              <span className="mir-card-q">
                Question {idx + 1}
                {answer.isFollowUp && <span className="mir-followup-tag">Follow-up</span>}
              </span>
              <p className="mir-card-q-preview">{answer.questionText}</p>
              {!isExpanded && e.feedback && (
                <p className="mir-card-feedback-preview">{e.feedback}</p>
              )}
            </div>
          </div>
          <div className="mir-card-right">
            <div className="mir-card-score-wrap">
              <span className="mir-card-score" style={{ color: gradeColor }}>{overall}</span>
              <span className="mir-card-score-max">/ 100</span>
            </div>
            <span className={`mir-expand-icon ${isExpanded ? 'open' : ''}`} aria-hidden>
              &#9662;
            </span>
          </div>
        </button>

        {isExpanded && (
          <div className="mir-card-body">
            <div className="mir-review-metrics">
              <MetricChip label="Correctness" value={e.correctness ?? 0} />
              <MetricChip label="Depth" value={e.depth ?? 0} />
              <MetricChip label="Clarity" value={e.structure ?? 0} />
              <MetricChip label="Confidence" value={e.confidence ?? 0} />
              <MetricChip label="Relevance" value={e.relevance ?? 0} />
            </div>

            <div className="mir-review-section mir-review-section-q">
              <span className="mir-review-step">1</span>
              <div className="mir-review-section-content">
                <h4 className="mir-review-heading">What the interviewer asked</h4>
                <p className="mir-review-question-text">{answer.questionText}</p>
              </div>
            </div>

            <div className={`mir-review-section mir-review-section-a ${tier.cls}`}>
              <span className="mir-review-step">2</span>
              <div className="mir-review-section-content">
                <h4 className="mir-review-heading">What you said</h4>
                {hasTranscript ? (
                  <>
                    <blockquote className="mir-transcript-quote">{transcript}</blockquote>
                    <div className="mir-transcript-meta">
                      <span>{wordCount(transcript)} words spoken</span>
                      {answer.isFollowUp && <span className="mir-meta-tag">Follow-up response</span>}
                    </div>
                  </>
                ) : (
                  <p className="mir-transcript-empty">No transcript was captured for this answer.</p>
                )}
                {e.answerSummary && (
                  <p className="mir-answer-summary">
                    <strong>In short:</strong> {e.answerSummary}
                  </p>
                )}
              </div>
            </div>

            <div className={`mir-explanation-hero mir-explanation-${tier.cls}`}>
              <div className="mir-explanation-hero-head">
                <span className="mir-review-step mir-review-step-light">3</span>
                <h4 className="mir-review-heading">Interviewer explanation</h4>
              </div>
              <p className="mir-explanation-verdict">{getScoreInsight(overall)}</p>
              <div className="mir-explanation-text">
                {e.feedback ? (
                  e.feedback.split(/\n+/).map((para, i) => (
                    <p key={i}>{para.trim()}</p>
                  ))
                ) : (
                  <p>Detailed feedback was not generated for this response. Check your rubric scores above.</p>
                )}
              </div>
            </div>

            <div className="mir-review-section mir-review-rubric">
              <span className="mir-review-step">4</span>
              <div className="mir-review-section-content">
                <h4 className="mir-review-heading">How each skill was scored</h4>
                <p className="mir-review-hint">
                  Each dimension is scored 0–100 based on accuracy, depth, how clearly you explained ideas,
                  confidence, and how well you stayed on topic.
                </p>
                <div className="mir-score-bars-grid">
                  <ScoreBar label="Correctness — facts and accuracy" value={e.correctness ?? 0} />
                  <ScoreBar label="Technical depth — detail and examples" value={e.depth ?? 0} />
                  <ScoreBar label="Communication — structure and clarity" value={e.structure ?? 0} />
                  <ScoreBar label="Confidence — delivery and assurance" value={e.confidence ?? 0} />
                  <ScoreBar label="Relevance — stayed on the question" value={e.relevance ?? 0} />
                </div>
              </div>
            </div>

            {(e.strengths?.length > 0 || e.weaknesses?.length > 0) && (
              <div className="mir-review-dual">
                {e.strengths?.length > 0 && (
                  <div className="mir-insight-box mir-insight-good">
                    <h4>
                      <span className="mir-insight-icon">✓</span>
                      What worked well
                    </h4>
                    <ul>
                      {e.strengths.map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {e.weaknesses?.length > 0 && (
                  <div className="mir-insight-box mir-insight-improve">
                    <h4>
                      <span className="mir-insight-icon">→</span>
                      What held you back
                    </h4>
                    <ul>
                      {e.weaknesses.map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {e.weaknesses?.length > 0 && (
              <div className="mir-review-section mir-review-tips">
                <span className="mir-review-step">5</span>
                <div className="mir-review-section-content">
                  <h4 className="mir-review-heading">How to answer better next time</h4>
                  <ul className="mir-tips-list">
                    {e.weaknesses.map((w, i) => (
                      <li key={i}>
                        <span className="mir-tip-num">{i + 1}</span>
                        <span>
                          Address: <strong>{w}</strong>
                          {overall < 70 && i === 0 && ' — focus on this first in your next practice.'}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {e.resources?.length > 0 && (
              <div className="mir-review-section mir-review-resources">
                <span className="mir-review-step">6</span>
                <div className="mir-review-section-content">
                  <h4 className="mir-review-heading">Study and practice resources</h4>
                  <ul className="mir-resource-list">
                    {e.resources.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="mir-page">
      <header className="mir-header">
        <div>
          <span className="mir-kind-badge">Mock interview</span>
          <h1 className="mir-title">{interview.title || 'Interview result'}</h1>
          <p className="mir-subtitle">
            {session.interviewType} · {session.topic} · {session.difficulty}
          </p>
          <p className="mir-submitted">
            Completed {session.submittedAt ? new Date(session.submittedAt).toLocaleString() : '—'}
          </p>
        </div>
        <Link to="/student/tests/interview" className="mir-btn mir-btn-secondary">
          Back to interviews
        </Link>
      </header>

      <section className={`mir-verdict ${isPass ? 'pass' : 'needs-work'}`}>
        <div className="mir-verdict-icon">{isPass ? '✓' : '!'}</div>
        <div>
          <h2>{isPass ? 'Good performance' : 'Room to grow'}</h2>
          <p>
            {session.finalFeedback?.readinessLabel ||
              (isPass ? 'You are on track for real interviews.' : 'Focus on the focus areas below before your next attempt.')}
          </p>
        </div>
        <div className="mir-readiness-pill">
          <span className="mir-readiness-label">Readiness</span>
          <span className="mir-readiness-value">{readinessPercent}%</span>
        </div>
      </section>

      <section className="mir-hero">
        <div className="mir-hero-score">
          <svg viewBox="0 0 120 120" className="mir-ring" aria-hidden>
            <circle cx="60" cy="60" r="52" fill="none" stroke="var(--border-color)" strokeWidth="8" />
            <circle
              cx="60"
              cy="60"
              r="52"
              fill="none"
              stroke={gradeColor}
              strokeWidth="8"
              strokeDasharray={`${(overallScore / 100) * ringLen} ${ringLen}`}
              strokeLinecap="round"
              transform="rotate(-90 60 60)"
              className="mir-ring-fill"
            />
          </svg>
          <div className="mir-ring-text">
            <span className="mir-ring-pct" style={{ color: gradeColor }}>{overallScore}%</span>
            <span className="mir-ring-grade" style={{ color: gradeColor }}>{grade}</span>
          </div>
        </div>
        <div className="mir-hero-stats">
          <div className="mir-stat">
            <span className="mir-stat-value">{answerStats.total}</span>
            <span className="mir-stat-label">Questions</span>
          </div>
          <div className="mir-stat">
            <span className="mir-stat-value">{formatTime(session.timeSpent)}</span>
            <span className="mir-stat-label">Time spent</span>
          </div>
          <div className="mir-stat mir-stat-strong">
            <span className="mir-stat-value">{answerStats.strong}</span>
            <span className="mir-stat-label">Strong answers</span>
          </div>
          <div className="mir-stat mir-stat-weak">
            <span className="mir-stat-value">{answerStats.weak}</span>
            <span className="mir-stat-label">Need practice</span>
          </div>
        </div>
      </section>

      {session.finalFeedback?.summary && (
        <section className="mir-executive">
          <h2>Executive summary</h2>
          <p>{session.finalFeedback.summary}</p>
        </section>
      )}

      <div className="mir-grid-2">
        {skillScores.length > 0 && (
          <section className="mir-panel mir-skills-panel">
            <h2>Skill profile</h2>
            <div className="mir-radar-wrap">
              <ResponsiveContainer width="100%" height={260}>
                <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="72%">
                  <PolarGrid stroke="var(--border-color)" />
                  <PolarAngleAxis dataKey="skill" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                  <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 10 }} />
                  <Radar
                    name="Score"
                    dataKey="score"
                    stroke="var(--primary-color)"
                    fill="var(--primary-color)"
                    fillOpacity={0.25}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
            <div className="mir-skill-bars">
              {skillScores.map((s) => (
                <ScoreBar key={s.key} label={s.label} value={s.value} />
              ))}
            </div>
          </section>
        )}

        <div className="mir-insights-col">
          <section className="mir-panel mir-panel-good">
            <h2>What you did well</h2>
            <ul>
              {(session.finalFeedback?.strengths || []).length > 0
                ? session.finalFeedback.strengths.map((item, i) => <li key={i}>{item}</li>)
                : <li>Review per-question feedback for specific strengths.</li>}
            </ul>
          </section>
          <section className="mir-panel mir-panel-improve">
            <h2>Where to improve</h2>
            <ul>
              {(session.finalFeedback?.improvements || []).length > 0
                ? session.finalFeedback.improvements.map((item, i) => <li key={i}>{item}</li>)
                : <li>Review per-question feedback for improvement areas.</li>}
            </ul>
          </section>
          {(session.finalFeedback?.focusAreas || []).length > 0 && (
            <section className="mir-panel mir-panel-focus">
              <h2>Focus next</h2>
              <ul>
                {session.finalFeedback.focusAreas.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>

      {allResources.length > 0 && (
        <section className="mir-panel mir-resources">
          <h2>Learning resources</h2>
          <ul>
            {allResources.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </section>
      )}

      <section className="mir-answers-section">
        <div className="mir-answers-head">
          <div>
            <h2>Question-by-question review</h2>
            <p className="mir-answers-sub">
              Each card shows what was asked, what you said, a full explanation, and how to improve.
            </p>
          </div>
          <div className="mir-filters">
            {[
              { id: 'all', label: `All (${answerStats.total})` },
              { id: 'strong', label: `Strong (${answerStats.strong})` },
              { id: 'fair', label: `Fair (${answerStats.fair})` },
              { id: 'weak', label: `Needs work (${answerStats.weak})` }
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                className={`mir-filter-btn ${filter === f.id ? 'active' : ''}`}
                onClick={() => setFilter(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
        <div className="mir-cards">
          {filteredAnswers.length > 0
            ? filteredAnswers.map((answer) => {
                const origIdx = session.answers.indexOf(answer);
                return renderAnswerCard(answer, origIdx);
              })
            : (
              <p className="mir-empty-filter">No answers in this category.</p>
            )}
        </div>
      </section>
    </div>
  );
};

export default MockInterviewFeedback;
