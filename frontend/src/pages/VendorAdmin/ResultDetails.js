import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axiosInstance from '../../utils/axios';
import './VendorAdminCommon.css';
import './ResultDetails.css';

const ENGLISH_TYPES = ['english_grammar', 'english_vocabulary', 'english_reading', 'english_essay', 'english_speaking', 'english_listening'];
const SUBJECTIVE_ENGLISH = ['english_grammar', 'english_reading', 'english_essay', 'english_speaking', 'english_listening'];

const SECTION_LABELS = {
  english_grammar: 'Grammar',
  english_vocabulary: 'Vocabulary',
  english_reading: 'Reading Comprehension',
  english_essay: 'Writing',
  english_speaking: 'Speaking',
  english_listening: 'Listening',
};

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000';

/** Safely convert any value to a string for React rendering (avoids "Objects are not valid as a React child") */
const safeText = (v) => {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (Array.isArray(v)) return v.map(safeText).join(', ');
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
};

const ResultDetails = () => {
  const { resultId } = useParams();
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [manualUpdates, setManualUpdates] = useState({});

  useEffect(() => {
    fetchResult();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run when resultId changes
  }, [resultId]);

  const fetchResult = async () => {
    try {
      const response = await axiosInstance.get(`/results/${resultId}`);
      setResult(response.data);
      const initialManual = {};
      (response.data?.answers || []).forEach(answer => {
        initialManual[answer._id] = {
          score: answer.manualOverride?.score ?? answer.points ?? 0,
          feedback: answer.manualOverride?.feedback || ''
        };
      });
      setManualUpdates(initialManual);
    } catch (error) {
      console.error('Error fetching result:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleManualChange = (answerId, field, value) => {
    setManualUpdates(prev => ({
      ...prev,
      [answerId]: {
        ...prev[answerId],
        [field]: value
      }
    }));
  };

  const handleManualSubmit = async (answerId) => {
    try {
      const payload = manualUpdates[answerId];
      await axiosInstance.patch(`/results/${resultId}/answers/${answerId}/manual-score`, {
        score: Number(payload?.score || 0),
        feedback: payload?.feedback || ''
      });
      await fetchResult();
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to update score');
    }
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  if (!result) {
    return <div className="error">Result not found</div>;
  }

  const isCorrect = (answer) => {
    if (answer.questionType === 'mcq' || answer.questionType === 'aptitude' || answer.questionType === 'sql') return answer.isCorrect;
    if (answer.questionType === 'theory') {
      return (answer.points || 0) >= (answer.maxPoints || 1) * 0.6;
    }
    if (ENGLISH_TYPES.includes(answer.questionType)) {
      return (answer.points || 0) >= (answer.maxPoints || 1) * 0.6;
    }
    return answer.testCasesPassed === answer.totalTestCases;
  };

  const isEnglishTest = result.testId?.type === 'english';
  const canManualOverride = (type) => type === 'theory' || SUBJECTIVE_ENGLISH.includes(type);

  const renderEnglishEvaluation = (answer) => {
    const ev = answer.englishEvaluation;
    if (!ev) return null;

    return (
      <div className="english-ai-eval-panel">
        <strong>AI Evaluation</strong>

        {ev.grammarScore != null && (
          <div className="eval-score-row">
            <span>Grammar</span>
            <div className="eval-bar-wrap"><div className="eval-bar" style={{ width: `${ev.grammarScore}%` }} /></div>
            <span className="eval-pct">{ev.grammarScore}%</span>
          </div>
        )}
        {ev.vocabularyScore != null && (
          <div className="eval-score-row">
            <span>Vocabulary</span>
            <div className="eval-bar-wrap"><div className="eval-bar" style={{ width: `${ev.vocabularyScore}%` }} /></div>
            <span className="eval-pct">{ev.vocabularyScore}%</span>
          </div>
        )}
        {ev.coherenceScore != null && (
          <div className="eval-score-row">
            <span>Coherence</span>
            <div className="eval-bar-wrap"><div className="eval-bar" style={{ width: `${ev.coherenceScore}%` }} /></div>
            <span className="eval-pct">{ev.coherenceScore}%</span>
          </div>
        )}
        {ev.structureScore != null && (
          <div className="eval-score-row">
            <span>Structure</span>
            <div className="eval-bar-wrap"><div className="eval-bar" style={{ width: `${ev.structureScore}%` }} /></div>
            <span className="eval-pct">{ev.structureScore}%</span>
          </div>
        )}
        {ev.toneScore != null && (
          <div className="eval-score-row">
            <span>Tone</span>
            <div className="eval-bar-wrap"><div className="eval-bar" style={{ width: `${ev.toneScore}%` }} /></div>
            <span className="eval-pct">{ev.toneScore}%</span>
          </div>
        )}
        {ev.relevanceScore != null && (
          <div className="eval-score-row">
            <span>Relevance</span>
            <div className="eval-bar-wrap"><div className="eval-bar" style={{ width: `${ev.relevanceScore}%` }} /></div>
            <span className="eval-pct">{ev.relevanceScore}%</span>
          </div>
        )}
        {ev.pronunciationScore != null && (
          <div className="eval-score-row">
            <span>Pronunciation</span>
            <div className="eval-bar-wrap"><div className="eval-bar" style={{ width: `${ev.pronunciationScore}%` }} /></div>
            <span className="eval-pct">{ev.pronunciationScore}%</span>
          </div>
        )}
        {ev.fluencyScore != null && (
          <div className="eval-score-row">
            <span>Fluency</span>
            <div className="eval-bar-wrap"><div className="eval-bar" style={{ width: `${ev.fluencyScore}%` }} /></div>
            <span className="eval-pct">{ev.fluencyScore}%</span>
          </div>
        )}
        {ev.confidenceScore != null && (
          <div className="eval-score-row">
            <span>Confidence</span>
            <div className="eval-bar-wrap"><div className="eval-bar" style={{ width: `${ev.confidenceScore}%` }} /></div>
            <span className="eval-pct">{ev.confidenceScore}%</span>
          </div>
        )}
        {ev.accuracyScore != null && (
          <div className="eval-score-row">
            <span>Accuracy</span>
            <div className="eval-bar-wrap"><div className="eval-bar" style={{ width: `${ev.accuracyScore}%` }} /></div>
            <span className="eval-pct">{ev.accuracyScore}%</span>
          </div>
        )}
        {ev.clarityScore != null && (
          <div className="eval-score-row">
            <span>Clarity</span>
            <div className="eval-bar-wrap"><div className="eval-bar" style={{ width: `${ev.clarityScore}%` }} /></div>
            <span className="eval-pct">{ev.clarityScore}%</span>
          </div>
        )}

        {ev.transcription && (
          <div className="eval-transcription">
            <strong>Transcription:</strong>
            <p>{safeText(ev.transcription)}</p>
          </div>
        )}

        {ev.feedback && (
          <div className="eval-feedback-text">
            <strong>Feedback:</strong>
            <p>{safeText(ev.feedback)}</p>
          </div>
        )}

        {ev.suggestions && ev.suggestions.length > 0 && (
          <div className="eval-suggestions">
            <strong>Suggestions:</strong>
            <ul>
              {ev.suggestions.map((s, i) => <li key={i}>{safeText(s)}</li>)}
            </ul>
          </div>
        )}

        {ev.plagiarism && (
          <div className={`plagiarism-panel ${ev.plagiarism.suspicionLevel || 'none'}`}>
            <strong>Plagiarism Check</strong>
            <div className="plagiarism-details">
              <div className="plagiarism-score-row">
                <span>Originality:</span>
                <strong>{ev.plagiarism.originalityScore ?? '-'}%</strong>
              </div>
              <div className="plagiarism-score-row">
                <span>Cross-submission similarity:</span>
                <strong>{ev.plagiarism.crossSubmissionSimilarity ?? 0}%</strong>
              </div>
              <div className="plagiarism-score-row">
                <span>Suspicion level:</span>
                <strong className={`suspicion-${ev.plagiarism.suspicionLevel}`}>{ev.plagiarism.suspicionLevel || 'none'}</strong>
              </div>
            </div>
            {ev.plagiarism.indicators && ev.plagiarism.indicators.length > 0 && (
              <div className="plagiarism-indicators">
                {ev.plagiarism.indicators.map((ind, i) => <span key={i} className="indicator-tag">{safeText(ind)}</span>)}
              </div>
            )}
            {ev.plagiarism.feedback && <p className="plagiarism-feedback">{safeText(ev.plagiarism.feedback)}</p>}
          </div>
        )}
      </div>
    );
  };

  const renderEnglishAnswer = (answer) => {
    const qType = answer.questionType;

    if (qType === 'english_grammar' || qType === 'english_vocabulary') {
      return (
        <div className="english-answer-content">
          <div className="detail-item">
            <strong>Answer:</strong> {safeText(answer.answer) || 'Not answered'}
          </div>
          {answer.isCorrect != null && (
            <div className={`detail-item ${answer.isCorrect ? 'correct' : 'incorrect'}`}>
              <strong>Result:</strong> {answer.isCorrect ? '✓ Correct' : '✗ Incorrect'}
            </div>
          )}
        </div>
      );
    }

    if (qType === 'english_reading' || qType === 'english_listening') {
      return (
        <div className="english-answer-content">
          {answer.subAnswers && answer.subAnswers.length > 0 ? (
            <div className="sub-answers-list">
              <strong>Sub-Answers:</strong>
              {answer.subAnswers.map((sub, i) => (
                <div key={i} className={`sub-answer-item ${sub.isCorrect ? 'correct' : sub.isCorrect === false ? 'incorrect' : ''}`}>
                  <span className="sub-q-num">Q{i + 1}</span>
                  <span className="sub-answer-text">{safeText(sub.answer) || '(no answer)'}</span>
                  {sub.isCorrect != null && (
                    <span className={`sub-answer-badge ${sub.isCorrect ? 'correct' : 'incorrect'}`}>
                      {sub.isCorrect ? '✓' : '✗'}
                    </span>
                  )}
                  {sub.points != null && (
                    <span className="sub-answer-pts">{sub.points}/{sub.maxPoints || '?'} pts</span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="detail-item">
              <strong>Answer:</strong> {safeText(answer.answer) || 'Not answered'}
            </div>
          )}
        </div>
      );
    }

    if (qType === 'english_essay') {
      return (
        <div className="english-answer-content">
          {answer.essayContent ? (
            <div className="essay-content-preview">
              <strong>Student Response:</strong>
              <div className="essay-text" dangerouslySetInnerHTML={{ __html: answer.essayContent }} />
              {answer.wordCount != null && (
                <div className="essay-word-count">Word count: {answer.wordCount}</div>
              )}
            </div>
          ) : (
            <div className="detail-item"><strong>Answer:</strong> Not answered</div>
          )}
        </div>
      );
    }

    if (qType === 'english_speaking') {
      return (
        <div className="english-answer-content">
          {answer.audioFileUrl && (
            <div className="speaking-audio-preview">
              <strong>Recording:</strong>
              <audio controls src={`${API_BASE}${answer.audioFileUrl}`} />
            </div>
          )}
          {!answer.audioFileUrl && (
            <div className="detail-item"><strong>Answer:</strong> No recording submitted</div>
          )}
        </div>
      );
    }

    return (
      <div className="detail-item">
        <strong>Answer:</strong> {safeText(answer.answer) || 'Not answered'}
      </div>
    );
  };

  const renderManualOverride = (answer) => {
    if (!canManualOverride(answer.questionType)) return null;

    return (
      <div className="manual-override-panel">
        <strong>Manual Override</strong>
        <div className="manual-override-controls">
          <input
            type="number"
            min="0"
            max={answer.maxPoints || 10}
            value={manualUpdates[answer._id]?.score ?? ''}
            onChange={(e) => handleManualChange(answer._id, 'score', e.target.value)}
            className="manual-score-input"
          />
          <input
            type="text"
            placeholder="Feedback (optional)"
            value={manualUpdates[answer._id]?.feedback ?? ''}
            onChange={(e) => handleManualChange(answer._id, 'feedback', e.target.value)}
            className="manual-feedback-input"
          />
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            onClick={() => handleManualSubmit(answer._id)}
          >
            Update Score
          </button>
        </div>
        {answer.manualOverride?.isManual && (
          <p className="manual-override-timestamp">
            Manual override applied on {new Date(answer.manualOverride.updatedAt).toLocaleString()}
          </p>
        )}
      </div>
    );
  };

  const getTypeBadgeLabel = (type) => {
    if (SECTION_LABELS[type]) return SECTION_LABELS[type];
    return type.toUpperCase();
  };

  return (
    <div className="container result-details-page">
      <div className="page-header">
        <Link to={`/vendor-admin/tests/${result.testId?._id}/results`} className="btn btn-secondary" style={{ marginBottom: '20px' }}>
          ← Back to Results
        </Link>
        <h1 className="page-title">Result Details</h1>
      </div>

      <div className="info-card-modern">
        <h2>Student Information</h2>
        <div className="info-item">
          <strong>Name:</strong>
          <span>{result.studentId?.name}</span>
        </div>
        <div className="info-item">
          <strong>Email:</strong>
          <span>{result.studentId?.email}</span>
        </div>
        <div className="info-item">
          <strong>Test:</strong>
          <span>{result.testId?.title}</span>
        </div>
        <div className="info-item">
          <strong>Started At:</strong>
          <span>{new Date(result.startedAt).toLocaleString()}</span>
        </div>
        <div className="info-item">
          <strong>Submitted At:</strong>
          <span>{result.submittedAt ? new Date(result.submittedAt).toLocaleString() : 'Not submitted'}</span>
        </div>
        <div className="info-item">
          <strong>Time Spent:</strong>
          <span>{Math.floor(result.timeSpent / 60)} minutes {result.timeSpent % 60} seconds</span>
        </div>
        {result.violationCount > 0 && (
          <>
            <div className="info-item">
              <strong>Violations:</strong>
              <span style={{ color: result.violationCount >= 3 ? '#ff4444' : '#ff9800', fontWeight: 'bold' }}>
                {result.violationCount}
              </span>
            </div>
            {result.autoSubmitted && (
              <div className="info-item">
                <strong>Status:</strong>
                <span style={{ color: '#ff4444', fontWeight: 'bold' }}>Auto-submitted due to violations</span>
              </div>
            )}
          </>
        )}
        {result.violations && result.violations.length > 0 && (
          <div className="info-item" style={{ gridColumn: '1 / -1', marginTop: '20px' }}>
            <strong>Violation Details:</strong>
            <div style={{ marginTop: '10px', padding: '15px', background: '#fff3cd', borderRadius: '8px', border: '1px solid #ffc107' }}>
              {result.violations.map((violation, idx) => (
                <div key={idx} style={{ padding: '8px', background: 'white', borderRadius: '5px', marginBottom: '8px', fontSize: '0.9em' }}>
                  <strong>{violation.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</strong>
                  {violation.details && <span style={{ color: '#666', marginLeft: '10px' }}>- {safeText(violation.details)}</span>}
                  <span style={{ float: 'right', color: '#999' }}>
                    {new Date(violation.timestamp).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="info-card-modern">
        <h2>Score Summary</h2>
        <div className="score-summary-modern">
          <div className="stat-card-result">
            <h3>Total Score</h3>
            <p className="stat-number-result">{result.totalScore} / {result.maxScore}</p>
          </div>
          <div className="stat-card-result">
            <h3>Percentage</h3>
            <p className="stat-number-result">{result.percentage}%</p>
          </div>
          <div className="stat-card-result">
            <h3>Status</h3>
            <p className="stat-number-result" style={{ fontSize: '1.2em' }}>
              <span className={`status-badge ${result.status === 'completed' ? 'active' : 'inactive'}`}>
                {result.status}
              </span>
            </p>
          </div>
        </div>
      </div>

      {isEnglishTest && result.sectionScores && result.sectionScores.length > 0 && (
        <div className="info-card-modern">
          <h2>Section Scores</h2>
          <div className="english-section-scores-grid">
            {result.sectionScores.map((sec, idx) => {
              const pct = sec.maxScore > 0 ? Math.round((sec.score / sec.maxScore) * 100) : 0;
              return (
                <div key={idx} className="english-section-score-card">
                  <h4>{SECTION_LABELS[sec.sectionType] || sec.sectionType}</h4>
                  <div className="section-score-bar-wrap">
                    <div
                      className={`section-score-bar ${pct >= 70 ? 'excellent' : pct >= 50 ? 'good' : 'poor'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="section-score-label">
                    {sec.score} / {sec.maxScore} ({pct}%)
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="info-card-modern">
        <h2>Question-wise Breakdown</h2>
        {result.answers?.map((answer, index) => {
          const correct = isCorrect(answer);
          const isEnglishQ = ENGLISH_TYPES.includes(answer.questionType);

          return (
            <div key={index} className={`question-breakdown-card ${correct ? 'correct' : 'incorrect'}`}>
              <div className="question-breakdown-header">
                <h4>Question {index + 1}</h4>
                <span className={`question-type-badge-detail ${answer.questionType}`}>
                  {getTypeBadgeLabel(answer.questionType)}
                </span>
              </div>
              
              <div className="breakdown-details">
                <div className={`detail-item ${correct ? 'correct' : 'incorrect'}`}>
                  <strong>Points:</strong> {answer.points} / {answer.maxPoints}
                </div>
                {answer.questionType === 'coding' && (
                  <>
                    <div className="detail-item">
                      <strong>Language:</strong> {answer.language || 'N/A'}
                    </div>
                    <div className="detail-item">
                      <strong>Test Cases:</strong> {answer.testCasesPassed || 0} / {answer.totalTestCases || 0} passed
                    </div>
                  </>
                )}
                {answer.questionType === 'mcq' && (
                  <div className="detail-item">
                    <strong>Selected:</strong> {answer.answer !== undefined ? `Option ${answer.answer + 1}` : 'Not answered'}
                  </div>
                )}
                {answer.questionType === 'aptitude' && (
                  <div className="detail-item">
                    <strong>Answer:</strong> {Array.isArray(answer.answer) ? answer.answer.map(val => (typeof val === 'number' ? val + 1 : val)).join(', ') : safeText(answer.answer) || 'Not answered'}
                  </div>
                )}
                {answer.questionType === 'theory' && (
                  <div className="detail-item">
                    <strong>Answer:</strong> {typeof answer.answer === 'string' ? `${answer.answer.slice(0, 120)}...` : (safeText(answer.answer) || 'Not answered')}
                  </div>
                )}
                {answer.questionType === 'sql' && (
                  <div className={`detail-item ${answer.isCorrect ? 'correct' : 'incorrect'}`}>
                    <strong>Result:</strong> {answer.isCorrect ? '✓ Correct output' : '✗ Incorrect output'}
                  </div>
                )}
                {answer.flagged && (
                  <div className="detail-item flagged">
                    <strong>Flagged for Review</strong>
                  </div>
                )}
              </div>

              {isEnglishQ && renderEnglishAnswer(answer)}

              {answer.questionType === 'theory' && (
                <div className="english-ai-eval-panel">
                  <strong>AI Evaluation:</strong>
                  <div style={{ marginTop: '8px', display: 'grid', gap: '6px' }}>
                    <div>Similarity: {(answer.evaluation?.similarityScore || 0).toFixed(2)}</div>
                    <div>Concept Coverage: {(answer.evaluation?.conceptScore || 0).toFixed(2)}</div>
                    <div>Depth & Clarity: {(answer.evaluation?.depthScore || 0).toFixed(2)}</div>
                    {answer.evaluation?.penalty > 0 && (
                      <div>Penalty: -{answer.evaluation.penalty.toFixed(2)}</div>
                    )}
                  </div>
                  {answer.evaluation?.feedback && (
                    <div style={{ marginTop: '8px' }}>
                      <strong>Feedback:</strong>
                      <p style={{ marginTop: '4px' }}>{safeText(answer.evaluation.feedback)}</p>
                    </div>
                  )}
                  {answer.evaluation?.missingConcepts?.length > 0 && (
                    <div style={{ marginTop: '6px' }}>
                      <strong>Missing Concepts:</strong> {answer.evaluation.missingConcepts.join(', ')}
                    </div>
                  )}
                </div>
              )}

              {isEnglishQ && renderEnglishEvaluation(answer)}

              {renderManualOverride(answer)}
              
              {answer.questionType === 'coding' && answer.answer != null && (
                <div className="code-block">
                  <strong>Code:</strong>
                  <pre>{typeof answer.answer === 'string' ? answer.answer : safeText(answer.answer)}</pre>
                </div>
              )}
              {answer.questionType === 'sql' && (
                <div className="code-block">
                  <strong>Submitted SQL:</strong>
                  <pre>{typeof answer.answer === 'string' ? answer.answer : (safeText(answer.answer) || '(No answer)')}</pre>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ResultDetails;
