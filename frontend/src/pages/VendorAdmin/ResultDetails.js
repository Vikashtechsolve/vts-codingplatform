import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  FiAlertTriangle,
  FiClock,
  FiFlag,
  FiMonitor,
  FiPercent,
  FiSend,
} from 'react-icons/fi';
import axiosInstance from '../../utils/axios';
import { resolveMediaUrl } from '../../utils/mediaUrl';
import VendorAssessPage from '../../components/VendorAdmin/VendorAssessPage';
import VendorStatusBadge from '../../components/VendorAdmin/VendorStatusBadge';
import { formatDateTime, scoreTone } from '../../utils/vendorAssessmentUi';
import './ResultDetails.css';

const ENGLISH_TYPES = [
  'english_grammar',
  'english_vocabulary',
  'english_reading',
  'english_essay',
  'english_speaking',
  'english_listening',
];
const SUBJECTIVE_ENGLISH = [
  'english_grammar',
  'english_reading',
  'english_essay',
  'english_speaking',
  'english_listening',
];

const SECTION_LABELS = {
  english_grammar: 'Grammar',
  english_vocabulary: 'Vocabulary',
  english_reading: 'Reading',
  english_essay: 'Writing',
  english_speaking: 'Speaking',
  english_listening: 'Listening',
  grammar: 'Grammar',
  vocabulary: 'Vocabulary',
  reading: 'Reading',
  writing: 'Writing',
  speaking: 'Speaking',
  listening: 'Listening',
};

const TYPE_META = {
  coding: { label: 'Coding', color: '#2563eb', icon: '{ }' },
  mcq: { label: 'MCQ', color: '#7c3aed', icon: 'AB' },
  aptitude: { label: 'Aptitude', color: '#059669', icon: 'Nu' },
  theory: { label: 'Theory', color: '#475569', icon: 'Tx' },
  sql: { label: 'SQL', color: '#ca8a04', icon: 'SQL' },
  english_grammar: { label: 'Grammar', color: '#db2777', icon: 'Aa' },
  english_vocabulary: { label: 'Vocabulary', color: '#9333ea', icon: 'Ab' },
  english_reading: { label: 'Reading', color: '#0ea5e9', icon: 'Rc' },
  english_essay: { label: 'Writing', color: '#d97706', icon: 'Es' },
  english_speaking: { label: 'Speaking', color: '#16a34a', icon: 'Sp' },
  english_listening: { label: 'Listening', color: '#0891b2', icon: 'Li' },
};

const SECTION_ORDER = [
  'coding',
  'mcq',
  'aptitude',
  'theory',
  'sql',
  ...ENGLISH_TYPES,
];

const TEST_TYPE_UI = {
  coding: { label: 'Coding test', accent: '#2563eb' },
  mcq: { label: 'MCQ test', accent: '#7c3aed' },
  aptitude: { label: 'Aptitude test', accent: '#059669' },
  theory: { label: 'Theory test', accent: '#475569' },
  english: { label: 'English test', accent: '#db2777' },
  sql: { label: 'SQL test', accent: '#ca8a04' },
  mixed: { label: 'Mixed assessment', accent: '#0891b2' },
};

const safeText = (v) => {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (Array.isArray(v)) return v.map(safeText).join(', ');
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
};

/** Normalize stored coding/SQL submission (string or legacy object shapes). */
const getSubmittedCode = (answer) => {
  const raw = answer?.answer;
  if (raw == null || raw === '') return '';
  if (typeof raw === 'string') return raw;
  if (typeof raw === 'object') {
    if (typeof raw.code === 'string') return raw.code;
    if (typeof raw.source === 'string') return raw.source;
    if (typeof raw.text === 'string') return raw.text;
    const lang = answer.language;
    if (lang && typeof raw[lang] === 'string') return raw[lang];
    const values = Object.values(raw).filter((v) => typeof v === 'string');
    if (values.length === 1) return values[0];
  }
  return safeText(raw);
};

const VIOLATION_META = {
  tab_switch: { label: 'Tab switch', icon: FiMonitor },
  window_blur: { label: 'Window blur', icon: FiMonitor },
  desktop_switch: { label: 'Left exam window', icon: FiMonitor },
  page_hidden: { label: 'Page hidden', icon: FiMonitor },
  copy_attempt: { label: 'Copy attempt', icon: FiFlag },
  paste_attempt: { label: 'Paste attempt', icon: FiFlag },
  cut_attempt: { label: 'Cut attempt', icon: FiFlag },
  fullscreen_exit: { label: 'Fullscreen exit', icon: FiAlertTriangle },
  right_click: { label: 'Right click', icon: FiFlag },
  keyboard_shortcut: { label: 'Blocked shortcut', icon: FiFlag },
};

const formatViolationType = (type) => {
  if (!type) return 'Unknown';
  return (
    VIOLATION_META[type]?.label ||
    type.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())
  );
};

const formatDuration = (seconds) => {
  if (seconds == null || Number.isNaN(Number(seconds))) return '—';
  const s = Math.max(0, Math.floor(Number(seconds)));
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m >= 60) {
    const h = Math.floor(m / 60);
    const rm = m % 60;
    return `${h}h ${rm}m`;
  }
  return m > 0 ? `${m}m ${r}s` : `${r}s`;
};

