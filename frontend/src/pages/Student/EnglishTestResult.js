import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import axiosInstance from '../../utils/axios';
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend, ResponsiveContainer } from 'recharts';
import './EnglishTestResult.css';

const SECTION_ICONS = {
  grammar: 'Aa',
  vocabulary: 'Ab',
  reading: 'Rc',
  writing: 'Es',
  speaking: 'Sp',
  listening: 'Li'
};

const STORAGE_KEY = 'englishResultFromSubmit';

const EnglishTestResult = () => {
  const { resultId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const resultFromState = location.state?.resultFromSubmit;
  const resultFromStorage = (() => {
    if (resultFromState) return null;
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      const id = data?._id?.toString?.() || data?._id;
      if (id && resultId && id === resultId.toString()) return data;
      return null;
    } catch {
      return null;
    }
  })();
  const resultFromSubmit = resultFromState || resultFromStorage;
  const [result, setResult] = useState(resultFromSubmit || null);
  const [test, setTest] = useState(null);
  const [loading, setLoading] = useState(!resultFromSubmit);
  const [activeSection, setActiveSection] = useState(null);
  const [fetchError, setFetchError] = useState(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw || !resultId) return;
      const data = JSON.parse(raw);
      const id = data?._id?.toString?.() || data?._id;
      if (id && resultId && id === resultId.toString()) sessionStorage.removeItem(STORAGE_KEY);
    } catch (_) {}
  }, [resultId]);

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
      console.error('Error fetching result:', error);
      setFetchError(error.response?.data?.message || error.message);
      if (!resultFromSubmit) setResult(null);
    } finally {
      setLoading(false);
    }
  }, [resultId, resultFromSubmit]);

  useEffect(() => {
    if (!resultId) return;
    fetchResult();
  }, [resultId, fetchResult]);

  useEffect(() => {
    if (!result?.testId || test) return;
    const testId = typeof result.testId === 'object' ? result.testId._id : result.testId;
    if (!testId) return;
    axiosInstance.get(`/tests/${testId}`)
      .then((res) => setTest(res.data))
      .catch(() => {});
  }, [result?.testId, test]);

  if (loading && !result) return <div className="english-result-loading">Loading results...</div>;
  if (!result && fetchError) {
    return (
      <div className="english-test-result container">
        <div className="result-header">
          <h1 className="page-title">Test Submitted</h1>
          <button className="btn btn-secondary" onClick={() => navigate('/student/dashboard')}>Back to Dashboard</button>
        </div>
        <div className="result-submitted-message">
          <p>Your test was submitted successfully.</p>
          <p>If results do not load here, go to your Dashboard and open the result for this test.</p>
          <button type="button" className="btn btn-primary" onClick={() => navigate('/student/dashboard')}>Go to Dashboard</button>
        </div>
      </div>
    );
  }
  if (!result) return <div className="english-result-loading">Result not found.</div>;

  const sectionScores = result.sectionScores || [];
  const radarData = sectionScores.map(s => ({
    section: s.sectionType?.charAt(0).toUpperCase() + s.sectionType?.slice(1),
    score: s.percentage || 0,
    fullMark: 100
  }));

  const grade = result.percentage >= 90 ? 'A+' : result.percentage >= 80 ? 'A' : result.percentage >= 70 ? 'B+' : result.percentage >= 60 ? 'B' : result.percentage >= 50 ? 'C' : 'D';
  const API_BASE = process.env.REACT_APP_API_URL || '';

  const getSectionAnswers = (sectionType) => {
    if (!result.answers?.length) return [];
    if (!sectionType) return result.answers;
    if (!test?.questions) return [];
    const sectionQIds = test.questions.filter(q => q.sectionId === sectionType).map(q => q.questionId?._id || q.questionId);
    return result.answers.filter(a => sectionQIds.includes(a.questionId?.toString?.() || a.questionId));
  };

  /** Get section type (e.g. 'grammar') for an answer from test.questions */
  const getAnswerSectionType = (answer) => {
    if (!test?.questions?.length) return answer.sectionId || null;
    const q = test.questions.find(
      qq => (qq.questionId?._id || qq.questionId)?.toString() === (answer.questionId?.toString?.() || answer.questionId)
    );
    return q?.sectionId || answer.sectionId || null;
  };

  /** Get section label for display (e.g. 'Grammar') */
  const getAnswerSectionLabel = (answer) => {
    const sectionId = getAnswerSectionType(answer);
    return sectionId ? String(sectionId).charAt(0).toUpperCase() + String(sectionId).slice(1) : null;
  };

  /** Format "Your answer" for display (string, number, array, essay) */
  const formatYourAnswer = (a) => {
    if (a.essayContent && typeof a.essayContent === 'string') return a.essayContent;
    if (a.answer === undefined || a.answer === null) return null;
    if (typeof a.answer === 'string') return a.answer;
    if (typeof a.answer === 'number') return String(a.answer);
    if (Array.isArray(a.answer)) {
      if (a.questionDetails?.subType === 'parajumble' && Array.isArray(a.questionDetails?.sentences)) {
        const parts = a.answer.map(idx => a.questionDetails.sentences[idx]).filter(Boolean);
        return parts.length ? parts.join(' → ') : a.answer.join(', ');
      }
      return a.answer.map(v => (typeof v === 'object' ? JSON.stringify(v) : v)).join(', ');
    }
    try { return JSON.stringify(a.answer); } catch (_) { return String(a.answer); }
  };

  const renderScoreBar = (label, score, max = 1) => {
    const pct = Math.round((score / max) * 100);
    return (
      <div className="score-bar-row">
        <span className="score-bar-label">{label}</span>
        <div className="score-bar-track">
          <div className="score-bar-fill" style={{ width: `${pct}%`, backgroundColor: pct >= 70 ? '#28a745' : pct >= 40 ? '#ffc107' : '#dc3545' }} />
        </div>
        <span className="score-bar-value">{pct}%</span>
      </div>
    );
  };

  const renderEssayFeedback = (answer) => {
    const ev = answer.englishEvaluation;
    if (!ev) return <p className="no-feedback">Evaluation pending</p>;
    return (
      <div className="ai-feedback-panel writing-only-feedback">
        <h4>AI Review</h4>
        {renderScoreBar('Grammar', ev.grammarScore || 0)}
        {renderScoreBar('Vocabulary', ev.vocabularyScore || 0)}
        {renderScoreBar('Coherence', ev.coherenceScore || 0)}
        {renderScoreBar('Structure', ev.structureScore || 0)}
        {renderScoreBar('Tone', ev.toneScore || 0)}
        {renderScoreBar('Relevance', ev.relevanceScore || 0)}
        {ev.detailedFeedback && <div className="feedback-text"><h5>Feedback</h5><p>{ev.detailedFeedback}</p></div>}
        {ev.suggestions?.length > 0 && (
          <div className="suggestions-list"><h5>Suggestions for Improvement</h5><ul>{ev.suggestions.map((s, i) => <li key={i}>{s}</li>)}</ul></div>
        )}
      </div>
    );
  };

  const renderSpeakingFeedback = (answer) => {
    const ev = answer.englishEvaluation;
    if (!ev) return <p className="no-feedback">Evaluation pending</p>;
    return (
      <div className="ai-feedback-panel">
        <h4>AI Evaluation</h4>
        {answer.audioFileUrl && <div className="playback-section"><audio controls src={`${API_BASE}${answer.audioFileUrl}`} /></div>}
        {ev.transcription && <div className="transcription-box"><h5>Transcription</h5><p>{ev.transcription}</p></div>}
        {renderScoreBar('Pronunciation', ev.pronunciationScore || 0)}
        {renderScoreBar('Fluency', ev.fluencyScore || 0)}
        {renderScoreBar('Coherence', ev.coherenceScore || 0)}
        {renderScoreBar('Vocabulary', ev.vocabularyScore || 0)}
        {renderScoreBar('Grammar', ev.grammarScore || 0)}
        {renderScoreBar('Confidence', ev.confidenceScore || 0)}
        <div className="speaking-metrics">
          {ev.speakingRate && <span>Speaking Rate: {ev.speakingRate} wpm</span>}
          {ev.pauseAnalysis && <span>Pauses: {ev.pauseAnalysis.totalPauses}</span>}
          {ev.fillerWords !== undefined && <span>Filler Words: {ev.fillerWords}</span>}
          {ev.vocabularyDiversity !== undefined && <span>Vocab Diversity: {Math.round(ev.vocabularyDiversity * 100)}%</span>}
        </div>
        {ev.detailedFeedback && <div className="feedback-text"><h5>Feedback</h5><p>{ev.detailedFeedback}</p></div>}
      </div>
    );
  };

  const getCorrectAnswerText = (a) => {
    const qd = a.questionDetails;
    if (!qd) return null;
    if (qd.options && (qd.correctAnswer === 0 || qd.correctAnswer)) {
      const idx = typeof qd.correctAnswer === 'number' ? qd.correctAnswer : parseInt(qd.correctAnswer, 10);
      const opt = qd.options[idx];
      return opt?.text || `Option ${idx + 1}`;
    }
    return qd.correctAnswer != null ? String(qd.correctAnswer) : null;
  };

  const renderSectionDetail = (sectionType) => {
    const answers = getSectionAnswers(sectionType);
    if (answers.length === 0) return <p className="no-answers-msg">No answers for this section.</p>;

    return (
      <div className="section-detail">
        {answers.map((a, i) => {
          const isWriting = getAnswerSectionType(a) === 'writing';
          return (
          <div key={i} className={`answer-card ${a.isCorrect ? 'correct' : a.points > 0 ? 'partial' : 'incorrect'} ${isWriting ? 'writing-result-card' : ''}`}>
            <div className="answer-header">
              <span>Question {i + 1}</span>
              <span className="answer-score"><strong>Score:</strong> {a.points || 0} / {a.maxPoints || 0} pts</span>
            </div>
            {(a.questionDetails?.questionText || a.questionDetails?.word || a.questionDetails?.prompt) && (
              <div className="question-preview">
                <strong>Question:</strong> {a.questionDetails.questionText || a.questionDetails.word || a.questionDetails.prompt}
              </div>
            )}
            {(formatYourAnswer(a) || (isWriting && (a.essayContent || a.answer))) && (
              <div className="your-answer-preview">
                <strong>Your answer:</strong>{' '}
                {isWriting && (a.essayContent || a.answer) ? (
                  (() => {
                    const raw = typeof a.essayContent === 'string' ? a.essayContent : (a.answer || '');
                    const plain = raw.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
                    return plain ? <span>{plain}</span> : null;
                  })()
                ) : (
                  formatYourAnswer(a)
                )}
              </div>
            )}
            {a.note && (
              <div className="answer-note">
                <strong>Your note:</strong> {a.note}
              </div>
            )}
            {getAnswerSectionType(a) === 'writing' && renderEssayFeedback(a)}
            {getAnswerSectionType(a) === 'speaking' && renderSpeakingFeedback(a)}
            {(a.englishEvaluation?.detailedFeedback || a.englishEvaluation?.feedback) && getAnswerSectionType(a) !== 'writing' && getAnswerSectionType(a) !== 'speaking' && (
              <div className="feedback-text ai-feedback-inline">
                <h5>Feedback</h5>
                <p>{a.englishEvaluation.detailedFeedback || a.englishEvaluation.feedback}</p>
                {a.englishEvaluation?.suggestions?.length > 0 && (
                  <ul className="suggestions-inline">{a.englishEvaluation.suggestions.map((s, j) => <li key={j}>{s}</li>)}</ul>
                )}
              </div>
            )}
            {a.subAnswers?.length > 0 && (
              <div className="sub-answers-list">
                {a.subAnswers.map((sa, sIdx) => {
                  const refAnswer = a.questionDetails?.questions?.[sa.subQuestionIndex]?.referenceAnswer;
                  return (
                    <div key={sIdx} className={`sub-answer ${sa.isCorrect ? 'correct' : 'incorrect'}`}>
                      <span>Q{sa.subQuestionIndex + 1}: {sa.isCorrect ? 'Correct' : 'Incorrect'}</span>
                      <span>{sa.points}/{sa.maxPoints}</span>
                      {!sa.isCorrect && refAnswer && (
                        <div className="sub-answer-reference">Reference: {refAnswer}</div>
                      )}
                      {sa.feedback && (
                        <div className="sub-answer-feedback">Feedback: {sa.feedback}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            {getAnswerSectionType(a) !== 'writing' && getAnswerSectionType(a) !== 'speaking' && a.isCorrect === false && (a.questionDetails?.explanation || getCorrectAnswerText(a)) && (
              <div className="wrong-answer-review">
                <h5>Review</h5>
                {getCorrectAnswerText(a) && <p><strong>Correct answer:</strong> {getCorrectAnswerText(a)}</p>}
                {a.questionDetails?.explanation && <p><strong>Explanation:</strong> {a.questionDetails.explanation}</p>}
              </div>
            )}
          </div>
          );
        })}
      </div>
    );
  };

  const showPeerComparison = result.percentile != null && result.percentile > 0;

  return (
    <div className="english-test-result container">
      <div className="result-header">
        <div>
          <h1 className="page-title">{test?.title || 'English Test Result'}</h1>
          <p className="result-subtitle">Submitted {result.submittedAt ? new Date(result.submittedAt).toLocaleString() : 'N/A'}</p>
        </div>
        <button className="btn btn-secondary" onClick={() => navigate('/student/dashboard')}>Back to Dashboard</button>
      </div>

      {/* Summary cards - same style as other test types */}
      <div className="result-summary-modern">
        <div className="stat-card-modern score">
          <h3>Score</h3>
          <p className="stat-number-modern">{result.totalScore ?? 0} / {result.maxScore ?? 0}</p>
        </div>
        <div className="stat-card-modern percentage">
          <h3>Percentage</h3>
          <p className="stat-number-modern">{result.percentage ?? 0}%</p>
        </div>
        <div className="stat-card-modern time">
          <h3>Time Spent</h3>
          <p className="stat-number-modern">
            {result.timeSpent != null
              ? `${Math.floor(result.timeSpent / 60)}m ${result.timeSpent % 60}s`
              : '—'}
          </p>
        </div>
        <div className="stat-card-modern grade-card">
          <h3>Grade</h3>
          <p className={`stat-grade stat-grade-${String(grade).replace('+', 'plus')}`}>{grade}</p>
        </div>
      </div>

      {showPeerComparison && (
        <div className="peer-comparison-banner">
          <span className="peer-label">Peer comparison</span>
          <span className="peer-value">You scored better than {result.percentile}% of test-takers</span>
        </div>
      )}

      {radarData.length > 0 && (
        <div className="radar-card">
          <h3 className="section-title-modern">Section Performance</h3>
          <ResponsiveContainer width="100%" height={300}>
            <RadarChart data={radarData}>
              <PolarGrid />
              <PolarAngleAxis dataKey="section" tick={{ fill: 'var(--text-primary)', fontSize: 12 }} />
              <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} />
              <Radar name="Score" dataKey="score" stroke="#007bff" fill="#007bff" fillOpacity={0.25} />
              <Legend />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="section-scores-wrap">
        <h3 className="section-title-modern">Scores by Section</h3>
        <div className="section-scores-grid">
        {sectionScores.map(s => (
          <div
            key={s.sectionType}
            className={`section-score-card ${activeSection === s.sectionType ? 'active' : ''}`}
            onClick={() => setActiveSection(activeSection === s.sectionType ? null : s.sectionType)}
          >
            <div className="ss-icon">{SECTION_ICONS[s.sectionType] || '?'}</div>
            <div className="ss-info">
              <span className="ss-name">{s.sectionType?.charAt(0).toUpperCase() + s.sectionType?.slice(1)}</span>
              <span className="ss-score">{s.score} / {s.maxScore}</span>
            </div>
            <div className={`ss-pct ${s.percentage >= 70 ? 'good' : s.percentage >= 40 ? 'avg' : 'poor'}`}>{s.percentage}%</div>
          </div>
        ))}
        </div>
        {activeSection && (
          <div className="section-detail-expanded">
            <h4>{activeSection?.charAt(0).toUpperCase() + activeSection?.slice(1)} Details</h4>
            {renderSectionDetail(activeSection)}
          </div>
        )}
      </div>

      {/* Detailed results - every question/answer shown (no grouping so none are missed) */}
      <div className="questions-results-section">
        <h2 className="section-title-modern">Detailed Results ({result.answers?.length ?? 0} questions)</h2>
        {result.answers?.length > 0 ? (
          <div className="section-detail all-answers-list">
            {result.answers.map((a, i) => {
              const isWriting = getAnswerSectionType(a) === 'writing';
              return (
              <div key={a.questionId?.toString?.() || i} className={`answer-card ${a.isCorrect ? 'correct' : a.points > 0 ? 'partial' : 'incorrect'} ${isWriting ? 'writing-result-card' : ''}`}>
                <div className="answer-header">
                  <span>
                    Question {i + 1}
                    {getAnswerSectionLabel(a) && <span className="answer-section-badge">{getAnswerSectionLabel(a)}</span>}
                  </span>
                  <span className="answer-score"><strong>Score:</strong> {a.points ?? 0} / {a.maxPoints ?? 0} pts</span>
                </div>
                {(a.questionDetails?.questionText || a.questionDetails?.word || a.questionDetails?.prompt) && (
                  <div className="question-preview">
                    <strong>Question:</strong> {a.questionDetails.questionText || a.questionDetails.word || a.questionDetails.prompt}
                  </div>
                )}
                {(formatYourAnswer(a) || (isWriting && (a.essayContent || a.answer))) && (
                  <div className="your-answer-preview">
                    <strong>Your answer:</strong>{' '}
                    {isWriting && (a.essayContent || a.answer) ? (
                      (() => {
                        const raw = typeof a.essayContent === 'string' ? a.essayContent : (a.answer || '');
                        const plain = raw.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
                        return plain ? <span>{plain}</span> : null;
                      })()
                    ) : (
                      formatYourAnswer(a)
                    )}
                  </div>
                )}
                {a.note && (
                  <div className="answer-note">
                    <strong>Your note:</strong> {a.note}
                  </div>
                )}
                {isWriting && renderEssayFeedback(a)}
                {getAnswerSectionType(a) === 'speaking' && renderSpeakingFeedback(a)}
                {/* AI feedback for grammar and other non-writing/speaking types */}
                {(a.englishEvaluation?.detailedFeedback || a.englishEvaluation?.feedback) && getAnswerSectionType(a) !== 'writing' && getAnswerSectionType(a) !== 'speaking' && (
                  <div className="feedback-text ai-feedback-inline">
                    <h5>AI Feedback</h5>
                    <p>{a.englishEvaluation.detailedFeedback || a.englishEvaluation.feedback}</p>
                    {a.englishEvaluation?.suggestions?.length > 0 && (
                      <ul className="suggestions-inline">{a.englishEvaluation.suggestions.map((s, i) => <li key={i}>{s}</li>)}</ul>
                    )}
                  </div>
                )}
                {a.subAnswers?.length > 0 && (
                  <div className="sub-answers-list">
                    {a.subAnswers.map((sa, sIdx) => {
                      const refAnswer = a.questionDetails?.questions?.[sa.subQuestionIndex]?.referenceAnswer;
                      return (
                        <div key={sIdx} className={`sub-answer ${sa.isCorrect ? 'correct' : 'incorrect'}`}>
                          <span>Q{sa.subQuestionIndex + 1}: {sa.isCorrect ? 'Correct' : 'Incorrect'}</span>
                          <span>{sa.points}/{sa.maxPoints}</span>
                          {!sa.isCorrect && refAnswer && (
                            <div className="sub-answer-reference">Reference: {refAnswer}</div>
                          )}
                          {sa.feedback && (
                            <div className="sub-answer-feedback">AI feedback: {sa.feedback}</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
                {getAnswerSectionType(a) !== 'writing' && getAnswerSectionType(a) !== 'speaking' && a.isCorrect === false && (a.questionDetails?.explanation || getCorrectAnswerText(a)) && (
                  <div className="wrong-answer-review">
                    <h5>Review</h5>
                    {getCorrectAnswerText(a) && <p><strong>Correct answer:</strong> {getCorrectAnswerText(a)}</p>}
                    {a.questionDetails?.explanation && <p><strong>Explanation:</strong> {a.questionDetails.explanation}</p>}
                  </div>
                )}
              </div>
            );
            })}
          </div>
        ) : (
          <p className="no-answers-msg">No answers recorded for this test.</p>
        )}
      </div>
    </div>
  );
};

export default EnglishTestResult;
