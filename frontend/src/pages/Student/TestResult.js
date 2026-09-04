import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import MonacoCodeEditor from '../../components/MonacoCodeEditor';
import axiosInstance from '../../utils/axios';
import QuestionPracticePanel from '../../components/QuestionPracticePanel';
import RichTextDisplay, { htmlToListPreview } from '../../components/RichTextDisplay';
import { isScoreOnlyResult } from '../../utils/resultDisplay';
import './TestResult.css';

const TYPE_META = {
  coding: { label: 'Coding', color: '#3b82f6', icon: '{ }' },
  mcq: { label: 'MCQ', color: '#8b5cf6', icon: 'AB' },
  aptitude: { label: 'Aptitude', color: '#059669', icon: 'Nu' },
  theory: { label: 'Theory', color: '#d97706', icon: 'Tx' },
  sql: { label: 'SQL', color: '#0ea5e9', icon: 'SQL' },
};

const SECTION_ORDER = ['coding', 'mcq', 'aptitude', 'theory', 'sql'];

const TEST_TYPE_UI = {
  coding: {
    label: 'Coding test',
    backLabel: 'Coding tests',
    accent: '#2563eb',
    backPath: '/student/tests/coding',
    description: 'Code-based questions and test case scoring',
  },
  mixed: {
    label: 'Mixed assessment',
    backLabel: 'Mixed tests',
    accent: '#0891b2',
    backPath: '/student/tests/mixed',
    description: 'Multiple question types in one assessment',
  },
  mcq: {
    label: 'MCQ test',
    backLabel: 'MCQ tests',
    accent: '#7c3aed',
    backPath: '/student/tests/mcq',
    description: 'Multiple choice questions',
  },
  aptitude: {
    label: 'Aptitude test',
    backLabel: 'Aptitude tests',
    accent: '#059669',
    backPath: '/student/tests/aptitude',
    description: 'Aptitude questions',
  },
  theory: {
    label: 'Theory test',
    backLabel: 'Theory',
    accent: '#475569',
    backPath: '/student/tests/core',
    description: 'Theory questions',
  },
  sql: {
    label: 'SQL test',
    backLabel: 'Practical tools',
    accent: '#ca8a04',
    backPath: '/student/tests/tools',
    description: 'SQL questions',
  },
};