const getGrade = (pct) => {
  if (pct >= 90) return 'A+';
  if (pct >= 80) return 'A';
  if (pct >= 70) return 'B+';
  if (pct >= 60) return 'B';
  if (pct >= 50) return 'C';
  return 'D';
};

const getGradeColor = (pct) => {
  if (pct >= 70) return '#10b981';
  if (pct >= 50) return '#f59e0b';
  return '#ef4444';
};

const getAnswerStatus = (answer) => {
  if (ENGLISH_TYPES.includes(answer.questionType)) {
    const pct = answer.maxPoints ? (answer.points || 0) / answer.maxPoints : 0;
    if (answer.isCorrect === true || pct >= 0.6) {
      return { cls: 'correct', icon: '✓', text: 'Strong' };
    }
    if (pct > 0 || answer.points > 0) {
      return { cls: 'partial', icon: '◐', text: 'Partial' };
    }
    return { cls: 'incorrect', icon: '✗', text: 'Needs work' };
  }
  if (answer.questionType === 'mcq' || answer.questionType === 'aptitude' || answer.questionType === 'sql') {
    return answer.isCorrect
      ? { cls: 'correct', icon: '✓', text: 'Correct' }
      : { cls: 'incorrect', icon: '✗', text: 'Incorrect' };
  }
  if (answer.questionType === 'theory') {
    const pct = answer.maxPoints ? (answer.points || 0) / answer.maxPoints : 0;
    if (pct >= 0.6) return { cls: 'correct', icon: '✓', text: 'Strong' };
    if (pct > 0) return { cls: 'partial', icon: '◐', text: 'Partial' };
    return { cls: 'incorrect', icon: '✗', text: 'Needs work' };
  }
  if (answer.questionType === 'coding') {
    const passed = answer.testCasesPassed ?? 0;
    const total = answer.totalTestCases ?? 0;
    if (total > 0 && passed === total) return { cls: 'correct', icon: '✓', text: 'All passed' };
    if (passed > 0) return { cls: 'partial', icon: '◐', text: `${passed}/${total} cases` };
    return { cls: 'incorrect', icon: '✗', text: 'Failed' };
  }
  return { cls: 'partial', icon: '◐', text: 'Review' };
};

