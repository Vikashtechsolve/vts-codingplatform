import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import axiosInstance from '../../utils/axios';
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer } from 'recharts';
import './EnglishTestResult.css';

const SECTION_META = {
  grammar: { icon: 'Aa', label: 'Grammar', color: '#6366f1' },
  vocabulary: { icon: 'Ab', label: 'Vocabulary', color: '#8b5cf6' },
  reading: { icon: 'Rc', label: 'Reading', color: '#0ea5e9' },
  writing: { icon: 'Es', label: 'Writing', color: '#10b981' },
  speaking: { icon: 'Sp', label: 'Speaking', color: '#f59e0b' },
  listening: { icon: 'Li', label: 'Listening', color: '#ef4444' }
};

const API_BASE = (process.env.REACT_APP_API_URL || '').replace(/\/api\/?$/, '');

const resolveMediaUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('blob:')) return url;
  return `${API_BASE}${url.startsWith('/') ? '' : '/'}${url}`;
};

const EnglishTestResult = () => {
  const { resultId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const resultFromState = location.state?.resultFromSubmit;
  const [result, setResult] = useState(resultFromState || null);
  const [test, setTest] = useState(null);
  const [loading, setLoading] = useState(!resultFromState);
  const [expandedCards, setExpandedCards] = useState({});
  const [fetchError, setFetchError] = useState(null);

  const fetchResult = useCallback(async () => {
    if (!resultId) return;
    try {
      setFetchError(null);
      const res = await axiosInstance.get(`/results/${resultId}`);
      setResult(res.data);
      if (res.data.testId) {
        const testId = typeof res.data.testId === 'object' ? res.data.testId._id : res.data.testId;
        const testRes = await axiosInstance.get(`/tests/${testId}`);
        setTest(testRes.data);
      }
    } catch (error) {
      setFetchError(error.response?.data?.message || error.message);
      if (!resultFromState) setResult(null);
    } finally {
      setLoading(false);
    }
  }, [resultId, resultFromState]);

  useEffect(() => { if (resultId) fetchResult(); }, [resultId, fetchResult]);

  useEffect(() => {
    if (!result?.testId || test) return;
    const testId = typeof result.testId === 'object' ? result.testId._id : result.testId;
    if (!testId) return;
    axiosInstance.get(`/tests/${testId}`).then((res) => setTest(res.data)).catch(() => {});
  }, [result?.testId, test]);

  const toggleCard = (id) => setExpandedCards(prev => ({ ...prev, [id]: !prev[id] }));

  if (loading && !result) return <div className="etr-loading"><div className="etr-spinner" /><span>Loading your results...</span></div>;
  if (!result && fetchError) {
    return (
      <div className="etr-page">
        <div className="etr-fallback">
          <div className="etr-fallback-icon">&#10003;</div>
          <h2>Test Submitted Successfully</h2>
          <p>Your results are being processed. Check your dashboard shortly.</p>
          <button className="etr-btn etr-btn-primary" onClick={() => navigate('/student/dashboard')}>Go to Dashboard</button>
        </div>
      </div>
    );
  }
  if (!result) return <div className="etr-loading">Result not found.</div>;

  const sectionScores = result.sectionScores || [];
  const radarData = sectionScores.map(s => ({
    section: SECTION_META[s.sectionType]?.label || s.sectionType,
    score: s.percentage || 0,
    fullMark: 100
  }));

  const pct = result.percentage ?? 0;
  const grade = pct >= 90 ? 'A+' : pct >= 80 ? 'A' : pct >= 70 ? 'B+' : pct >= 60 ? 'B' : pct >= 50 ? 'C' : 'D';
  const gradeColor = pct >= 70 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444';

  const getAnswerSectionType = (answer) => {
    if (!test?.questions?.length) return answer.sectionId || null;
    const q = test.questions.find(
      qq => (qq.questionId?._id || qq.questionId)?.toString() === (answer.questionId?.toString?.() || answer.questionId)
    );
    return q?.sectionId || answer.sectionId || null;
  };

  const getAnswerSectionLabel = (answer) => {
    const sectionId = getAnswerSectionType(answer);
    return sectionId ? SECTION_META[sectionId]?.label || sectionId : null;
  };

  const getStatusIcon = (a) => {
    if (a.isCorrect) return { icon: '✓', cls: 'correct', text: 'Correct' };
    if (a.points > 0) return { icon: '◐', cls: 'partial', text: 'Partial' };
    return { icon: '✗', cls: 'incorrect', text: 'Incorrect' };
  };

  const formatAnswer = (a) => {
    if (a.essayContent && typeof a.essayContent === 'string') {
      const plain = a.essayContent.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      return plain.length > 200 ? plain.slice(0, 200) + '...' : plain;
    }
    if (a.answer === undefined || a.answer === null) return null;
    if (typeof a.answer === 'string') {
      if (a.answer.startsWith('/uploads/')) return '(Audio recording)';
      return a.answer;
    }
    if (typeof a.answer === 'number') return String(a.answer);
    if (Array.isArray(a.answer)) {
      if (a.questionDetails?.subType === 'parajumble' && Array.isArray(a.questionDetails?.sentences)) {
        return a.answer.map(idx => a.questionDetails.sentences[idx]).filter(Boolean).join(' → ');
      }
      return a.answer.map(v => typeof v === 'object' ? JSON.stringify(v) : v).join(', ');
    }
    if (typeof a.answer === 'object') return null;
    return String(a.answer);
  };

  const getCorrectAnswerText = (a) => {
    const qd = a.questionDetails;
    if (!qd) return null;
    if (qd.options && (qd.correctAnswer === 0 || qd.correctAnswer)) {
      const idx = typeof qd.correctAnswer === 'number' ? qd.correctAnswer : parseInt(qd.correctAnswer, 10);
      return qd.options[idx]?.text || `Option ${idx + 1}`;
    }
    return qd.correctAnswer != null ? String(qd.correctAnswer) : null;
  };

  const ScoreBar = ({ label, score, max = 1 }) => {
    const val = Math.round((score / max) * 100);
    const color = val >= 70 ? '#10b981' : val >= 40 ? '#f59e0b' : '#ef4444';
    return (
      <div className="etr-score-bar">
        <div className="etr-score-bar-head">
          <span className="etr-score-bar-label">{label}</span>
          <span className="etr-score-bar-val" style={{ color }}>{val}%</span>
        </div>
        <div className="etr-score-bar-track"><div className="etr-score-bar-fill" style={{ width: `${val}%`, background: color }} /></div>
      </div>
    );
  };

  const MetricChip = ({ label, value, unit }) => (
    <div className="etr-metric-chip">
      <span className="etr-metric-val">{value}{unit && <small>{unit}</small>}</span>
      <span className="etr-metric-label">{label}</span>
    </div>
  );

  const renderEssayFeedback = (answer) => {
    const ev = answer.englishEvaluation;
    if (!ev) return <div className="etr-eval-pending">AI evaluation is being processed...</div>;
    const plag = ev.plagiarism;
    return (
      <div className="etr-ai-panel etr-ai-writing">
        <div className="etr-ai-panel-header"><span className="etr-ai-badge">AI Writing Review</span></div>
        <div className="etr-score-bars-grid">
          <ScoreBar label="Grammar" score={ev.grammarScore || 0} />
          <ScoreBar label="Vocabulary" score={ev.vocabularyScore || 0} />
          <ScoreBar label="Coherence" score={ev.coherenceScore || 0} />
          <ScoreBar label="Structure" score={ev.structureScore || 0} />
          <ScoreBar label="Tone" score={ev.toneScore || 0} />
          <ScoreBar label="Relevance" score={ev.relevanceScore || 0} />
        </div>
        {ev.detailedFeedback && (
          <div className="etr-feedback-block">
            <h5>Detailed Feedback</h5>
            <p>{ev.detailedFeedback}</p>
          </div>
        )}
        {ev.suggestions?.length > 0 && (
          <div className="etr-suggestions-block">
            <h5>How to Improve</h5>
            <ul>{ev.suggestions.map((s, i) => <li key={i}>{s}</li>)}</ul>
          </div>
        )}
        {plag && (
          <div className={`etr-plag-block etr-plag-${plag.suspicionLevel || 'none'}`}>
            <div className="etr-plag-header">
              <span>Originality Check</span>
              <span className="etr-plag-score">{plag.originalityScore || 0}%</span>
            </div>
            {plag.feedback && <p>{plag.feedback}</p>}
          </div>
        )}
      </div>
    );
  };

  const renderSpeakingFeedback = (answer) => {
    const ev = answer.englishEvaluation;
    if (!ev) return <div className="etr-eval-pending">AI evaluation is being processed...</div>;
    return (
      <div className="etr-ai-panel etr-ai-speaking">
        <div className="etr-ai-panel-header"><span className="etr-ai-badge">AI Speaking Review</span></div>
        {answer.audioFileUrl && (
          <div className="etr-audio-player">
            <audio controls src={resolveMediaUrl(answer.audioFileUrl)} />
          </div>
        )}
        {ev.transcription && (
          <div className="etr-transcription">
            <h5>What You Said</h5>
            <p>{ev.transcription}</p>
          </div>
        )}
        <div className="etr-score-bars-grid">
          <ScoreBar label="Pronunciation" score={ev.pronunciationScore || 0} />
          <ScoreBar label="Fluency" score={ev.fluencyScore || 0} />
          <ScoreBar label="Coherence" score={ev.coherenceScore || 0} />
          <ScoreBar label="Vocabulary" score={ev.vocabularyScore || 0} />
          <ScoreBar label="Grammar" score={ev.grammarScore || 0} />
          <ScoreBar label="Confidence" score={ev.confidenceScore || 0} />
        </div>
        <div className="etr-metrics-row">
          {ev.speakingRate > 0 && <MetricChip label="Speaking Rate" value={ev.speakingRate} unit=" wpm" />}
          {ev.pauseAnalysis?.totalPauses > 0 && <MetricChip label="Pauses" value={ev.pauseAnalysis.totalPauses} />}
          {ev.fillerWords > 0 && <MetricChip label="Filler Words" value={ev.fillerWords} />}
          {ev.vocabularyDiversity > 0 && <MetricChip label="Vocab Diversity" value={Math.round(ev.vocabularyDiversity * 100)} unit="%" />}
        </div>
        {ev.detailedFeedback && (
          <div className="etr-feedback-block">
            <h5>Detailed Feedback</h5>
            <p>{ev.detailedFeedback}</p>
          </div>
        )}
      </div>
    );
  };

  const renderAnswerCard = (a, i) => {
    const sectionType = getAnswerSectionType(a);
    const sectionLabel = getAnswerSectionLabel(a);
    const status = getStatusIcon(a);
    const isWriting = sectionType === 'writing';
    const isSpeaking = sectionType === 'speaking';
    const hasAiFeedback = isWriting || isSpeaking || a.englishEvaluation?.detailedFeedback || a.englishEvaluation?.feedback;
    const hasSubAnswers = a.subAnswers?.length > 0;
    const isExpanded = expandedCards[`q-${i}`];
    const questionText = a.questionDetails?.questionText || a.questionDetails?.word || a.questionDetails?.prompt;
    const yourAnswer = formatAnswer(a);
    const meta = SECTION_META[sectionType] || {};

    return (
      <div key={a.questionId?.toString?.() || i} className={`etr-card etr-card-${status.cls}`}>
        <div className="etr-card-top" onClick={() => toggleCard(`q-${i}`)}>
          <div className="etr-card-left">
            <div className={`etr-status-dot etr-status-${status.cls}`} title={status.text}>{status.icon}</div>
            <div className="etr-card-info">
              <span className="etr-card-q">Question {i + 1}</span>
              {sectionLabel && <span className="etr-section-tag" style={{ borderColor: meta.color || '#888', color: meta.color || '#888' }}>{sectionLabel}</span>}
            </div>
          </div>
          <div className="etr-card-right">
            <div className="etr-card-score">
              <span className="etr-card-pts">{a.points ?? 0}</span>
              <span className="etr-card-max">/ {a.maxPoints ?? 0}</span>
            </div>
            <span className={`etr-expand-icon ${isExpanded ? 'open' : ''}`}>&#9662;</span>
          </div>
        </div>

        {isExpanded && (
          <div className="etr-card-body">
            {questionText && <div className="etr-q-text"><strong>Q:</strong> {questionText}</div>}

            {yourAnswer && !isSpeaking && (
              <div className={`etr-your-ans ${a.isCorrect ? 'correct' : a.points > 0 ? 'partial' : 'wrong'}`}>
                <strong>Your Answer:</strong> {yourAnswer}
              </div>
            )}

            {!isWriting && !isSpeaking && a.isCorrect === false && getCorrectAnswerText(a) && (
              <div className="etr-correct-ans">
                <strong>Correct Answer:</strong> {getCorrectAnswerText(a)}
              </div>
            )}

            {!isWriting && !isSpeaking && a.isCorrect === false && a.questionDetails?.explanation && (
              <div className="etr-explanation">
                <strong>Explanation:</strong> {a.questionDetails.explanation}
              </div>
            )}

            {a.note && <div className="etr-note"><strong>Your Note:</strong> {a.note}</div>}

            {isWriting && renderEssayFeedback(a)}
            {isSpeaking && renderSpeakingFeedback(a)}

            {!isWriting && !isSpeaking && (a.englishEvaluation?.detailedFeedback || a.englishEvaluation?.feedback) && (
              <div className="etr-ai-panel etr-ai-generic">
                <div className="etr-ai-panel-header"><span className="etr-ai-badge">AI Feedback</span></div>
                <p className="etr-ai-text">{a.englishEvaluation.detailedFeedback || a.englishEvaluation.feedback}</p>
                {a.englishEvaluation?.suggestions?.length > 0 && (
                  <div className="etr-suggestions-block">
                    <h5>Suggestions</h5>
                    <ul>{a.englishEvaluation.suggestions.map((s, j) => <li key={j}>{s}</li>)}</ul>
                  </div>
                )}
              </div>
            )}

            {hasSubAnswers && (
              <div className="etr-sub-answers">
                <h5>Sub-Questions</h5>
                {a.subAnswers.map((sa, sIdx) => {
                  const refAnswer = a.questionDetails?.questions?.[sa.subQuestionIndex]?.referenceAnswer;
                  const subQText = a.questionDetails?.questions?.[sa.subQuestionIndex]?.questionText;
                  return (
                    <div key={sIdx} className={`etr-sub-item ${sa.isCorrect ? 'correct' : 'wrong'}`}>
                      <div className="etr-sub-top">
                        <span className={`etr-sub-icon ${sa.isCorrect ? 'correct' : 'wrong'}`}>{sa.isCorrect ? '✓' : '✗'}</span>
                        <span className="etr-sub-label">{subQText || `Part ${sa.subQuestionIndex + 1}`}</span>
                        <span className="etr-sub-score">{sa.points}/{sa.maxPoints}</span>
                      </div>
                      {!sa.isCorrect && refAnswer && <div className="etr-sub-ref">Expected: {refAnswer}</div>}
                      {sa.feedback && <div className="etr-sub-feedback">{sa.feedback}</div>}
                    </div>
                  );
                })}
              </div>
            )}

            {!hasAiFeedback && !hasSubAnswers && a.isCorrect && (
              <div className="etr-correct-msg">Great job! You answered this correctly.</div>
            )}
          </div>
        )}
      </div>
    );
  };

  const showPeerComparison = result.percentile != null && result.percentile > 0;

  return (
    <div className="etr-page">
      <div className="etr-header">
        <div>
          <h1 className="etr-title">{test?.title || 'English Test Result'}</h1>
          <p className="etr-subtitle">Submitted {result.submittedAt ? new Date(result.submittedAt).toLocaleString() : 'N/A'}</p>
        </div>
        <button className="etr-btn etr-btn-secondary" onClick={() => navigate('/student/dashboard')}>Back to Dashboard</button>
      </div>

      {/* Hero score section */}
      <div className="etr-hero">
        <div className="etr-hero-score">
          <svg viewBox="0 0 120 120" className="etr-ring">
            <circle cx="60" cy="60" r="52" fill="none" stroke="var(--border-color)" strokeWidth="8" />
            <circle cx="60" cy="60" r="52" fill="none" stroke={gradeColor} strokeWidth="8"
              strokeDasharray={`${(pct / 100) * 327} 327`} strokeLinecap="round"
              transform="rotate(-90 60 60)" className="etr-ring-fill" />
          </svg>
          <div className="etr-ring-text">
            <span className="etr-ring-pct" style={{ color: gradeColor }}>{pct}%</span>
            <span className="etr-ring-grade" style={{ color: gradeColor }}>{grade}</span>
          </div>
        </div>
        <div className="etr-hero-stats">
          <div className="etr-stat">
            <span className="etr-stat-value">{result.totalScore ?? 0}<small>/{result.maxScore ?? 0}</small></span>
            <span className="etr-stat-label">Total Score</span>
          </div>
          <div className="etr-stat">
            <span className="etr-stat-value">
              {result.timeSpent != null ? `${Math.floor(result.timeSpent / 60)}m ${result.timeSpent % 60}s` : '—'}
            </span>
            <span className="etr-stat-label">Time Spent</span>
          </div>
          <div className="etr-stat">
            <span className="etr-stat-value">{result.answers?.length ?? 0}</span>
            <span className="etr-stat-label">Questions</span>
          </div>
          {showPeerComparison && (
            <div className="etr-stat etr-stat-peer">
              <span className="etr-stat-value">Top {100 - result.percentile}%</span>
              <span className="etr-stat-label">Peer Rank</span>
            </div>
          )}
        </div>
      </div>

      {/* Section performance */}
      {sectionScores.length > 0 && (
        <div className="etr-sections-block">
          <h2 className="etr-block-title">Section Performance</h2>
          <div className="etr-sections-layout">
            <div className="etr-section-cards">
              {sectionScores.map(s => {
                const meta = SECTION_META[s.sectionType] || {};
                const sp = s.percentage || 0;
                return (
                  <div key={s.sectionType} className="etr-sec-card">
                    <div className="etr-sec-icon" style={{ background: meta.color || '#888' }}>{meta.icon || '?'}</div>
                    <div className="etr-sec-info">
                      <span className="etr-sec-name">{meta.label || s.sectionType}</span>
                      <div className="etr-sec-bar-wrap">
                        <div className="etr-sec-bar" style={{ width: `${sp}%`, background: sp >= 70 ? '#10b981' : sp >= 40 ? '#f59e0b' : '#ef4444' }} />
                      </div>
                    </div>
                    <div className="etr-sec-right">
                      <span className="etr-sec-pct" style={{ color: sp >= 70 ? '#10b981' : sp >= 40 ? '#f59e0b' : '#ef4444' }}>{sp}%</span>
                      <span className="etr-sec-pts">{s.score}/{s.maxScore}</span>
                    </div>
                  </div>
                );
              })}
            </div>
            {radarData.length > 2 && (
              <div className="etr-radar-wrap">
                <ResponsiveContainer width="100%" height={280}>
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="var(--border-color)" />
                    <PolarAngleAxis dataKey="section" tick={{ fill: 'var(--text-primary)', fontSize: 11 }} />
                    <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} axisLine={false} />
                    <Radar dataKey="score" stroke="#6366f1" fill="#6366f1" fillOpacity={0.2} strokeWidth={2} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Detailed answers */}
      <div className="etr-answers-block">
        <h2 className="etr-block-title">Detailed Results <span className="etr-count">({result.answers?.length ?? 0} questions)</span></h2>
        <div className="etr-answers-list">
          {result.answers?.length > 0 ? (
            result.answers.map((a, i) => renderAnswerCard(a, i))
          ) : (
            <p className="etr-empty">No answers recorded.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default EnglishTestResult;