const TestResult = () => {
  const { resultId, testId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const courseIdParam = searchParams.get('courseId');
  const moduleIdParam = searchParams.get('moduleId');
  const [result, setResult] = useState(null);
  const [test, setTest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedCards, setExpandedCards] = useState({});
  const [practiceQuestion, setPracticeQuestion] = useState(null);
  const [filter, setFilter] = useState('all');
  const [courseQuizSynced, setCourseQuizSynced] = useState(false);
  const [courseQuizMeta, setCourseQuizMeta] = useState(null);

  const fetchResult = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      let response;
      if (testId) {
        response = await axiosInstance.get(`/results/test/${testId}`);
      } else if (resultId) {
        response = await axiosInstance.get(`/results/${resultId}`);
      } else {
        throw new Error('No result ID or test ID provided');
      }
      const data = response.data;
      const resolvedTestId =
        typeof data.testId === 'object' ? data.testId._id?.toString() : data.testId?.toString();

      if (testId && resolvedTestId && testId !== resolvedTestId) {
        setError('This result does not belong to the selected test.');
        setResult(null);
        return;
      }

      setResult(data);
      const tid = resolvedTestId || testId;
      if (tid) {
        try {
          const testRes = await axiosInstance.get(`/tests/${tid}`);
          setTest(testRes.data);
        } catch {
          setTest(null);
        }
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to load result');
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, [resultId, testId]);

  useEffect(() => {
    fetchResult();
  }, [fetchResult]);

  useEffect(() => {
    setExpandedCards({});
  }, [result?._id]);

  useEffect(() => {
    if (
      courseQuizSynced ||
      !courseIdParam ||
      !moduleIdParam ||
      !result?._id ||
      !['completed', 'timeout'].includes(result.status)
    ) {
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { data } = await axiosInstance.post(
          `/student/courses/${courseIdParam}/modules/${moduleIdParam}/quiz/complete`,
          { resultId: result._id }
        );
        if (!cancelled) {
          setCourseQuizMeta(data || null);
          setCourseQuizSynced(true);
        }
      } catch (err) {
        console.warn('Course quiz sync failed', err?.response?.data?.message || err.message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [courseIdParam, moduleIdParam, result?._id, result?.status, courseQuizSynced]);

  const resolvedResultId = result?._id;

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

  const getAnswerStatus = (answer) => {
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

  const testType = test?.type || result?.testId?.type || 'mixed';
  const testUi = TEST_TYPE_UI[testType] || TEST_TYPE_UI.mixed;
  const isMixedTest = testType === 'mixed';
  const scoreOnlyView = isScoreOnlyResult(test || result?.testId, result);

  const questionComposition = useMemo(() => {
    if (!result?.answers?.length) return [];
    const counts = {};
    result.answers.forEach((a) => {
      counts[a.questionType] = (counts[a.questionType] || 0) + 1;
    });
    return SECTION_ORDER.filter((t) => counts[t]).map((t) => ({
      type: t,
      count: counts[t],
      ...TYPE_META[t],
    }));
  }, [result?.answers]);

  const filteredAnswers = useMemo(() => {
    if (!result?.answers) return [];
    if (filter === 'all') return result.answers;
    if (filter === 'correct') {
      return result.answers.filter((a) => getAnswerStatus(a).cls === 'correct');
    }
    if (filter === 'incorrect') {
      return result.answers.filter((a) => getAnswerStatus(a).cls === 'incorrect');
    }
    return result.answers.filter((a) => a.questionType === filter);
  }, [result?.answers, filter]);

  const groupedForDisplay = useMemo(() => {
    if (!isMixedTest) return null;
    const groups = [];
    SECTION_ORDER.forEach((type) => {
      const items = filteredAnswers
        .map((answer) => ({
          answer,
          index: result.answers.indexOf(answer),
        }))
        .filter(({ answer }) => answer.questionType === type);
      if (items.length > 0) {
        groups.push({ type, items, meta: TYPE_META[type] || { label: type, color: '#64748b' } });
      }
    });
    const otherTypes = [...new Set(filteredAnswers.map((a) => a.questionType))].filter(
      (t) => !SECTION_ORDER.includes(t)
    );
    otherTypes.forEach((type) => {
      const items = filteredAnswers
        .map((answer) => ({ answer, index: result.answers.indexOf(answer) }))
        .filter(({ answer }) => answer.questionType === type);
      if (items.length > 0) {
        groups.push({ type, items, meta: { label: type, color: '#64748b' } });
      }
    });
    return groups;
  }, [isMixedTest, filteredAnswers, result?.answers]);

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

  const pct = result?.percentage ?? 0;
  const grade =
    pct >= 90 ? 'A+' : pct >= 80 ? 'A' : pct >= 70 ? 'B+' : pct >= 60 ? 'B' : pct >= 50 ? 'C' : 'D';
  const gradeColor = pct >= 70 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444';

  const renderMcqBody = (answer, qd) => (
    <>
      <div className="tr-q-block">
        <h5>Question</h5>
        <RichTextDisplay content={qd?.question} className="tr-html" />
      </div>
      <div className="tr-options">
        {qd?.options?.map((option, optIndex) => {
          const isSelected = parseInt(answer.answer, 10) === optIndex;
          const isCorrectOption = option.isCorrect;
          return (
            <div
              key={optIndex}
              className={`tr-opt ${isCorrectOption ? 'is-correct' : ''} ${isSelected ? 'is-selected' : ''}`}
            >
              <span className="tr-opt-letter">{String.fromCharCode(65 + optIndex)}.</span>
              <RichTextDisplay content={option.text} className="tr-opt-text tr-html" />
              {isCorrectOption && <span className="tr-opt-pill ok">Correct</span>}
              {isSelected && !isCorrectOption && <span className="tr-opt-pill bad">Your answer</span>}
              {isSelected && isCorrectOption && <span className="tr-opt-pill ok">Your answer</span>}
            </div>
          );
        })}
      </div>
      {qd?.explanation && (
        <div className="tr-explanation">
          <strong>Explanation</strong>
          <RichTextDisplay content={qd.explanation} className="tr-html" />
        </div>
      )}
    </>
  );

  const renderAptitudeBody = (answer, qd) => (
    <>
      {qd?.caseStudy && (
        <div className="tr-q-block tr-case">
          <h5>Case study</h5>
          <RichTextDisplay content={qd.caseStudy} className="tr-html" />
        </div>
      )}
      <div className="tr-q-block">
        <h5>Question</h5>
        <RichTextDisplay content={qd?.question} className="tr-html" />
      </div>
      {qd?.questionType === 'numeric' ? (
        <div className="tr-answer-box">
          <div><strong>Your answer:</strong> {String(answer.answer ?? '—')}</div>
          <div><strong>Correct answer:</strong> {qd.numericAnswer}</div>
        </div>
      ) : (
        <div className="tr-options">
          {qd?.options?.map((option, optIndex) => {
            const selectedOptions = Array.isArray(answer.answer) ? answer.answer : [answer.answer];
            const isSelected = selectedOptions.includes(optIndex);
            const isCorrectOption = (qd.correctOptions || []).includes(optIndex);
            return (
              <div
                key={optIndex}
                className={`tr-opt ${isCorrectOption ? 'is-correct' : ''} ${isSelected ? 'is-selected' : ''}`}
              >
                <span className="tr-opt-letter">{String.fromCharCode(65 + optIndex)}.</span>
                <RichTextDisplay content={option.text} className="tr-opt-text tr-html" />
                {isCorrectOption && <span className="tr-opt-pill ok">Correct</span>}
                {isSelected && !isCorrectOption && <span className="tr-opt-pill bad">Your answer</span>}
              </div>
            );
          })}
        </div>
      )}
      {qd?.explanation && (
        <div className="tr-explanation">
          <strong>Explanation</strong>
          <RichTextDisplay content={qd.explanation} className="tr-html" />
        </div>
      )}
    </>
  );

  const renderCodingBody = (answer, qd) => {
    const visibleCases = qd?.testCases?.filter((tc) => !tc.isHidden) || [];
    const hiddenCount = (qd?.testCases?.filter((tc) => tc.isHidden) || []).length;
    return (
      <>
        {qd?.title && (
          <div className="tr-q-block">
            <h5>{qd.title}</h5>
            {qd.description && (
              <RichTextDisplay content={qd.description} className="tr-html" />
            )}
          </div>
        )}
        <div className="tr-metrics-row">
          <div className="tr-metric">
            <span className="tr-metric-val">
              {answer.testCasesPassed ?? 0}/{answer.totalTestCases ?? 0}
            </span>
            <span className="tr-metric-lbl">Test cases passed</span>
          </div>
          {answer.language && (
            <div className="tr-metric">
              <span className="tr-metric-val">{answer.language.toUpperCase()}</span>
              <span className="tr-metric-lbl">Language</span>
            </div>
          )}
          {qd?.difficulty && (
            <div className="tr-metric">
              <span className="tr-metric-val">{qd.difficulty}</span>
              <span className="tr-metric-lbl">Difficulty</span>
            </div>
          )}
        </div>
        {visibleCases.length > 0 && (
          <div className="tr-test-cases">
            <h5>Sample test cases (from exam)</h5>
            {visibleCases.map((tc, idx) => (
              <div key={idx} className="tr-tc">
                <div><strong>Input</strong><pre>{tc.input}</pre></div>
                <div><strong>Expected</strong><pre>{tc.expectedOutput}</pre></div>
              </div>
            ))}
            {hiddenCount > 0 && (
              <p className="tr-hidden-note">+ {hiddenCount} hidden test case(s) were evaluated at submit time.</p>
            )}
          </div>
        )}
        {answer.answer && (
          <div className="tr-code-block">
            <h5>Your submitted code</h5>
            <div className="tr-editor-wrap">
              <MonacoCodeEditor
                height="280px"
                language={answer.language || 'python'}
                value={typeof answer.answer === 'string' ? answer.answer : ''}
                readOnly
                options={{ fontSize: 13 }}
              />
            </div>
          </div>
        )}
      </>
    );
  };

  const renderSqlBody = (answer, qd) => (
    <>
      {qd?.text && (
        <div className="tr-q-block">
          <h5>Question</h5>
          <RichTextDisplay content={qd.text} className="tr-html" />
        </div>
      )}
      <div className="tr-code-block">
        <h5>Your SQL</h5>
        <div className="tr-editor-wrap">
          <MonacoCodeEditor
            height="200px"
            language="sql"
            value={answer.answer || ''}
            readOnly
            options={{ fontSize: 13 }}
          />
        </div>
      </div>
    </>
  );

  const renderTheoryBody = (answer, qd) => (
    <>
      <div className="tr-q-block">
        <h5>Question</h5>
        <RichTextDisplay content={qd?.questionText || 'Theory question'} className="tr-html" />
      </div>
      <div className="tr-answer-box">
        <h5>Your answer</h5>
        <p className="tr-pre-wrap">{answer.answer || '—'}</p>
      </div>
      {qd?.referenceAnswer && (
        <div className="tr-ref-answer">
          <h5>Reference answer</h5>
          <RichTextDisplay content={qd.referenceAnswer} className="tr-html" />
        </div>
      )}
      {answer.evaluation && (
        <div className="tr-ai-box">
          <h5>AI evaluation</h5>
          <div className="tr-eval-grid">
            <span>Similarity: {(answer.evaluation.similarityScore || 0).toFixed(2)}</span>
            <span>Concepts: {(answer.evaluation.conceptScore || 0).toFixed(2)}</span>
            <span>Depth: {(answer.evaluation.depthScore || 0).toFixed(2)}</span>
          </div>
          {answer.evaluation.feedback && <p>{answer.evaluation.feedback}</p>}
          {answer.evaluation.missingConcepts?.length > 0 && (
            <p><strong>Missing:</strong> {answer.evaluation.missingConcepts.join(', ')}</p>
          )}
          {answer.evaluation.strengths?.length > 0 && (
            <p><strong>Strengths:</strong> {answer.evaluation.strengths.join(', ')}</p>
          )}
        </div>
      )}
      {answer.manualOverride?.isManual && (
        <div className="tr-manual">
          <strong>Instructor note</strong>
          <p>{answer.manualOverride.feedback || 'Score adjusted manually.'}</p>
        </div>
      )}
    </>
  );

  const renderAnswerCard = (answer, index) => {
    const qd = answer.questionDetails;
    const status = getAnswerStatus(answer);
    const meta = TYPE_META[answer.questionType] || { label: answer.questionType, color: '#64748b', icon: '?' };
    const cardKey = `q-${index}`;
    const isExpanded = expandedCards[cardKey];
    const qTitle = htmlToListPreview(
      qd?.title || qd?.question || qd?.text || qd?.questionText || `Question ${index + 1}`
    ).slice(0, 60) || `Question ${index + 1}`;
    const canPractice = ['coding', 'mcq', 'aptitude', 'sql', 'theory'].includes(answer.questionType);

    return (
      <div key={answer.questionId?.toString?.() || index} className={`tr-card tr-card-${status.cls}`}>
        <button type="button" className="tr-card-top" onClick={() => toggleCard(cardKey)}>
          <div className="tr-card-left">
            <div className={`tr-status-dot tr-status-${status.cls}`}>{status.icon}</div>
            <div className="tr-card-info">
              <span className="tr-card-q">Q{index + 1}</span>
              <span className="tr-type-tag" style={{ borderColor: meta.color, color: meta.color }}>
                {meta.icon} {meta.label}
              </span>
              <span className="tr-card-title">{qTitle}</span>
            </div>
          </div>
          <div className="tr-card-right">
            <div className="tr-card-score">
              <span className="tr-pts">{answer.points ?? 0}</span>
              <span className="tr-max">/ {answer.maxPoints ?? 0}</span>
            </div>
            <span className={`tr-chevron ${isExpanded ? 'open' : ''}`}>▾</span>
          </div>
        </button>

        {isExpanded && (
          <div className="tr-card-body">
            {answer.questionType === 'coding' && renderCodingBody(answer, qd)}
            {answer.questionType === 'mcq' && renderMcqBody(answer, qd)}
            {answer.questionType === 'aptitude' && renderAptitudeBody(answer, qd)}
            {answer.questionType === 'sql' && renderSqlBody(answer, qd)}
            {answer.questionType === 'theory' && renderTheoryBody(answer, qd)}
            {!qd && (
              <p className="tr-muted">Detailed question text is not available for this item.</p>
            )}
            {canPractice && resolvedResultId && (
              <div className="tr-card-actions">
                <button
                  type="button"
                  className="tr-btn tr-btn-practice"
                  onClick={() =>
                    setPracticeQuestion({
                      questionId: answer.questionId?.toString?.() || answer.questionId,
                      label: qTitle,
                    })
                  }
                >
                  ↻ Practice this question
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="tr-loading">
        <div className="tr-spinner" />
        <span>Loading your results…</span>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="tr-page">
        <div className="tr-fallback">
          <h2>Result not found</h2>
          <p>{error || 'Unable to load this result.'}</p>
          <button type="button" className="tr-btn tr-btn-primary" onClick={() => navigate('/student/dashboard')}>
            Back to dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="tr-page" style={{ '--tr-accent': testUi.accent }}>
      <header className="tr-header">
        <div>
          <span className="tr-kind-badge">{testUi.label}</span>
          <h1 className="tr-title">{result.testId?.title || test?.title || 'Test Result'}</h1>
          <p className="tr-subtitle-desc">{testUi.description}</p>
          <p className="tr-subtitle">
            Submitted{' '}
            {result.submittedAt
              ? new Date(result.submittedAt).toLocaleString()
              : '—'}
            {result.autoSubmitted && <span className="tr-auto-tag"> · Auto-submitted</span>}
          </p>
          {questionComposition.length > 0 && !scoreOnlyView && (
            <div className="tr-composition">
              {questionComposition.map((c) => (
                <span
                  key={c.type}
                  className="tr-composition-chip"
                  style={{ borderColor: c.color, color: c.color }}
                >
                  {c.count} {c.label}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="tr-header-actions">
          {courseIdParam ? (
            <>
              <button
                type="button"
                className="tr-btn tr-btn-secondary"
                onClick={() => navigate(`/student/courses/${courseIdParam}`)}
              >
                Back to course
              </button>
              {moduleIdParam && (
                <button
                  type="button"
                  className="tr-btn tr-btn-primary"
                  onClick={() =>
                    navigate(
                      `/student/test/${
                        typeof result.testId === 'object' ? result.testId?._id : result.testId
                      }?courseId=${courseIdParam}&moduleId=${moduleIdParam}`
                    )
                  }
                >
                  Practice again
                </button>
              )}
            </>
          ) : (
            <button
              type="button"
              className="tr-btn tr-btn-secondary"
              onClick={() => navigate(testUi.backPath)}
            >
              Back to {testUi.backLabel}
            </button>
          )}
        </div>
      </header>

      {courseIdParam && (
        <div
          className={`tr-course-banner ${
            courseQuizMeta?.practice || result.countsTowardScore === false ? 'is-practice' : 'is-official'
          }`}
        >
          {courseQuizMeta?.practice || result.countsTowardScore === false ? (
            <>
              <strong>Practice attempt</strong>
              <span>
                This score is not on your course scorecard.
                {courseQuizMeta?.quizScore
                  ? ` Official score remains ${courseQuizMeta.quizScore.totalScore}/${courseQuizMeta.quizScore.maxScore} (${courseQuizMeta.quizScore.percentage}%).`
                  : ' Your first attempt is still the official score.'}
              </span>
              {courseQuizMeta?.officialResultId &&
                String(courseQuizMeta.officialResultId) !== String(result._id) && (
                  <button
                    type="button"
                    className="tr-course-banner-link"
                    onClick={() =>
                      navigate(
                        `/student/result/${courseQuizMeta.officialResultId}?courseId=${courseIdParam}&moduleId=${moduleIdParam}`
                      )
                    }
                  >
                    View official
                  </button>
                )}
            </>
          ) : (
            <>
              <strong>Official score</strong>
              <span>This first attempt is what counts on your course scorecard. You can practise again anytime.</span>
            </>
          )}
        </div>
      )}

      <section className="tr-hero">
        <div className="tr-hero-ring-wrap">
          <svg viewBox="0 0 120 120" className="tr-ring">
            <circle cx="60" cy="60" r="52" fill="none" stroke="var(--border-color)" strokeWidth="8" />
            <circle
              cx="60"
              cy="60"
              r="52"
              fill="none"
              stroke={gradeColor}
              strokeWidth="8"
              strokeDasharray={`${(pct / 100) * 327} 327`}
              strokeLinecap="round"
              transform="rotate(-90 60 60)"
            />
          </svg>
          <div className="tr-ring-text">
            <span className="tr-ring-pct" style={{ color: gradeColor }}>{pct}%</span>
            <span className="tr-ring-grade" style={{ color: gradeColor }}>{grade}</span>
          </div>
        </div>
        <div className="tr-hero-stats">
          <div className="tr-stat">
            <span className="tr-stat-val">
              {result.totalScore ?? 0}
              <small>/{result.maxScore ?? 0}</small>
            </span>
            <span className="tr-stat-lbl">Total score</span>
          </div>
          <div className="tr-stat">
            <span className="tr-stat-val">
              {result.timeSpent != null
                ? `${Math.floor(result.timeSpent / 60)}m ${result.timeSpent % 60}s`
                : '—'}
            </span>
            <span className="tr-stat-lbl">Time spent</span>
          </div>
          {!scoreOnlyView && (
            <div className="tr-stat">
              <span className="tr-stat-val">{summary.total}</span>
              <span className="tr-stat-lbl">Questions</span>
            </div>
          )}
          {result.violationCount > 0 && (
            <div className="tr-stat tr-stat-warn">
              <span className="tr-stat-val">{result.violationCount}</span>
              <span className="tr-stat-lbl">Violations</span>
            </div>
          )}
        </div>
      </section>

      {scoreOnlyView ? (
        <section className="tr-score-only-panel">
          <div className="tr-score-only-icon" aria-hidden="true">
            🎯
          </div>
          <h2 className="tr-score-only-title">Score summary</h2>
          <p className="tr-score-only-text">
            Your instructor chose to share your overall score for this assessment. Per-question
            breakdown, answers, and solutions are not shown.
          </p>
          <div className="tr-score-only-metrics">
            <div className="tr-score-only-metric">
              <span className="tr-score-only-metric-val">{result.totalScore ?? 0}</span>
              <span className="tr-score-only-metric-lbl">Points earned</span>
            </div>
            <div className="tr-score-only-metric">
              <span className="tr-score-only-metric-val">{result.maxScore ?? 0}</span>
              <span className="tr-score-only-metric-lbl">Maximum points</span>
            </div>
            <div className="tr-score-only-metric">
              <span className="tr-score-only-metric-val">{pct}%</span>
              <span className="tr-score-only-metric-lbl">Percentage</span>
            </div>
          </div>
        </section>
      ) : (
        <>
      <section className="tr-breakdown">
        <div className="tr-breakdown-pill correct">
          <span className="tr-breakdown-num">{summary.correct}</span>
          <span>Correct / full</span>
        </div>
        <div className="tr-breakdown-pill partial">
          <span className="tr-breakdown-num">{summary.partial}</span>
          <span>Partial</span>
        </div>
        <div className="tr-breakdown-pill incorrect">
          <span className="tr-breakdown-num">{summary.incorrect}</span>
          <span>Incorrect</span>
        </div>
      </section>

      {result.sectionScores?.length > 0 && (
        <section className="tr-sections-block">
          <h2 className="tr-block-title">Section performance</h2>
          <div className="tr-section-grid">
            {result.sectionScores.map((s) => {
              const sp = s.percentage ?? (s.maxScore ? Math.round((s.score / s.maxScore) * 100) : 0);
              const meta = TYPE_META[s.sectionType];
              const secLabel = s.sectionTitle || meta?.label || s.sectionType;
              return (
                <div key={s.sectionType} className="tr-sec-card">
                  <span className="tr-sec-name" style={meta ? { color: meta.color } : undefined}>
                    {secLabel}
                  </span>
                  <div className="tr-sec-bar-wrap">
                    <div
                      className="tr-sec-bar"
                      style={{
                        width: `${sp}%`,
                        background: sp >= 70 ? '#10b981' : sp >= 40 ? '#f59e0b' : '#ef4444',
                      }}
                    />
                  </div>
                  <span className="tr-sec-score">
                    {s.score}/{s.maxScore} · {sp}%
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="tr-answers-block">
        <div className="tr-answers-head">
          <h2 className="tr-block-title">
            Detailed review
            <span className="tr-count">({filteredAnswers.length} shown)</span>
          </h2>
          <div className="tr-toolbar">
            <select value={filter} onChange={(e) => setFilter(e.target.value)} className="tr-filter">
              <option value="all">All questions</option>
              <option value="correct">Correct / full marks</option>
              <option value="incorrect">Incorrect / failed</option>
              <option value="coding">Coding only</option>
              <option value="mcq">MCQ only</option>
              <option value="aptitude">Aptitude only</option>
              <option value="theory">Theory only</option>
              <option value="sql">SQL only</option>
            </select>
            <button type="button" className="tr-btn tr-btn-ghost" onClick={expandAll}>
              Expand all
            </button>
            <button type="button" className="tr-btn tr-btn-ghost" onClick={collapseAll}>
              Collapse all
            </button>
          </div>
        </div>
        <div className="tr-answers-list">
          {filteredAnswers.length === 0 ? (
            <p className="tr-empty">No questions match this filter.</p>
          ) : isMixedTest && groupedForDisplay?.length ? (
            groupedForDisplay.map((group) => (
              <div key={group.type} className="tr-answer-group">
                <div
                  className="tr-answer-group-head"
                  style={{ borderColor: group.meta.color, color: group.meta.color }}
                >
                  <span className="tr-answer-group-icon">{group.meta.icon}</span>
                  <h3>{group.meta.label} questions</h3>
                  <span className="tr-answer-group-count">{group.items.length}</span>
                </div>
                <div className="tr-answer-group-list">
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
        </>
      )}

      {practiceQuestion && resolvedResultId && !scoreOnlyView && (
        <QuestionPracticePanel
          resultId={resolvedResultId}
          questionId={practiceQuestion.questionId}
          questionLabel={practiceQuestion.label}
          onClose={() => setPracticeQuestion(null)}
        />
      )}
    </div>
  );
};

export default TestResult;