const ResultDetails = () => {
  const { resultId } = useParams();
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [manualUpdates, setManualUpdates] = useState({});
  const [expandedCards, setExpandedCards] = useState({});
  const [filter, setFilter] = useState('all');

  const fetchResult = useCallback(async () => {
    try {
      const response = await axiosInstance.get(`/results/${resultId}`);
      setResult(response.data);
      const initialManual = {};
      (response.data?.answers || []).forEach((answer) => {
        initialManual[answer._id] = {
          score: answer.manualOverride?.score ?? answer.points ?? 0,
          feedback: answer.manualOverride?.feedback || '',
        };
      });
      setManualUpdates(initialManual);
    } catch (error) {
      console.error('Error fetching result:', error);
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, [resultId]);

  useEffect(() => {
    fetchResult();
  }, [fetchResult]);

  useEffect(() => {
    setExpandedCards({});
    setFilter('all');
  }, [result?._id]);

  const handleManualChange = (answerId, field, value) => {
    setManualUpdates((prev) => ({
      ...prev,
      [answerId]: { ...prev[answerId], [field]: value },
    }));
  };

  const handleManualSubmit = async (answerId) => {
    try {
      const payload = manualUpdates[answerId];
      await axiosInstance.patch(`/results/${resultId}/answers/${answerId}/manual-score`, {
        score: Number(payload?.score || 0),
        feedback: payload?.feedback || '',
      });
      await fetchResult();
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to update score');
    }
  };

  const testType = result?.testId?.type || 'mixed';
  const testUi = TEST_TYPE_UI[testType] || TEST_TYPE_UI.mixed;
  const accent = testUi.accent;
  const backTo = result?.testId?._id
    ? `/vendor-admin/tests/${result.testId._id}/results`
    : '/vendor-admin/tests';

  const isMixedTest = testType === 'mixed';
  const isEnglishTest = testType === 'english';
  const canManualOverride = (type) => type === 'theory' || SUBJECTIVE_ENGLISH.includes(type);

  const questionComposition = useMemo(() => {
    if (!result?.answers?.length) return [];
    const counts = {};
    result.answers.forEach((a) => {
      counts[a.questionType] = (counts[a.questionType] || 0) + 1;
    });
    const order = isEnglishTest ? ENGLISH_TYPES : SECTION_ORDER;
    return order
      .filter((t) => counts[t])
      .map((t) => ({ type: t, count: counts[t], ...TYPE_META[t] }));
  }, [result?.answers, isEnglishTest]);

  const filteredAnswers = useMemo(() => {
    if (!result?.answers) return [];
    if (filter === 'all') return result.answers;
    if (filter === 'correct') {
      return result.answers.filter((a) => getAnswerStatus(a).cls === 'correct');
    }
    if (filter === 'incorrect') {
      return result.answers.filter((a) => getAnswerStatus(a).cls === 'incorrect');
    }
    if (filter === 'partial') {
      return result.answers.filter((a) => getAnswerStatus(a).cls === 'partial');
    }
    return result.answers.filter((a) => a.questionType === filter);
  }, [result?.answers, filter]);

  const groupedForDisplay = useMemo(() => {
    if (!isMixedTest && !isEnglishTest) return null;
    const groups = [];
    const order = isEnglishTest ? ENGLISH_TYPES : SECTION_ORDER;
    order.forEach((type) => {
      const items = filteredAnswers
        .map((answer) => ({ answer, index: result.answers.indexOf(answer) }))
        .filter(({ answer }) => answer.questionType === type);
      if (items.length > 0) {
        groups.push({ type, items, meta: TYPE_META[type] || { label: type, color: '#64748b', icon: '?' } });
      }
    });
    return groups;
  }, [isMixedTest, isEnglishTest, filteredAnswers, result?.answers]);

  const summary = useMemo(() => {
    const answers = result?.answers || [];
    let correct = 0;
    let partial = 0;
    let incorrect = 0;
    answers.forEach((a) => {
      const s = getAnswerStatus(a);
      if (s.cls === 'correct') correct += 1;
      else if (s.cls === 'partial') partial += 1;
      else incorrect += 1;
    });
    return { correct, partial, incorrect, total: answers.length };
  }, [result?.answers]);

  const toggleCard = (id) => {
    setExpandedCards((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const expandAll = () => {
    const next = {};
    result?.answers?.forEach((_, i) => {
      next[`q-${i}`] = true;
    });
    setExpandedCards(next);
  };

  const collapseAll = () => setExpandedCards({});

  const renderEnglishEvaluation = (answer) => {
    const ev = answer.englishEvaluation;
    if (!ev) return null;

    const scoreRows = [
      ['Grammar', ev.grammarScore],
      ['Vocabulary', ev.vocabularyScore],
      ['Coherence', ev.coherenceScore],
      ['Structure', ev.structureScore],
      ['Tone', ev.toneScore],
      ['Relevance', ev.relevanceScore],
      ['Pronunciation', ev.pronunciationScore],
      ['Fluency', ev.fluencyScore],
      ['Confidence', ev.confidenceScore],
      ['Accuracy', ev.accuracyScore],
      ['Clarity', ev.clarityScore],
    ].filter(([, v]) => v != null);

    return (
      <div className="vrd-english-panel">
        <strong>AI evaluation</strong>
        {scoreRows.map(([label, val]) => (
          <div key={label} className="vrd-eval-row">
            <span>{label}</span>
            <div className="vrd-eval-bar-wrap">
              <div className="vrd-eval-bar" style={{ width: `${val}%` }} />
            </div>
            <span className="vrd-eval-pct">{val}%</span>
          </div>
        ))}
        {ev.transcription && (
          <div className="vrd-q-block">
            <h5>Transcription</h5>
            <p className="vrd-pre-wrap">{safeText(ev.transcription)}</p>
          </div>
        )}
        {ev.feedback && (
          <div className="vrd-q-block">
            <h5>Feedback</h5>
            <p>{safeText(ev.feedback)}</p>
          </div>
        )}
        {ev.suggestions?.length > 0 && (
          <div className="vrd-q-block">
            <h5>Suggestions</h5>
            <ul>
              {ev.suggestions.map((s, i) => (
                <li key={i}>{safeText(s)}</li>
              ))}
            </ul>
          </div>
        )}
        {ev.plagiarism && (
          <div className={`vrd-plagiarism ${ev.plagiarism.suspicionLevel || 'none'}`}>
            <strong>Plagiarism check</strong>
            <div className="vrd-eval-grid" style={{ marginTop: 8 }}>
              <span>Originality: {ev.plagiarism.originalityScore ?? '—'}%</span>
              <span>
                Cross-submission: {ev.plagiarism.crossSubmissionSimilarity ?? 0}%
              </span>
              <span>Level: {ev.plagiarism.suspicionLevel || 'none'}</span>
            </div>
            {ev.plagiarism.indicators?.length > 0 && (
              <div className="vrd-plagiarism-tags">
                {ev.plagiarism.indicators.map((ind, i) => (
                  <span key={i}>{safeText(ind)}</span>
                ))}
              </div>
            )}
            {ev.plagiarism.feedback && <p className="vrd-muted">{safeText(ev.plagiarism.feedback)}</p>}
          </div>
        )}
      </div>
    );
  };

  const renderEnglishBody = (answer) => {
    const qd = answer.questionDetails;
    const qType = answer.questionType;

    const questionBlock =
      qd?.questionText || qd?.passage || qd?.word ? (
        <div className="vrd-q-block">
          <h5>Prompt</h5>
          <p>{safeText(qd.questionText || qd.passage || qd.word)}</p>
        </div>
      ) : null;

    if (qType === 'english_grammar' || qType === 'english_vocabulary') {
      return (
        <>
          {questionBlock}
          <div className="vrd-answer-box">
            <h5>Student answer</h5>
            <p>{safeText(answer.answer) || 'Not answered'}</p>
            {answer.isCorrect != null && (
              <p>
                <strong>Result:</strong> {answer.isCorrect ? 'Correct' : 'Incorrect'}
              </p>
            )}
          </div>
          {renderEnglishEvaluation(answer)}
        </>
      );
    }

    if (qType === 'english_reading' || qType === 'english_listening') {
      return (
        <>
          {questionBlock}
          {answer.subAnswers?.length > 0 ? (
            <div className="vrd-sub-answers">
              <h5 style={{ margin: '0 0 8px', fontSize: '0.78rem', color: 'var(--vrd-muted)' }}>
                Sub-answers
              </h5>
              {answer.subAnswers.map((sub, i) => (
                <div
                  key={i}
                  className={`vrd-sub-item ${sub.isCorrect ? 'ok' : sub.isCorrect === false ? 'bad' : ''}`}
                >
                  <span className="vrd-card-q">Q{i + 1}</span>
                  <span>{safeText(sub.answer) || '(no answer)'}</span>
                  {sub.isCorrect != null && (
                    <span>{sub.isCorrect ? '✓' : '✗'}</span>
                  )}
                  {sub.points != null && (
                    <span className="vrd-muted">
                      {sub.points}/{sub.maxPoints || '?'} pts
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="vrd-answer-box">
              <h5>Answer</h5>
              <p>{safeText(answer.answer) || 'Not answered'}</p>
            </div>
          )}
          {renderEnglishEvaluation(answer)}
        </>
      );
    }

    if (qType === 'english_essay') {
      return (
        <>
          {questionBlock}
          {answer.essayContent ? (
            <div className="vrd-essay-preview" dangerouslySetInnerHTML={{ __html: answer.essayContent }} />
          ) : (
            <div className="vrd-answer-box">
              <p>Not answered</p>
            </div>
          )}
          {answer.wordCount != null && (
            <p className="vrd-muted">Word count: {answer.wordCount}</p>
          )}
          {renderEnglishEvaluation(answer)}
        </>
      );
    }

    if (qType === 'english_speaking') {
      return (
        <>
          {questionBlock}
          {answer.audioFileUrl ? (
            <div className="vrd-audio">
              <h5>Recording</h5>
              <audio controls src={resolveMediaUrl(answer.audioFileUrl)} />
            </div>
          ) : (
            <p className="vrd-muted">No recording submitted</p>
          )}
          {renderEnglishEvaluation(answer)}
        </>
      );
    }

    return (
      <>
        {questionBlock}
        <div className="vrd-answer-box">
          <p>{safeText(answer.answer) || 'Not answered'}</p>
        </div>
        {renderEnglishEvaluation(answer)}
      </>
    );
  };

  const renderMcqBody = (answer, qd) => (
    <>
      <div className="vrd-q-block">
        <h5>Question</h5>
        <p>{qd?.question || '—'}</p>
      </div>
      <div className="vrd-options">
        {qd?.options?.map((option, optIndex) => {
          const isSelected = parseInt(answer.answer, 10) === optIndex;
          const isCorrectOption = option.isCorrect;
          return (
            <div
              key={optIndex}
              className={`vrd-opt ${isCorrectOption ? 'is-correct' : ''} ${isSelected ? 'is-selected' : ''}`}
            >
              <span className="vrd-opt-letter">{String.fromCharCode(65 + optIndex)}.</span>
              <span>{option.text}</span>
              {isCorrectOption && <span className="vrd-opt-pill ok">Correct</span>}
              {isSelected && !isCorrectOption && <span className="vrd-opt-pill bad">Selected</span>}
              {isSelected && isCorrectOption && <span className="vrd-opt-pill ok">Selected</span>}
            </div>
          );
        })}
      </div>
      {qd?.explanation && (
        <div className="vrd-explanation">
          <strong>Explanation</strong>
          <p>{qd.explanation}</p>
        </div>
      )}
    </>
  );

  const renderAptitudeBody = (answer, qd) => (
    <>
      {qd?.caseStudy && (
        <div className="vrd-q-block">
          <h5>Case study</h5>
          <p>{qd.caseStudy}</p>
        </div>
      )}
      <div className="vrd-q-block">
        <h5>Question</h5>
        <p>{qd?.question || '—'}</p>
      </div>
      {qd?.questionType === 'numeric' ? (
        <div className="vrd-answer-box">
          <p>
            <strong>Student answer:</strong> {String(answer.answer ?? '—')}
          </p>
          <p>
            <strong>Correct answer:</strong> {qd.numericAnswer}
          </p>
        </div>
      ) : (
        <div className="vrd-options">
          {qd?.options?.map((option, optIndex) => {
            const selectedOptions = Array.isArray(answer.answer) ? answer.answer : [answer.answer];
            const isSelected = selectedOptions.includes(optIndex);
            const isCorrectOption = (qd.correctOptions || []).includes(optIndex);
            return (
              <div
                key={optIndex}
                className={`vrd-opt ${isCorrectOption ? 'is-correct' : ''} ${isSelected ? 'is-selected' : ''}`}
              >
                <span className="vrd-opt-letter">{String.fromCharCode(65 + optIndex)}.</span>
                <span>{option.text}</span>
                {isCorrectOption && <span className="vrd-opt-pill ok">Correct</span>}
                {isSelected && !isCorrectOption && <span className="vrd-opt-pill bad">Selected</span>}
              </div>
            );
          })}
        </div>
      )}
      {qd?.explanation && (
        <div className="vrd-explanation">
          <strong>Explanation</strong>
          <p>{qd.explanation}</p>
        </div>
      )}
    </>
  );

  const renderSubmittedCode = (answer, label = 'Submitted code') => {
    const code = getSubmittedCode(answer);

    return (
      <div className="vrd-code-block">
        <div className="vrd-code-block-head">
          <h5>{label}</h5>
          {answer.language && (
            <span className="vrd-code-lang">{String(answer.language).toUpperCase()}</span>
          )}
        </div>
        {!code.trim() ? (
          <p className="vrd-muted">No code was saved for this question.</p>
        ) : (
          <pre className="vrd-code-pre" aria-label={label}>
            <code>{code}</code>
          </pre>
        )}
      </div>
    );
  };

  const renderCodingBody = (answer, qd) => {
    const visibleCases = qd?.testCases?.filter((tc) => !tc.isHidden) || [];
    const hiddenCount = (qd?.testCases?.filter((tc) => tc.isHidden) || []).length;
    const hasQuestion = qd?.title || qd?.description;

    return (
      <>
        {hasQuestion && (
          <div className="vrd-q-block">
            {qd.title && <h5>{qd.title}</h5>}
            {qd.description && (
              <div
                className="vrd-html"
                dangerouslySetInnerHTML={{ __html: qd.description.replace(/\n/g, '<br />') }}
              />
            )}
          </div>
        )}
        <div className="vrd-metrics-row">
          <div className="vrd-metric">
            <span className="vrd-metric-val">
              {answer.testCasesPassed ?? 0}/{answer.totalTestCases ?? 0}
            </span>
            <span className="vrd-metric-lbl">Test cases</span>
          </div>
          {answer.language && (
            <div className="vrd-metric">
              <span className="vrd-metric-val">{String(answer.language).toUpperCase()}</span>
              <span className="vrd-metric-lbl">Language</span>
            </div>
          )}
        </div>
        {renderSubmittedCode(answer, 'Submitted code')}
        {visibleCases.length > 0 && (
          <div className="vrd-test-cases">
            <h5>Sample test cases</h5>
            {visibleCases.map((tc, idx) => (
              <div key={idx} className="vrd-tc">
                <div>
                  <strong>Input</strong>
                  <pre>{tc.input}</pre>
                </div>
                <div>
                  <strong>Expected</strong>
                  <pre>{tc.expectedOutput}</pre>
                </div>
              </div>
            ))}
            {hiddenCount > 0 && (
              <p className="vrd-hidden-note">+ {hiddenCount} hidden test case(s) evaluated at submit.</p>
            )}
          </div>
        )}
      </>
    );
  };

  const renderSqlBody = (answer, qd) => (
    <>
      {qd?.text && (
        <div className="vrd-q-block">
          <h5>Question</h5>
          <p>{qd.text}</p>
        </div>
      )}
      {renderSubmittedCode(answer, 'Submitted SQL')}
    </>
  );

  const renderTheoryBody = (answer, qd) => (
    <>
      <div className="vrd-q-block">
        <h5>Question</h5>
        <p>{qd?.questionText || 'Theory question'}</p>
      </div>
      <div className="vrd-answer-box">
        <h5>Student answer</h5>
        <p className="vrd-pre-wrap">{safeText(answer.answer) || '—'}</p>
      </div>
      {qd?.referenceAnswer && (
        <div className="vrd-ref-answer">
          <h5>Reference answer</h5>
          <p>{qd.referenceAnswer}</p>
        </div>
      )}
      {answer.evaluation && (
        <div className="vrd-ai-box">
          <h5>AI evaluation</h5>
          <div className="vrd-eval-grid">
            <span>Similarity: {(answer.evaluation.similarityScore || 0).toFixed(2)}</span>
            <span>Concepts: {(answer.evaluation.conceptScore || 0).toFixed(2)}</span>
            <span>Depth: {(answer.evaluation.depthScore || 0).toFixed(2)}</span>
            {answer.evaluation.penalty > 0 && (
              <span>Penalty: -{answer.evaluation.penalty.toFixed(2)}</span>
            )}
          </div>
          {answer.evaluation.feedback && <p>{safeText(answer.evaluation.feedback)}</p>}
          {answer.evaluation.missingConcepts?.length > 0 && (
            <p>
              <strong>Missing concepts:</strong> {answer.evaluation.missingConcepts.join(', ')}
            </p>
          )}
          {answer.evaluation.strengths?.length > 0 && (
            <p>
              <strong>Strengths:</strong> {answer.evaluation.strengths.join(', ')}
            </p>
          )}
        </div>
      )}
    </>
  );

  const renderManualOverride = (answer) => {
    if (!canManualOverride(answer.questionType)) return null;
    return (
      <div className="vrd-manual">
        <strong>Manual score override</strong>
        <div className="vrd-manual-controls">
          <input
            type="number"
            min="0"
            max={answer.maxPoints || 10}
            value={manualUpdates[answer._id]?.score ?? ''}
            onChange={(e) => handleManualChange(answer._id, 'score', e.target.value)}
            className="vrd-manual-input score"
          />
          <input
            type="text"
            placeholder="Feedback (optional)"
            value={manualUpdates[answer._id]?.feedback ?? ''}
            onChange={(e) => handleManualChange(answer._id, 'feedback', e.target.value)}
            className="vrd-manual-input feedback"
          />
          <button type="button" className="va-btn va-btn-secondary" onClick={() => handleManualSubmit(answer._id)}>
            Update score
          </button>
        </div>
        {answer.manualOverride?.isManual && (
          <p className="vrd-manual-note">
            Manual override on {formatDateTime(answer.manualOverride.updatedAt)}
          </p>
        )}
      </div>
    );
  };

  const renderAnswerCard = (answer, index) => {
    const qd = answer.questionDetails;
    const status = getAnswerStatus(answer);
    const meta = TYPE_META[answer.questionType] || {
      label: answer.questionType,
      color: '#64748b',
      icon: '?',
    };
    const cardKey = `q-${index}`;
    const isExpanded = expandedCards[cardKey];
    const qTitle =
      qd?.title ||
      qd?.question?.slice?.(0, 80) ||
      qd?.text?.slice?.(0, 80) ||
      qd?.questionText?.slice?.(0, 80) ||
      SECTION_LABELS[answer.questionType] ||
      `Question ${index + 1}`;
    const isEnglishQ = ENGLISH_TYPES.includes(answer.questionType);

    return (
      <div key={answer._id || index} className="vrd-card">
        <button type="button" className="vrd-card-top" onClick={() => toggleCard(cardKey)}>
          <div className="vrd-card-left">
            <div className={`vrd-status-dot vrd-status-${status.cls}`}>{status.icon}</div>
            <div className="vrd-card-info">
              <span className="vrd-card-q">Q{index + 1}</span>
              <span className="vrd-type-tag" style={{ borderColor: meta.color, color: meta.color }}>
                {meta.icon} {meta.label}
              </span>
              <span className="vrd-card-title">{qTitle}</span>
            </div>
          </div>
          <div className="vrd-card-right">
            {answer.flagged && <span className="vrd-flagged">Flagged</span>}
            <div className="vrd-card-score">
              <span className="vrd-pts">{answer.points ?? 0}</span>
              <span className="vrd-max">/ {answer.maxPoints ?? 0}</span>
            </div>
            <span className={`vrd-chevron ${isExpanded ? 'open' : ''}`}>▾</span>
          </div>
        </button>

        {isExpanded && (
          <div className="vrd-card-body">
            {isEnglishQ && renderEnglishBody(answer)}
            {!isEnglishQ && answer.questionType === 'coding' && renderCodingBody(answer, qd)}
            {!isEnglishQ && answer.questionType === 'mcq' && renderMcqBody(answer, qd)}
            {!isEnglishQ && answer.questionType === 'aptitude' && renderAptitudeBody(answer, qd)}
            {!isEnglishQ && answer.questionType === 'sql' && renderSqlBody(answer, qd)}
            {!isEnglishQ && answer.questionType === 'theory' && renderTheoryBody(answer, qd)}
            {!isEnglishQ && !qd && !['coding', 'mcq', 'aptitude', 'sql', 'theory'].includes(answer.questionType) && (
              <p className="vrd-muted">Detailed question content is not available.</p>
            )}
            {renderManualOverride(answer)}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <VendorAssessPage loading backTo={backTo} backLabel="Back to results" accent={accent} />
    );
  }

  if (!result) {
    return (
      <VendorAssessPage
        backTo={backTo}
        backLabel="Back to results"
        title="Result not found"
        accent={accent}
      />
    );
  }

  const pct = result.percentage ?? 0;
  const grade = getGrade(pct);
  const gradeColor = getGradeColor(pct);
  const ringDash = `${(pct / 100) * 327} 327`;
  const tone = scoreTone(pct);

  const filterOptions = [
    { value: 'all', label: 'All questions' },
    { value: 'correct', label: 'Correct / strong' },
    { value: 'partial', label: 'Partial credit' },
    { value: 'incorrect', label: 'Incorrect / failed' },
    ...questionComposition.map((c) => ({
      value: c.type,
      label: `${c.label} only`,
    })),
  ];

  return (
    <VendorAssessPage
      className="result-details-page"
      backTo={backTo}
      backLabel="Back to results"
      eyebrow="Student submission"
      title={result.testId?.title || 'Result details'}
      subtitle={`Review full answers, scoring, and AI feedback for this attempt`}
      accent={accent}
    >
      <section className="vrd-hero">
        <div className="vrd-hero-ring-wrap">
          <svg viewBox="0 0 120 120" className="vrd-ring">
            <circle cx="60" cy="60" r="52" fill="none" stroke="var(--vrd-border)" strokeWidth="8" />
            <circle
              cx="60"
              cy="60"
              r="52"
              fill="none"
              stroke={gradeColor}
              strokeWidth="8"
              strokeDasharray={ringDash}
              strokeLinecap="round"
            />
          </svg>
          <div className="vrd-ring-text">
            <span className="vrd-ring-pct" style={{ color: gradeColor }}>
              {pct}%
            </span>
            <span className="vrd-ring-grade" style={{ color: gradeColor }}>
              {grade}
            </span>
          </div>
        </div>
        <div className="vrd-hero-main">
          <div className="vrd-student-row">
            <span className="vrd-student-name">{result.studentId?.name}</span>
            <span className="vrd-student-email">{result.studentId?.email}</span>
            <span className="vrd-type-pill">{testUi.label}</span>
            <VendorStatusBadge status={result.status} />
          </div>
          <div className="vrd-hero-stats">
            <div>
              <span className="vrd-hero-stat-val">
                {result.totalScore ?? 0}
                <small>/{result.maxScore ?? 0}</small>
              </span>
              <span className="vrd-hero-stat-lbl">Total score</span>
            </div>
            <div>
              <span className="vrd-hero-stat-val">{summary.total}</span>
              <span className="vrd-hero-stat-lbl">Questions</span>
            </div>
            <div>
              <span className="vrd-hero-stat-val">
                {result.timeSpent != null
                  ? `${Math.floor(result.timeSpent / 60)}m ${result.timeSpent % 60}s`
                  : '—'}
              </span>
              <span className="vrd-hero-stat-lbl">Time spent</span>
            </div>
            {result.violationCount > 0 && (
              <div className="vrd-hero-stat--warn">
                <span className="vrd-hero-stat-val">{result.violationCount}</span>
                <span className="vrd-hero-stat-lbl">Violations</span>
              </div>
            )}
            {result.percentile != null && isEnglishTest && (
              <div>
                <span className="vrd-hero-stat-val">{result.percentile}%</span>
                <span className="vrd-hero-stat-lbl">Percentile</span>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="vrd-breakdown">
        <div className="vrd-breakdown-pill correct">
          <span className="vrd-breakdown-num">{summary.correct}</span>
          <span>Correct / full</span>
        </div>
        <div className="vrd-breakdown-pill partial">
          <span className="vrd-breakdown-num">{summary.partial}</span>
          <span>Partial</span>
        </div>
        <div className="vrd-breakdown-pill incorrect">
          <span className="vrd-breakdown-num">{summary.incorrect}</span>
          <span>Incorrect</span>
        </div>
      </section>

      {questionComposition.length > 0 && (
        <div className="vrd-composition">
          {questionComposition.map((c) => (
            <span
              key={c.type}
              className="vrd-composition-chip"
              style={{ borderColor: c.color, color: c.color }}
            >
              {c.count} {c.label}
            </span>
          ))}
        </div>
      )}

      <section className="vrd-panels-row">
        <div className="vrd-panel vrd-attempt-panel">
          <div className="vrd-panel-head">
            <div className="vrd-panel-icon vrd-panel-icon--neutral">
              <FiClock aria-hidden />
            </div>
            <div className="vrd-panel-head-text">
              <h2 className="vrd-panel-title">Attempt details</h2>
              <p className="vrd-panel-desc">Timeline and scoring for this submission</p>
            </div>
          </div>
          <div className="vrd-panel-body">
            <div className="vrd-detail-cards">
              <div className="vrd-detail-card">
                <span className="vrd-detail-card-icon" aria-hidden>
                  <FiClock />
                </span>
                <div className="vrd-detail-card-content">
                  <span className="vrd-detail-card-label">Started</span>
                  <span className="vrd-detail-card-value">{formatDateTime(result.startedAt)}</span>
                </div>
              </div>
              <div className="vrd-detail-card">
                <span className="vrd-detail-card-icon vrd-detail-card-icon--submit" aria-hidden>
                  <FiSend />
                </span>
                <div className="vrd-detail-card-content">
                  <span className="vrd-detail-card-label">Submitted</span>
                  <span className="vrd-detail-card-value">{formatDateTime(result.submittedAt)}</span>
                  {result.autoSubmitted && (
                    <span className="vrd-auto-tag">Auto-submitted</span>
                  )}
                </div>
              </div>
              <div className="vrd-detail-card">
                <span className="vrd-detail-card-icon" aria-hidden>
                  <FiClock />
                </span>
                <div className="vrd-detail-card-content">
                  <span className="vrd-detail-card-label">Duration</span>
                  <span className="vrd-detail-card-value">{formatDuration(result.timeSpent)}</span>
                </div>
              </div>
              <div className="vrd-detail-card vrd-detail-card--score">
                <span className="vrd-detail-card-icon vrd-detail-card-icon--score" aria-hidden>
                  <FiPercent />
                </span>
                <div className="vrd-detail-card-content">
                  <span className="vrd-detail-card-label">Overall score</span>
                  <span className={`vrd-score-pill vrd-score-pill--${tone}`}>{pct}%</span>
                  <span className="vrd-detail-card-sub">
                    {result.totalScore ?? 0} / {result.maxScore ?? 0} points
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {(result.violations?.length > 0 || result.violationCount > 0) && (
          <div className="vrd-panel vrd-violations-panel">
            <div className="vrd-panel-head vrd-panel-head--alert">
              <div className="vrd-panel-icon vrd-panel-icon--alert">
                <FiAlertTriangle aria-hidden />
              </div>
              <div className="vrd-panel-head-text">
                <h2 className="vrd-panel-title">Proctoring violations</h2>
                <p className="vrd-panel-desc">
                  {result.violationCount || result.violations?.length || 0} event
                  {(result.violationCount || result.violations?.length) !== 1 ? 's' : ''} recorded
                  during the exam
                </p>
              </div>
              <span className="vrd-violation-badge">{result.violationCount || result.violations?.length}</span>
            </div>
            {result.autoSubmitted && (
              <div className="vrd-alert-banner">
                <FiAlertTriangle aria-hidden />
                <span>Test was auto-submitted after repeated proctoring violations.</span>
              </div>
            )}
            <div className="vrd-panel-body vrd-panel-body--flush">
              <ul className="vrd-violation-timeline">
                {(result.violations || []).map((violation, idx) => {
                  const meta = VIOLATION_META[violation.type] || {
                    label: formatViolationType(violation.type),
                    icon: FiFlag,
                  };
                  const Icon = meta.icon;
                  return (
                    <li key={idx} className="vrd-violation-row">
                      <span className="vrd-violation-row-icon" aria-hidden>
                        <Icon />
                      </span>
                      <div className="vrd-violation-row-main">
                        <div className="vrd-violation-row-top">
                          <span className="vrd-violation-chip">{meta.label}</span>
                          <time className="vrd-violation-time" dateTime={violation.timestamp}>
                            {formatDateTime(violation.timestamp)}
                          </time>
                        </div>
                        {violation.details ? (
                          <p className="vrd-violation-detail">{safeText(violation.details)}</p>
                        ) : (
                          <p className="vrd-violation-detail vrd-violation-detail--muted">
                            No additional details recorded
                          </p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        )}
      </section>

      {result.sectionScores?.length > 0 && (
        <section className="vrd-sections">
          <h2 className="vrd-block-title">Section performance</h2>
          <div className="vrd-section-grid">
            {result.sectionScores.map((sec, idx) => {
              const sp =
                sec.percentage ??
                (sec.maxScore ? Math.round((sec.score / sec.maxScore) * 100) : 0);
              const meta = TYPE_META[sec.sectionType];
              const secLabel =
                SECTION_LABELS[sec.sectionType] ||
                sec.sectionTitle ||
                meta?.label ||
                sec.sectionType;
              const barColor = sp >= 70 ? '#10b981' : sp >= 40 ? '#f59e0b' : '#ef4444';
              return (
                <div key={idx} className="vrd-sec-card">
                  <span className="vrd-sec-name" style={meta ? { color: meta.color } : undefined}>
                    {secLabel}
                  </span>
                  <div className="vrd-sec-bar-wrap">
                    <div className="vrd-sec-bar" style={{ width: `${sp}%`, background: barColor }} />
                  </div>
                  <span className="vrd-sec-score">
                    {sec.score}/{sec.maxScore} · {sp}%
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="vrd-answers-block">
        <div className="vrd-answers-head">
          <h2 className="vrd-block-title">
            Question-by-question review
            <span className="vrd-count">({filteredAnswers.length} shown)</span>
          </h2>
          <div className="vrd-toolbar">
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="vrd-filter"
            >
              {filterOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <button type="button" className="vrd-btn-ghost" onClick={expandAll}>
              Expand all
            </button>
            <button type="button" className="vrd-btn-ghost" onClick={collapseAll}>
              Collapse all
            </button>
          </div>
        </div>

        <div className="vrd-answers-list">
          {filteredAnswers.length === 0 ? (
            <p className="vrd-empty">No questions match this filter.</p>
          ) : groupedForDisplay?.length ? (
            groupedForDisplay.map((group) => (
              <div key={group.type} className="vrd-answer-group">
                <div
                  className="vrd-answer-group-head"
                  style={{ borderColor: group.meta.color, color: group.meta.color }}
                >
                  <h3>{group.meta.label}</h3>
                  <span className="vrd-answer-group-count">{group.items.length}</span>
                </div>
                <div className="vrd-answer-group-list">
                  {group.items.map(({ answer, index }) => renderAnswerCard(answer, index))}
                </div>
              </div>
            ))
          ) : (
            filteredAnswers.map((answer) => {
              const origIndex = result.answers.indexOf(answer);
              return renderAnswerCard(answer, origIndex);
            })
          )}
        </div>
      </section>
    </VendorAssessPage>
  );
};

export default ResultDetails;
