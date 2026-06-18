import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import MonacoCodeEditor from '../../components/MonacoCodeEditor';
import axiosInstance from '../../utils/axios';
import {
  CODE_REQUEST_TIMEOUT_BATCH_MS,
  CODE_REQUEST_TIMEOUT_EXECUTE_MS
} from '../../config/codeExecution';
import Modal from '../../components/Modal';
import { useToast } from '../../context/ToastContext';
import { useExamSecurity } from '../../hooks/useExamSecurity';
import { useRegisterExamLock } from '../../hooks/useRegisterExamLock';
import { useExamLock } from '../../context/ExamLockContext';
import ExamFullscreenPrompt from '../../components/ExamFullscreenPrompt';
import ExamSecurityOverlay from '../../components/ExamSecurityOverlay';
import RichTextDisplay from '../../components/RichTextDisplay';
import { isDocumentFullscreen } from '../../utils/fullscreen';
import { isFromShareLink, clearShareLinkAttempt } from '../../utils/examShareLink';
import { parseSchemaSql } from '../../utils/schemaParser';
import './TestTaking.css';

/** Stable string key for answer maps (avoids object vs string _id mismatches). */
const questionKey = (id) => {
  if (id == null) return '';
  if (typeof id === 'object' && id._id != null) return String(id._id);
  return String(id);
};

const answerFor = (answersMap, questionId) => answersMap[questionKey(questionId)] || {};

const isAnswerAttemptedLocally = (entry) => {
  if (!entry) return false;
  if (entry.attempted) return true;
  if (entry.selectedOption !== undefined && entry.selectedOption !== null) return true;
  if (Array.isArray(entry.selectedOptions) && entry.selectedOptions.length > 0) return true;
  if (entry.numericAnswer !== undefined && entry.numericAnswer !== '' && entry.numericAnswer !== null) {
    return true;
  }
  if (typeof entry.textAnswer === 'string' && entry.textAnswer.trim().length > 0) return true;
  if (typeof entry.sql === 'string' && entry.sql.trim().length > 0) return true;
  return false;
};

const buildCodingAnswerState = (questionDoc, existingAnswer) => {
  const langs = questionDoc?.allowedLanguages || ['python'];
  const defaultLang = langs[0] || 'python';
  const savedLang =
    existingAnswer?.language && langs.includes(existingAnswer.language)
      ? existingAnswer.language
      : defaultLang;
  const starter = { ...(questionDoc?.starterCode || {}) };
  const codeByLanguage = { ...starter };
  if (existingAnswer?.answer != null && String(existingAnswer.answer).length > 0) {
    codeByLanguage[savedLang] = existingAnswer.answer;
  }
  const code = codeByLanguage[savedLang] ?? starter[savedLang] ?? '';
  const hasSavedCode =
    existingAnswer?.answer != null && String(existingAnswer.answer).trim().length > 0;
  return {
    language: savedLang,
    codeByLanguage,
    code,
    attempted: hasSavedCode,
  };
};

const getCodingCode = (answersMap, qKey, lang, questionDoc) => {
  const entry = answersMap[qKey];
  const fromMap = entry?.codeByLanguage?.[lang];
  if (fromMap !== undefined && fromMap !== null) return fromMap;
  return questionDoc?.starterCode?.[lang] ?? '';
};

/** ER-style schema diagram: tables in a row with arrows for relationships */
function SchemaView({ schemaSql }) {
  const { tables, relationships } = parseSchemaSql(schemaSql);
  const containerRef = useRef(null);
  const tableRefs = useRef({});
  const [positions, setPositions] = useState({});

  const setTableRef = useCallback((name) => (el) => {
    if (el) tableRefs.current[name] = el;
  }, []);

  const [svgSize, setSvgSize] = useState({ width: 0, height: 0 });

  const measure = useCallback(() => {
    const container = containerRef.current;
    if (!container || !tables.length) return;
    const containerRect = container.getBoundingClientRect();
    const scrollLeft = container.scrollLeft || 0;
    const scrollTop = container.scrollTop || 0;
    const next = {};
    tables.forEach((t) => {
      const el = tableRefs.current[t.tableName];
      if (el) {
        const r = el.getBoundingClientRect();
        next[t.tableName] = {
          left: r.left - containerRect.left + scrollLeft,
          top: r.top - containerRect.top + scrollTop,
          width: r.width,
          height: r.height
        };
      }
    });
    setPositions(next);
    setSvgSize({ width: container.scrollWidth, height: container.scrollHeight });
  }, [tables]);

  useEffect(() => {
    measure();
    const onResize = () => measure();
    const onScroll = () => measure();
    window.addEventListener('resize', onResize);
    const container = containerRef.current;
    if (container) container.addEventListener('scroll', onScroll);
    return () => {
      window.removeEventListener('resize', onResize);
      if (container) container.removeEventListener('scroll', onScroll);
    };
  }, [measure]);

  useEffect(() => {
    const t = setTimeout(measure, 50);
    return () => clearTimeout(t);
  }, [measure, tables, relationships]);

  if (!tables.length) {
    return <pre className="schema-sql-fallback">{schemaSql || 'No schema.'}</pre>;
  }

  const tableNameByLower = {};
  tables.forEach((t) => { tableNameByLower[t.tableName.toLowerCase()] = t.tableName; });

  return (
    <div className="schema-diagram-wrap" ref={containerRef}>
      <div className="schema-diagram-tables">
        {tables.map((t) => (
          <div
            key={t.tableName}
            ref={setTableRef(t.tableName)}
            className="schema-er-table"
            data-table-name={t.tableName}
          >
            <div className="schema-er-table-header">{t.tableName}</div>
            <div className="schema-er-table-body">
              {t.columns.map((col) => (
                <div key={col.name} className="schema-er-column">
                  <span className="schema-er-col-name">{col.name}</span>
                  {col.type && <span className="schema-er-col-type">{col.type}</span>}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <svg className="schema-diagram-arrows" aria-hidden="true" width={svgSize.width} height={svgSize.height}>
        <defs>
          <marker
            id="schema-arrowhead"
            markerWidth="8"
            markerHeight="6"
            refX="7"
            refY="3"
            orient="auto"
          >
            <polygon points="0 0, 8 3, 0 6" fill="var(--schema-arrow, #94a3b8)" />
          </marker>
        </defs>
        {relationships.map((rel, i) => {
          const fromKey = tableNameByLower[rel.fromTable.toLowerCase()] ?? rel.fromTable;
          const toKey = tableNameByLower[rel.toTable.toLowerCase()] ?? rel.toTable;
          const from = positions[fromKey];
          const to = positions[toKey];
          if (!from || !to || fromKey === toKey) return null;
          const fromCx = from.left + from.width / 2;
          const fromCy = from.top + from.height / 2;
          const toCx = to.left + to.width / 2;
          const toCy = to.top + to.height / 2;
          const dx = toCx - fromCx;
          const dy = toCy - fromCy;
          const pad = 6;
          let x1, y1, x2, y2;
          if (Math.abs(dx) >= Math.abs(dy)) {
            x1 = dx >= 0 ? from.left + from.width + pad : from.left - pad;
            y1 = fromCy;
            x2 = dx >= 0 ? to.left - pad : to.left + to.width + pad;
            y2 = toCy;
          } else {
            x1 = fromCx;
            y1 = dy >= 0 ? from.top + from.height + pad : from.top - pad;
            x2 = toCx;
            y2 = dy >= 0 ? to.top - pad : to.top + to.height + pad;
          }
          const midX = (x1 + x2) / 2;
          const path = `M ${x1} ${y1} L ${midX} ${y1} L ${midX} ${y2} L ${x2} ${y2}`;
          return (
            <path
              key={`${rel.fromTable}-${rel.fromColumn}-${rel.toTable}-${i}`}
              d={path}
              className="schema-relation-line"
              markerEnd="url(#schema-arrowhead)"
            />
          );
        })}
      </svg>
    </div>
  );
}

/** Build section list synchronously so the UI never flashes "no questions" before useEffect runs */
function buildSectionsFromTest(test) {
  if (!test?.questions?.length) return [];

  const codingQuestions = test.questions.filter((q) => q.type === 'coding');
  const mcqQuestions = test.questions.filter((q) => q.type === 'mcq');
  const aptitudeQuestions = test.questions.filter((q) => q.type === 'aptitude');
  const theoryQuestions = test.questions.filter((q) => q.type === 'theory');
  const sqlQuestions = test.questions.filter((q) => q.type === 'sql');

  const newSections = [];
  if (codingQuestions.length > 0) {
    newSections.push({
      type: 'coding',
      title: 'Section 1: Coding Questions',
      questions: codingQuestions,
    });
  }
  if (mcqQuestions.length > 0) {
    newSections.push({
      type: 'mcq',
      title: 'Section 2: MCQ Questions',
      questions: mcqQuestions,
    });
  }
  if (aptitudeQuestions.length > 0) {
    newSections.push({
      type: 'aptitude',
      title: `Section ${newSections.length + 1}: Aptitude Questions`,
      questions: aptitudeQuestions,
    });
  }
  if (theoryQuestions.length > 0) {
    newSections.push({
      type: 'theory',
      title: `Section ${newSections.length + 1}: Theory Questions`,
      questions: theoryQuestions,
    });
  }
  if (sqlQuestions.length > 0) {
    newSections.push({
      type: 'sql',
      title: `Section ${newSections.length + 1}: SQL Questions`,
      questions: sqlQuestions,
    });
  }
  return newSections;
}

const SubmissionSummaryPanel = ({ summary, onDismiss }) => {
  if (!summary) return null;
  return (
    <div className="submission-summary submission-summary-inline">
      <div className="submission-summary-head">
        <h3>Submission results</h3>
        <button type="button" className="submission-summary-dismiss" onClick={onDismiss} aria-label="Dismiss results">
          ×
        </button>
      </div>
      {summary.visibleResults.length > 0 && (
        <div className="test-case-group">
          <h4>Sample test cases ({summary.visiblePassed}/{summary.visibleTotal} passed)</h4>
          <div className="test-case-results-list">
            {summary.visibleResults.map((result, idx) => (
              <div key={idx} className={`test-case-result-item ${result.passed ? 'passed' : 'failed'}`}>
                <div className="test-case-result-header">
                  <span>Test case {result.testCaseIndex}</span>
                  <span className={`test-case-status ${result.passed ? 'passed' : 'failed'}`}>
                    {result.passed ? '✓ Passed' : '✗ Failed'}
                  </span>
                </div>
                {!result.passed && (
                  <div className="test-case-result-details">
                    <div><strong>Expected:</strong> <pre>{result.expectedOutput}</pre></div>
                    <div><strong>Got:</strong> <pre>{result.actualOutput || '(No output)'}</pre></div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      {summary.hiddenResults.length > 0 && (
        <div className="test-case-group">
          <h4>Hidden test cases ({summary.hiddenPassed}/{summary.hiddenTotal} passed)</h4>
          <div className="test-case-results-list">
            {summary.hiddenResults.map((result, idx) => (
              <div key={idx} className={`test-case-result-item ${result.passed ? 'passed' : 'failed'}`}>
                <div className="test-case-result-header">
                  <span>Hidden test case {result.testCaseIndex}</span>
                  <span className={`test-case-status ${result.passed ? 'passed' : 'failed'}`}>
                    {result.passed ? '✓ Passed' : '✗ Failed'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="summary-total">
        <strong>Total: {summary.totalPassed} / {summary.totalTestCases} test cases passed</strong>
      </div>
    </div>
  );
};

const TestTakingLoader = ({ message = 'Preparing your test…' }) => (
  <div className="test-taking-loader" role="status" aria-live="polite">
    <div className="test-taking-loader-spinner" aria-hidden />
    <p className="test-taking-loader-text">{message}</p>
  </div>
);

const TestTaking = () => {
  const { testId } = useParams();
  const [searchParams] = useSearchParams();
  const contestId = searchParams.get('contestId');
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useToast();
  const attemptWindowEndRef = useRef(null);
  const autoSubmitTriggeredRef = useRef(false);
  const fromShareLink = isFromShareLink(location);
  const [fullscreenReady, setFullscreenReady] = useState(false);
  const [test, setTest] = useState(null);
  const [result, setResult] = useState(null);
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [pageLoading, setPageLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [savingAnswer, setSavingAnswer] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [timeExpired, setTimeExpired] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState('python');
  
  // Modal states
  const [modal, setModal] = useState({ isOpen: false, title: '', message: '', type: 'info' });
  
  const handleSubmitTestRef = useRef(null);

  // Exam security - stable handlers so the timer does not reset proctoring every second
  const handleMaxViolations = useCallback(() => {
    setModal({
      isOpen: true,
      title: 'Auto-Submission',
      message: 'You have reached the maximum number of violations. Your test will be automatically submitted.',
      type: 'error',
    });
    setTimeout(() => {
      handleSubmitTestRef.current?.(true);
    }, 2000);
  }, []);

  const handleViolationWarning = useCallback((currentViolations, maxViolations) => {
    setModal({
      isOpen: true,
      title: 'Violation Warning',
      message: `Warning: You have ${currentViolations} violation(s). After ${maxViolations} violations, your test will be automatically submitted. Please follow the exam rules.`,
      type: 'warning',
    });
  }, []);
  
  const {
    violations,
    maxViolations,
    isFullscreen,
    requestFullscreen,
    trackViolation,
    securityOverlay,
    onReenterFullscreen,
  } = useExamSecurity(
    result?._id || null,
    handleMaxViolations,
    handleViolationWarning,
    {
      autoRequestFullscreen: !fromShareLink,
      initialViolationCount: result?.violationCount ?? 0,
    }
  );

  const examInProgress = Boolean(
    result?._id && result?.status === 'in_progress' && test && !submitting
  );
  useRegisterExamLock(examInProgress, { trackViolation });
  const { allowNextNavigation } = useExamLock();

  const goToResult = useCallback((id) => {
    if (!id) return;
    allowNextNavigation();
    try {
      navigate(`/student/result/${id}`, { replace: true });
    } catch (_) {
      // navigation may fail in edge cases; fallback below
    }
    setTimeout(() => {
      if (!window.location.pathname.includes('/student/result/')) {
        window.location.href = `/student/result/${id}`;
      }
    }, 300);
  }, [navigate, allowNextNavigation]);

  useEffect(() => {
    if (isFullscreen || isDocumentFullscreen()) {
      setFullscreenReady(true);
      clearShareLinkAttempt();
    }
  }, [isFullscreen, result]);

  useEffect(() => {
    if (!result || fullscreenReady) return;
    if (fromShareLink) return;
    const t = setTimeout(() => {
      if (isDocumentFullscreen()) setFullscreenReady(true);
    }, 800);
    return () => clearTimeout(t);
  }, [result, fullscreenReady, fromShareLink]);
  const [testCaseResults, setTestCaseResults] = useState([]); // For visible test case execution results
  // eslint-disable-next-line no-unused-vars
  const [hiddenTestCaseResults, setHiddenTestCaseResults] = useState([]); // For hidden test case results (used in submission summary)
  const [isRunningTests, setIsRunningTests] = useState(false);
  const [submissionSummary, setSubmissionSummary] = useState(null);
  const [sqlRunResult, setSqlRunResult] = useState(null);
  const [isRunningSql, setIsRunningSql] = useState(false);
  
  // Custom test case
  const [customTestCase, setCustomTestCase] = useState({ input: '', expectedOutput: '' });
  const [customTestResult, setCustomTestResult] = useState(null);
  
  // Resizable panel state
  const [leftPanelWidth, setLeftPanelWidth] = useState(50); // percentage
  const [isResizing, setIsResizing] = useState(false);
  
  const sections = useMemo(() => buildSectionsFromTest(test), [test]);

  const questionProgress = useMemo(() => {
    const total = sections.reduce((sum, sec) => sum + sec.questions.length, 0);
    let num = 0;
    for (let i = 0; i < currentSectionIndex; i += 1) {
      num += sections[i].questions.length;
    }
    num += currentQuestionIndex + 1;
    return { totalQuestions: total, currentQuestionNumber: num };
  }, [sections, currentSectionIndex, currentQuestionIndex]);

  useEffect(() => {
    fetchTest();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run when testId changes
  }, [testId]);

  // Handle resizing
  const handleResizeStart = (e) => {
    setIsResizing(true);
    e.preventDefault();
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isResizing) return;
      
      const container = document.querySelector('.main-content-wrapper');
      if (!container) return;
      
      const containerRect = container.getBoundingClientRect();
      const newLeftWidth = ((e.clientX - containerRect.left) / containerRect.width) * 100;
      
      // Limit between 30% and 70%
      const clampedWidth = Math.max(30, Math.min(70, newLeftWidth));
      setLeftPanelWidth(clampedWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing]);

  const handleSubmitTest = async (skipConfirmation = false, autoSubmitted = false) => {
    if (!result) {
      showToast('Test session not found', 'error');
      return;
    }

    if (submitting) return;
    
    // Show confirmation modal instead of browser confirm
    if (!skipConfirmation) {
      showModal(
        'Confirm Submission', 
        'Are you sure you want to submit the test? You cannot change your answers after submission.', 
        'warning'
      );
      return;
    }
    
  // Actually submit the test
    try {
      setSubmitting(true);
      setPageLoading(true);
      console.log('📤 Submitting test:', result._id);
      const submitBody = {
        ...(contestId ? { contestId } : {}),
        ...(autoSubmitted ? { autoSubmitted: true } : {}),
      };
      const response = await axiosInstance.post(`/results/${result._id}/submit`, submitBody);
      console.log('✅ Test submitted successfully');
      const finalId = response?.data?._id || result._id;
      goToResult(finalId);
    } catch (error) {
      setPageLoading(false);
      setSubmitting(false);
      console.error('❌ Error submitting test:', error);
      const status = error?.response?.status;
      const serverMsg = error.response?.data?.message || error.response?.data?.error || error.message || 'Error submitting test';
      const alreadySubmitted =
        status === 400 && typeof serverMsg === 'string' && serverMsg.toLowerCase().includes('already');

      if (alreadySubmitted) {
        goToResult(error.response?.data?.resultId || result._id);
        return;
      }

      showToast(serverMsg, 'error');
    }
  };

  useEffect(() => {
    handleSubmitTestRef.current = handleSubmitTest;
  });

  useEffect(() => {
    if (result && result.status === 'in_progress' && test) {
      const duration = test.duration * 60 * 1000;
      const elapsed = Date.now() - new Date(result.startedAt).getTime();
      const durationRemaining = Math.max(0, duration - elapsed);
      const windowEnd = attemptWindowEndRef.current
        ? new Date(attemptWindowEndRef.current).getTime()
        : null;
      const windowRemaining = windowEnd ? Math.max(0, windowEnd - Date.now()) : durationRemaining;
      const remaining = windowEnd ? Math.min(durationRemaining, windowRemaining) : durationRemaining;
      setTimeRemaining(remaining);
      
      // Check if time already expired
      if (remaining <= 0) {
        setTimeExpired(true);
      }

      const timer = setInterval(() => {
        setTimeRemaining((prev) => {
          const newTime = prev - 1000;
          if (newTime <= 0 && !autoSubmitTriggeredRef.current) {
            autoSubmitTriggeredRef.current = true;
            setTimeExpired(true);
            setModal({
              isOpen: true,
              title: 'Time\'s up',
              message: contestId
                ? 'The contest attempt window has ended. Your test will be submitted automatically.'
                : 'Your test time has ended. Your test will be submitted automatically.',
              type: 'warning',
            });
            setTimeout(() => {
              handleSubmitTestRef.current?.(true, true);
            }, 2000);
            return 0;
          }
          return Math.max(0, newTime);
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [result, test, timeExpired, contestId]);

  // Normalize output for comparison (handles whitespace, newlines, etc.)
  const normalizeOutput = (output) => {
    if (!output) return '';
    return output
      .trim()
      .replace(/\r\n/g, '\n')  // Normalize line endings
      .replace(/\r/g, '\n')
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .join('\n');
  };

  const showModal = (title, message, type = 'info') => {
    setModal({ isOpen: true, title, message, type });
  };

  const closeModal = () => {
    setModal({ isOpen: false, title: '', message: '', type: 'info' });
  };

  const fetchTest = async () => {
    try {
      setPageLoading(true);
      setLoadError(null);
      setTest(null);
      setResult(null);
      console.log('📥 Fetching test:', testId);

      const testRes = await axiosInstance.get(`/tests/${testId}`);
      console.log('✅ Test fetched:', testRes.data);

      if (!testRes.data?.questions?.length) {
        setLoadError('This test has no questions. Please contact your instructor.');
        return;
      }

      const builtSections = buildSectionsFromTest(testRes.data);
      if (!builtSections.length) {
        setLoadError('This test has no supported question types. Please contact your instructor.');
        return;
      }

      console.log('🚀 Starting test...');
      const resultRes = await axiosInstance.post(
        `/results/start/${testId}`,
        contestId ? { contestId } : {}
      );
      console.log('✅ Test started:', resultRes.data);

      if (resultRes.data?.attemptWindowEnd) {
        attemptWindowEndRef.current = resultRes.data.attemptWindowEnd;
      }

      setTest(testRes.data);
      setResult(resultRes.data);
      
      // Initialize answers with starter code for coding questions and previous answers if continuing
      const initialAnswers = {};
      testRes.data.questions.forEach((q) => {
        const existingAnswer = resultRes.data.answers.find(a => a.questionId.toString() === q.questionId._id.toString());
        
        if (q.type === 'coding') {
          initialAnswers[questionKey(q.questionId._id)] = buildCodingAnswerState(
            q.questionId,
            existingAnswer
          );
        } else if (q.type === 'mcq') {
          const qk = questionKey(q.questionId._id);
          initialAnswers[qk] = {
            selectedOption: existingAnswer?.answer !== undefined ? existingAnswer.answer : null,
            attempted: existingAnswer?.answer !== undefined && existingAnswer?.answer !== null
          };
        } else if (q.type === 'aptitude') {
          const qk = questionKey(q.questionId._id);
          const questionType = q.questionId.questionType;
          if (questionType === 'numeric') {
            const numericValue = existingAnswer?.answer !== undefined ? existingAnswer.answer : '';
            initialAnswers[qk] = {
              numericAnswer: numericValue,
              attempted: numericValue !== '' && numericValue !== null && numericValue !== undefined
            };
          } else if (questionType === 'multi') {
            const selectedOptions = Array.isArray(existingAnswer?.answer) ? existingAnswer.answer : [];
            initialAnswers[qk] = {
              selectedOptions,
              attempted: selectedOptions.length > 0
            };
          } else {
            initialAnswers[qk] = {
              selectedOption: existingAnswer?.answer !== undefined ? existingAnswer.answer : null,
              attempted: existingAnswer?.answer !== undefined && existingAnswer?.answer !== null
            };
          }
        } else if (q.type === 'theory') {
          const qk = questionKey(q.questionId._id);
          const theoryAnswer = existingAnswer?.answer || '';
          initialAnswers[qk] = {
            textAnswer: theoryAnswer,
            attempted: theoryAnswer.trim().length > 0
          };
        } else if (q.type === 'sql') {
          const qk = questionKey(q.questionId._id);
          const sqlAnswer = existingAnswer?.answer || '';
          initialAnswers[qk] = {
            sql: sqlAnswer,
            attempted: sqlAnswer.trim().length > 0
          };
        }
      });
      setAnswers(initialAnswers);

      const firstCoding = testRes.data.questions.find((q) => q.type === 'coding');
      if (firstCoding?.questionId) {
        const fk = questionKey(firstCoding.questionId._id);
        setSelectedLanguage(initialAnswers[fk]?.language || firstCoding.questionId.allowedLanguages?.[0] || 'python');
      }
    } catch (error) {
      console.error('❌ Error fetching/starting test:', error);
      const serverMsg = error.response?.data?.message || '';
      const existingResultId = error.response?.data?.resultId;
      const alreadyCompleted =
        error.response?.status === 400 &&
        typeof serverMsg === 'string' &&
        serverMsg.toLowerCase().includes('already completed');

      if (alreadyCompleted && existingResultId) {
        goToResult(existingResultId);
        return;
      }

      const autoSubmittedOnStart =
        error.response?.status === 400 &&
        (error.response?.data?.autoSubmitted || serverMsg.toLowerCase().includes('submitted automatically'));

      if (autoSubmittedOnStart && existingResultId) {
        goToResult(existingResultId);
        return;
      }

      const errorMsg =
        serverMsg ||
        error.response?.data?.error ||
        'Unable to start the test. Please try again.';
      setTest(null);
      setResult(null);
      setLoadError(errorMsg);
    } finally {
      setPageLoading(false);
    }
  };

  const getCurrentQuestion = () => {
    if (!sections.length || currentSectionIndex >= sections.length) return null;
    const section = sections[currentSectionIndex];
    if (currentQuestionIndex >= section.questions.length) return null;
    return section.questions[currentQuestionIndex];
  };

  const getQuestionStatus = (questionId, questionType) => {
    const qk = questionKey(questionId);

    if (questionType !== 'coding' && isAnswerAttemptedLocally(answers[qk])) {
      return 'attempted';
    }

    if (!result || !result.answers) return 'not-attempted';
    const answer = result.answers.find((a) => a.questionId.toString() === qk);
    if (!answer || answer.answer === undefined || answer.answer === null) return 'not-attempted';
    if (Array.isArray(answer.answer)) {
      return answer.answer.length > 0 ? 'attempted' : 'not-attempted';
    }
    if (typeof answer.answer === 'string' && answer.answer.trim() === '') {
      return 'not-attempted';
    }
    if (questionType === 'coding') {
      return 'attempted';
    }
    return 'attempted';
  };

  const persistQuestionAnswer = useCallback(
    async (questionId, answer, extra = {}) => {
      if (!result?._id) return false;
      const qIdApi = questionKey(questionId);
      try {
        await axiosInstance.post(`/results/${result._id}/answer`, {
          questionId: qIdApi,
          answer,
          ...extra,
        });
        const updatedResult = await axiosInstance.get(`/results/${result._id}`);
        setResult(updatedResult.data);
        return true;
      } catch (error) {
        console.error('Error saving answer:', error);
        return false;
      }
    },
    [result?._id]
  );

  // Restore per-question language when navigating the question list
  useEffect(() => {
    const question = getCurrentQuestion();
    if (!question?.questionId || question.type !== 'coding') return;
    const qKey = questionKey(question.questionId._id);
    const langs = question.questionId.allowedLanguages || ['python'];
    const stored = answers[qKey]?.language;
    const nextLang = stored && langs.includes(stored) ? stored : langs[0];
    setSelectedLanguage(nextLang);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync language on navigation only
  }, [currentSectionIndex, currentQuestionIndex, sections]);

  const handleLanguageChange = (newLanguage) => {
    const question = getCurrentQuestion();
    if (!question || !question.questionId || question.type !== 'coding') return;

    const qKey = questionKey(question.questionId._id);
    const starter = question.questionId.starterCode || {};

    setSelectedLanguage(newLanguage);
    setAnswers((prev) => {
      const entry = prev[qKey] || {};
      const codeByLanguage = { ...(entry.codeByLanguage || {}) };
      const currentCode = getCodingCode(prev, qKey, selectedLanguage, question.questionId);
      codeByLanguage[selectedLanguage] = currentCode;
      const nextCode =
        codeByLanguage[newLanguage] !== undefined
          ? codeByLanguage[newLanguage]
          : starter[newLanguage] ?? '';
      codeByLanguage[newLanguage] = nextCode;
      return {
        ...prev,
        [qKey]: {
          ...entry,
          language: newLanguage,
          codeByLanguage,
          code: nextCode,
          attempted: entry.attempted ?? false,
        },
      };
    });
    setTestCaseResults([]);
    setCustomTestResult(null);
  };

  const handleCodeChange = (value) => {
    const question = getCurrentQuestion();
    if (!question || !question.questionId) return;

    const qKey = questionKey(question.questionId._id);
    const code = value ?? '';

    setAnswers((prev) => {
      const entry = prev[qKey] || {};
      const codeByLanguage = { ...(entry.codeByLanguage || {}), [selectedLanguage]: code };
      return {
        ...prev,
        [qKey]: {
          ...entry,
          language: selectedLanguage,
          codeByLanguage,
          code,
          attempted: entry.attempted ?? false,
        },
      };
    });
    setTestCaseResults([]);
    setCustomTestResult(null);
  };

  const handleMCQAnswer = async (optionIndex) => {
    const question = getCurrentQuestion();
    if (!question?.questionId) return;

    const qKey = questionKey(question.questionId._id);
    setAnswers((prev) => ({
      ...prev,
      [qKey]: {
        ...prev[qKey],
        selectedOption: optionIndex,
        attempted: true,
      },
    }));

    const saved = await persistQuestionAnswer(question.questionId._id, optionIndex);
    if (!saved) {
      showToast('Could not save your answer. Please try again.', 'error');
    }
  };

  const handleAptitudeSingle = async (optionIndex) => {
    const question = getCurrentQuestion();
    if (!question?.questionId) return;

    const qKey = questionKey(question.questionId._id);
    setAnswers((prev) => ({
      ...prev,
      [qKey]: {
        ...prev[qKey],
        selectedOption: optionIndex,
        attempted: true,
      },
    }));

    const saved = await persistQuestionAnswer(question.questionId._id, optionIndex);
    if (!saved) {
      showToast('Could not save your answer. Please try again.', 'error');
    }
  };

  const handleAptitudeMulti = (optionIndex) => {
    const question = getCurrentQuestion();
    if (!question?.questionId) return;

    const qKey = questionKey(question.questionId._id);
    setAnswers((prev) => {
      const current = prev[qKey]?.selectedOptions || [];
      const exists = current.includes(optionIndex);
      const updated = exists
        ? current.filter((idx) => idx !== optionIndex)
        : [...current, optionIndex];
      return {
        ...prev,
        [qKey]: {
          ...prev[qKey],
          selectedOptions: updated,
          attempted: updated.length > 0,
        },
      };
    });
  };

  const handleAptitudeNumeric = (value) => {
    const question = getCurrentQuestion();
    if (!question?.questionId) return;

    const qKey = questionKey(question.questionId._id);
    setAnswers((prev) => ({
      ...prev,
      [qKey]: {
        ...prev[qKey],
        numericAnswer: value,
        attempted: value !== '' && value !== null && value !== undefined,
      },
    }));
  };

  const handleTheoryAnswerChange = (value) => {
    const question = getCurrentQuestion();
    if (!question?.questionId) return;

    const qKey = questionKey(question.questionId._id);
    setAnswers((prev) => ({
      ...prev,
      [qKey]: {
        ...prev[qKey],
        textAnswer: value,
        attempted: value.trim().length > 0,
      },
    }));
  };

  const handleSqlChange = (value) => {
    const question = getCurrentQuestion();
    if (!question?.questionId) return;

    const qKey = questionKey(question.questionId._id);
    setAnswers((prev) => ({
      ...prev,
      [qKey]: {
        ...prev[qKey],
        sql: value || '',
        attempted: (value || '').trim().length > 0,
      },
    }));
  };

  const handleRunSql = async () => {
    const question = getCurrentQuestion();
    if (!question || !question.questionId || !result) return;
    const query = answerFor(answers, question.questionId._id).sql || '';
    if (!query.trim()) {
      showToast('Please enter a SQL query first', 'warning');
      return;
    }
    setIsRunningSql(true);
    setSqlRunResult(null);
    try {
      const resultId = typeof result._id === 'object' && result._id?.toString ? result._id.toString() : String(result._id);
      const questionIdForRun = typeof question.questionId._id === 'object' && question.questionId._id?.toString ? question.questionId._id.toString() : String(question.questionId._id);
      const res = await axiosInstance.post('/sql-execution/run', {
        resultId,
        questionId: questionIdForRun,
        query: query.trim()
      });
      const data = res.data || {};
      setSqlRunResult({
        success: Boolean(data.success),
        rows: Array.isArray(data.rows) ? data.rows : [],
        error: data.error || null,
        isCorrect: Boolean(data.isCorrect),
        runCount: data.runCount,
        maxRuns: data.maxRuns
      });

      // Auto-submit answer when SQL is correct so student doesn't have to click Save
      if (data.isCorrect) {
        try {
          const resultIdForApi = typeof result._id === 'object' && result._id?.toString ? result._id.toString() : String(result._id);
          const questionIdForApi = typeof question.questionId._id === 'object' && question.questionId._id?.toString ? question.questionId._id.toString() : String(question.questionId._id);
          await axiosInstance.post(`/results/${resultIdForApi}/answer`, {
            questionId: questionIdForApi,
            answer: query.trim()
          });
          const updatedResult = await axiosInstance.get(`/results/${resultIdForApi}`);
          setResult(updatedResult.data);
          showToast('Correct! Your answer was saved automatically.', 'success');
        } catch (saveErr) {
          console.error('Auto-save SQL answer failed:', saveErr);
          showToast('Your answer was correct but could not be saved automatically. Please click Save Answer.', 'warning');
        }
      }
    } catch (err) {
      const errMsg = err.response?.data?.error || err.response?.data?.message || (err.response?.data?.errors?.[0]?.msg) || err.message || 'Execution failed';
      setSqlRunResult({
        success: false,
        rows: [],
        error: String(errMsg)
      });
    } finally {
      setIsRunningSql(false);
    }
  };

  const handleRunCustomTestCase = async () => {
    const question = getCurrentQuestion();
    if (!question || !question.questionId) {
      showToast('Question not loaded', 'error');
      return;
    }
    
    const qKey = questionKey(question.questionId._id);
    const code = getCodingCode(answers, qKey, selectedLanguage, question.questionId);

    if (!code.trim()) {
      showToast('Please write some code first', 'warning');
      return;
    }

    if (!customTestCase.input.trim()) {
      showToast('Please provide input for the test case', 'warning');
      return;
    }

    try {
      setIsRunningTests(true);
      const response = await axiosInstance.post('/code-execution/execute', {
        code,
        language: selectedLanguage,
        input: customTestCase.input
      }, { timeout: CODE_REQUEST_TIMEOUT_EXECUTE_MS });

      const expectedNormalized = normalizeOutput(customTestCase.expectedOutput);
      const actualNormalized = normalizeOutput(response.data.output || '');
      const passed = response.data.success && expectedNormalized === actualNormalized;

      setCustomTestResult({
        input: customTestCase.input,
        expectedOutput: customTestCase.expectedOutput,
        actualOutput: response.data.output || '',
        error: response.data.error || '',
        passed,
        executionTime: response.data.executionTime || 0
      });
      setIsRunningTests(false);
    } catch (error) {
      setIsRunningTests(false);
      console.error('❌ Error executing custom test case:', error);
      let errorMsg = error.response?.data?.error || error.message || 'Error executing code';
      if (error.code === 'ECONNABORTED') {
        errorMsg = 'Request timed out. Is the code-worker running with the same Redis URL as the API?';
      }
      setCustomTestResult({
        input: customTestCase.input,
        expectedOutput: customTestCase.expectedOutput,
        actualOutput: '',
        error: errorMsg,
        passed: false,
        executionTime: 0
      });
    }
  };

  const handleRunCode = async () => {
    const question = getCurrentQuestion();
    if (!question || !question.questionId) {
      showToast('Question not loaded', 'error');
      return;
    }
    
    const qKey = questionKey(question.questionId._id);
    const code = getCodingCode(answers, qKey, selectedLanguage, question.questionId);

    if (!code.trim()) {
      showToast('Please write some code first', 'warning');
      return;
    }

    try {
      setIsRunningTests(true);
      setTestCaseResults([]);
      
      const questionData = question.questionId;
      const visibleTestCases = questionData.testCases?.filter(tc => !tc.isHidden) || [];
      
      if (visibleTestCases.length === 0) {
        showToast('No sample test cases available for this question.', 'info');
        setIsRunningTests(false);
        return;
      }

      const response = await axiosInstance.post('/code-execution/execute-batch', {
        code,
        language: selectedLanguage,
        testCases: visibleTestCases.map(tc => ({ input: tc.input, expectedOutput: tc.expectedOutput }))
      }, { timeout: CODE_REQUEST_TIMEOUT_BATCH_MS });

      const batchResults = response.data.results || [];
      const results = batchResults.map((r, i) => ({
        testCaseIndex: i + 1,
        input: visibleTestCases[i]?.input || '',
        expectedOutput: visibleTestCases[i]?.expectedOutput || '',
        actualOutput: r.output || '',
        error: r.error || response.data.compilationError || '',
        passed: r.passed,
        executionTime: r.executionTime || 0
      }));

      setTestCaseResults(results);
      setIsRunningTests(false);
      
      const passedCount = results.filter(r => r.passed).length;
      const totalCount = results.length;
      
      if (passedCount === totalCount) {
        showToast(`All ${totalCount} sample test case(s) passed!`, 'success', { title: 'All test cases passed' });
      } else {
        showToast(`${passedCount} out of ${totalCount} sample test case(s) passed.`, 'warning', { title: 'Some test cases failed' });
      }
    } catch (error) {
      setIsRunningTests(false);
      console.error('Error executing code:', error);
      let errorMsg = error.response?.data?.error ||
                      error.response?.data?.message ||
                      error.message ||
                      'Error executing code. Please check your code and try again.';
      if (error.code === 'ECONNABORTED') {
        errorMsg = 'Request timed out. Is the code-worker running with the same Redis URL and app version as the API?';
      }
      showToast(errorMsg, 'error', { title: 'Code execution error' });
    }
  };

  const handleSubmitAnswer = async () => {
    const question = getCurrentQuestion();
    if (!question || !question.questionId || !result) {
      showToast('Test data not loaded', 'error');
      return;
    }
    
    const questionId = question.questionId._id;
    const qKey = questionKey(questionId);
    const localAnswer = answerFor(answers, questionId);

    try {
      setSavingAnswer(true);
      if (question.type === 'coding') {
        const code = getCodingCode(answers, qKey, selectedLanguage, question.questionId);
        
        if (!code.trim()) {
          showToast('Please write some code before saving', 'warning');
          setSavingAnswer(false);
          return;
        }
        
        const allTestCases = question.questionId.testCases || [];
        const visibleTestCases = allTestCases.filter(tc => !tc.isHidden);
        const hiddenTestCases = allTestCases.filter(tc => tc.isHidden);

        const batchPayload = allTestCases.map(tc => ({ input: tc.input, expectedOutput: tc.expectedOutput }));
        const batchResponse = await axiosInstance.post('/code-execution/execute-batch', {
          code,
          language: selectedLanguage,
          testCases: batchPayload
        }, { timeout: CODE_REQUEST_TIMEOUT_BATCH_MS });

        const batchResults = batchResponse.data.results || [];
        let testCasesPassed = 0;
        const visibleResults = [];
        const hiddenResults = [];

        batchResults.forEach((r, idx) => {
          const tc = allTestCases[idx];
          const isHidden = tc?.isHidden;
          if (r.passed) testCasesPassed++;

          if (isHidden) {
            hiddenResults.push({
              testCaseIndex: hiddenResults.length + 1,
              input: '[Hidden]',
              expectedOutput: '[Hidden]',
              actualOutput: r.passed ? '[Passed]' : '[Failed]',
              passed: r.passed,
              isHidden: true,
              executionTime: r.executionTime || 0
            });
          } else {
            visibleResults.push({
              testCaseIndex: visibleResults.length + 1,
              input: tc?.input || '',
              expectedOutput: tc?.expectedOutput || '',
              actualOutput: r.output || '',
              passed: r.passed,
              isHidden: false,
              error: r.error || batchResponse.data.compilationError || '',
              executionTime: r.executionTime || 0
            });
          }
        });

        await axiosInstance.post(`/results/${result._id}/answer`, {
          questionId,
          answer: code,
          language: selectedLanguage,
          testCasesPassed,
          totalTestCases: allTestCases.length
        });
        
        setSubmissionSummary({
          visibleResults,
          hiddenResults,
          visiblePassed: visibleResults.filter(r => r.passed).length,
          visibleTotal: visibleTestCases.length,
          hiddenPassed: hiddenResults.filter(r => r.passed).length,
          hiddenTotal: hiddenTestCases.length,
          totalPassed: testCasesPassed,
          totalTestCases: allTestCases.length
        });
        setHiddenTestCaseResults(hiddenResults);
        
        showToast('Answer saved successfully', 'success');
        
        // Refresh result to get updated answers
        const updatedResult = await axiosInstance.get(`/results/${result._id}`);
        setResult(updatedResult.data);
        setAnswers((prev) => ({
          ...prev,
          [qKey]: { ...prev[qKey], attempted: true },
        }));
      } else if (question.type === 'mcq') {
        if (localAnswer.selectedOption === undefined || localAnswer.selectedOption === null) {
          showToast('Please select an answer', 'warning');
          setSavingAnswer(false);
          return;
        }

        const saved = await persistQuestionAnswer(questionId, localAnswer.selectedOption);
        if (saved) {
          showToast('Answer saved successfully', 'success');
        } else {
          showToast('Could not save answer', 'error');
        }
      } else if (question.type === 'aptitude') {
        const questionType = question.questionId.questionType;
        if (questionType === 'numeric') {
          const numericValue = localAnswer.numericAnswer;
          if (numericValue === '' || numericValue === null || numericValue === undefined) {
            showToast('Please enter a numeric answer', 'warning');
            setSavingAnswer(false);
            return;
          }
          const saved = await persistQuestionAnswer(questionId, numericValue);
          if (saved) showToast('Answer saved successfully', 'success');
          else showToast('Could not save answer', 'error');
        } else if (questionType === 'multi') {
          const selectedOptions = localAnswer.selectedOptions || [];
          if (!selectedOptions.length) {
            showToast('Please select at least one option', 'warning');
            setSavingAnswer(false);
            return;
          }
          const saved = await persistQuestionAnswer(questionId, selectedOptions);
          if (saved) showToast('Answer saved successfully', 'success');
          else showToast('Could not save answer', 'error');
        } else {
          const selectedOption = localAnswer.selectedOption;
          if (selectedOption === undefined || selectedOption === null) {
            showToast('Please select an answer', 'warning');
            setSavingAnswer(false);
            return;
          }
          const saved = await persistQuestionAnswer(questionId, selectedOption);
          if (saved) showToast('Answer saved successfully', 'success');
          else showToast('Could not save answer', 'error');
        }
      } else if (question.type === 'theory') {
        const textAnswer = localAnswer.textAnswer || '';
        if (!textAnswer.trim()) {
          showToast('Please enter your answer', 'warning');
          setSavingAnswer(false);
          return;
        }
        const saved = await persistQuestionAnswer(questionId, textAnswer);
        if (saved) showToast('Answer saved successfully', 'success');
        else showToast('Could not save answer', 'error');
      } else if (question.type === 'sql') {
        const sqlAnswer = localAnswer.sql || '';
        const resultIdForApi = typeof result._id === 'object' && result._id?.toString ? result._id.toString() : String(result._id);
        const questionIdForApi = typeof questionId === 'object' && questionId?.toString ? questionId.toString() : String(questionId);
        await axiosInstance.post(`/results/${resultIdForApi}/answer`, {
          questionId: questionIdForApi,
          answer: sqlAnswer
        });
        showToast('Answer saved successfully', 'success');
        const updatedResult = await axiosInstance.get(`/results/${resultIdForApi}`);
        setResult(updatedResult.data);
      }
      setSavingAnswer(false);
    } catch (error) {
      setSavingAnswer(false);
      console.error('❌ Error submitting answer:', error);
      let errorMsg = error.response?.data?.message || error.response?.data?.error || error.message || 'Error saving answer';
      if (error.code === 'ECONNABORTED') {
        errorMsg = 'Request timed out while running tests. Check that the code-worker is running and matches the API.';
      }
      showToast(errorMsg, 'error');
    }
  };


  const navigateToQuestion = (sectionIdx, questionIdx) => {
    setCurrentSectionIndex(sectionIdx);
    setCurrentQuestionIndex(questionIdx);
    setTestCaseResults([]);
    setSubmissionSummary(null);
    setHiddenTestCaseResults([]);
    setCustomTestResult(null);
    setCustomTestCase({ input: '', expectedOutput: '' });
    setSqlRunResult(null);
  };

  const navigatePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    } else if (currentSectionIndex > 0) {
      setCurrentSectionIndex(currentSectionIndex - 1);
      setCurrentQuestionIndex(sections[currentSectionIndex - 1].questions.length - 1);
    }
    setTestCaseResults([]);
    setSubmissionSummary(null);
    setHiddenTestCaseResults([]);
    setCustomTestResult(null);
    setCustomTestCase({ input: '', expectedOutput: '' });
    setSqlRunResult(null);
  };

  const navigateNext = () => {
    const currentSection = sections[currentSectionIndex];
    if (currentQuestionIndex < currentSection.questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else if (currentSectionIndex < sections.length - 1) {
      setCurrentSectionIndex(currentSectionIndex + 1);
      setCurrentQuestionIndex(0);
    }
    setTestCaseResults([]);
    setSubmissionSummary(null);
    setHiddenTestCaseResults([]);
    setCustomTestResult(null);
    setCustomTestCase({ input: '', expectedOutput: '' });
    setSqlRunResult(null);
  };

  const isLastQuestion = () => {
    return currentSectionIndex === sections.length - 1 && 
           currentQuestionIndex === sections[currentSectionIndex].questions.length - 1;
  };

  const formatTime = (ms) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const isPreparing =
    pageLoading || (!loadError && (!test || !result || (test && result && sections.length === 0)));

  if (isPreparing) {
    return <TestTakingLoader message="Loading test…" />;
  }

  if (loadError) {
    return (
      <div className="test-taking-loader test-taking-loader--error">
        <h3>Could not start test</h3>
        <p>{loadError}</p>
        <div className="test-taking-loader-actions">
          <button type="button" className="btn btn-primary" onClick={() => fetchTest()}>
            Try again
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => navigate('/student/dashboard')}
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const currentQuestion = getCurrentQuestion();
  if (!currentQuestion?.questionId) {
    return <TestTakingLoader message="Loading question…" />;
  }

  const questionData = currentQuestion.questionId;
  const currentSection = sections[currentSectionIndex];

  const { totalQuestions, currentQuestionNumber } = questionProgress;

  // Get visible (sample) test cases
  const visibleTestCases = questionData.testCases?.filter(tc => !tc.isHidden) || [];
  const hiddenTestCasesCount = questionData.testCases?.filter(tc => tc.isHidden).length || 0;

  const showFullscreenGate = result && !fullscreenReady && !isFullscreen;
  const isCodingLayout = currentQuestion.type === 'coding';
  const showFooterSaveAnswer =
    !isCodingLayout &&
    ['mcq', 'aptitude', 'theory', 'sql'].includes(currentQuestion.type);

  return (
    <div
      className={`test-taking-container${isCodingLayout ? ' test-taking--coding' : ' test-taking--standard'}`}
    >
      {showFullscreenGate && (
        <ExamFullscreenPrompt
          title="Enter fullscreen to start the test"
          subtitle="Click below to maximize your screen and begin. This matches the secure start flow from the student portal."
          onEntered={async () => {
            await requestFullscreen();
            if (isDocumentFullscreen()) {
              setFullscreenReady(true);
              clearShareLinkAttempt();
            }
          }}
        />
      )}
      <ExamSecurityOverlay mode={securityOverlay} onReenterFullscreen={onReenterFullscreen} />
      <Modal 
        isOpen={modal.isOpen} 
        onClose={modal.title === 'Confirm Submission' ? () => {} : closeModal}
        title={modal.title}
        type={modal.type}
      >
        {modal.title === 'Confirm Submission' ? (
          <div>
            <p>{modal.message}</p>
            <div style={{ display: 'flex', gap: '10px', marginTop: '20px', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={closeModal}>Cancel</button>
              <button className="btn btn-primary" disabled={submitting} onClick={() => {
                closeModal();
                handleSubmitTest(true);
              }}>{submitting ? 'Submitting…' : 'Submit'}</button>
            </div>
          </div>
        ) : (
          <p>{modal.message}</p>
        )}
      </Modal>

      <header className="test-header">
        <div className="test-header-left">
          <div className="test-header-brand">
            <h2>{test.title}</h2>
            <span className="test-type-badge">{test.type}</span>
          </div>
          <span className="test-progress-pill">
            Question {currentQuestionNumber} of {totalQuestions}
          </span>
        </div>
        <div className="test-header-right">
          <span
            className={`test-violations-pill ${
              violations >= maxViolations - 1 ? 'is-danger' : violations >= 1 ? 'is-warn' : 'is-ok'
            }`}
          >
            Violations {violations}/{maxViolations}
          </span>
          <div className={`test-timer ${timeExpired ? 'is-expired' : ''}`}>
            <span className="test-timer-icon" aria-hidden>⏱</span>
            <span>{timeExpired ? 'Time up' : formatTime(timeRemaining)}</span>
          </div>
          {timeExpired && submitting && (
            <span className="test-time-hint">Submitting…</span>
          )}
          <button
            type="button"
            onClick={() => handleSubmitTest(false)}
            className="exam-btn exam-btn-outline-danger"
            disabled={submitting}
          >
            {submitting ? 'Submitting…' : 'Submit test'}
          </button>
        </div>
      </header>

      <div className="test-content">
        <aside className="question-sidebar">
          <div className="question-sidebar-head">
            <h3>Questions</h3>
            <span className="question-sidebar-count">{totalQuestions} total</span>
          </div>
          {sections.map((section, sectionIdx) => (
            <div key={sectionIdx} className="section-group">
              <div className="section-title">{section.title}</div>
              {section.questions.map((q, questionIdx) => {
                const status = getQuestionStatus(q.questionId._id, q.type);
                const isActive = currentSectionIndex === sectionIdx && currentQuestionIndex === questionIdx;
                return (
                  <button
                    key={questionIdx}
                    onClick={() => navigateToQuestion(sectionIdx, questionIdx)}
                    className={`question-nav-btn ${isActive ? 'active' : ''} ${status === 'attempted' ? 'attempted' : ''}`}
                    title={status === 'attempted' ? 'Answered' : 'Not answered'}
                  >
                    <span className="question-number">Q{questionIdx + 1}</span>
                    <span className="question-status-indicator">{status === 'attempted' ? '✓' : '○'}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </aside>

        <div className="main-content-wrapper">
          {currentQuestion.type === 'coding' ? (
            <>
              {/* Left Panel - Question Content */}
              <div className="question-panel coding-question-panel" style={{ width: `${leftPanelWidth}%` }}>
                <div className="question-panel-top">
                  <div className="question-header">
                    <h3>{currentSection.title} · Q{currentQuestionIndex + 1}</h3>
                    <span className={`difficulty-badge ${questionData.difficulty || 'medium'}`}>
                      {questionData.difficulty || 'Medium'}
                    </span>
                  </div>
                </div>

                <div className="question-panel-scroll">
                <div className="question-description">
                  <h4>{questionData.title}</h4>
                  <RichTextDisplay content={questionData.description} className="description-content" />
                  
                  {questionData.constraints && (
                    <div className="constraints-section">
                      <strong>Constraints:</strong>
                      <RichTextDisplay content={questionData.constraints} className="constraints-content" />
                    </div>
                  )}
                  

                  {/* Show Sample Test Cases */}
                  {visibleTestCases.length > 0 && (
                    <div className="test-cases-section">
                      <strong>Sample Test Cases:</strong>
                      <div className="test-cases-list">
                        {visibleTestCases.map((tc, idx) => (
                          <div key={idx} className={`test-case-box ${testCaseResults[idx] ? (testCaseResults[idx].passed ? 'test-case-passed' : 'test-case-failed') : ''}`}>
                            <div className="test-case-header">
                              <span>Test Case {idx + 1}</span>
                              {testCaseResults[idx] && (
                                <span className={`test-case-status ${testCaseResults[idx].passed ? 'passed' : 'failed'}`}>
                                  {testCaseResults[idx].passed ? '✓ Passed' : '✗ Failed'}
                                </span>
                              )}
                            </div>
                            <div className="test-case-content">
                              <div className="test-case-item">
                                <strong>Input:</strong>
                                <pre>{tc.input}</pre>
                              </div>
                              <div className="test-case-item">
                                <strong>Expected Output:</strong>
                                <pre>{tc.expectedOutput}</pre>
                              </div>
                              {testCaseResults[idx] && (
                                <>
                                  <div className="test-case-item">
                                    <strong>Your Output:</strong>
                                    <pre className={testCaseResults[idx].passed ? 'output-correct' : 'output-incorrect'}>
                                      {testCaseResults[idx].actualOutput || '(No output)'}
                                    </pre>
                                  </div>
                                  {testCaseResults[idx].error && (
                                    <div className="test-case-item error">
                                      <strong>Error:</strong>
                                      <pre>{testCaseResults[idx].error}</pre>
                                    </div>
                                  )}
                                  {testCaseResults[idx].executionTime > 0 && (
                                    <div className="test-case-item">
                                      <strong>Execution Time:</strong> {testCaseResults[idx].executionTime}ms
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                      {hiddenTestCasesCount > 0 && (
                        <div className="hidden-test-cases-note">
                          <span className="info-icon">ℹ️</span>
                          <span>{hiddenTestCasesCount} hidden test case(s) will be evaluated when you submit.</span>
                        </div>
                      )}
                    </div>
                  )}

                  <SubmissionSummaryPanel
                    summary={submissionSummary}
                    onDismiss={() => setSubmissionSummary(null)}
                  />

                  {/* Custom Test Case Section */}
                  <div className="custom-test-case-section">
                    <strong>Test Your Code:</strong>
                    <div className="custom-test-case-inputs">
                      <div className="custom-input-group">
                        <label>Input:</label>
                        <textarea
                          value={customTestCase.input}
                          onChange={(e) => setCustomTestCase({ ...customTestCase, input: e.target.value })}
                          placeholder="Enter test input..."
                          rows="2"
                          className="custom-test-input"
                        />
                      </div>
                      <div className="custom-input-group">
                        <label>Expected Output (optional):</label>
                        <textarea
                          value={customTestCase.expectedOutput}
                          onChange={(e) => setCustomTestCase({ ...customTestCase, expectedOutput: e.target.value })}
                          placeholder="Enter expected output (optional)..."
                          rows="2"
                          className="custom-test-input"
                        />
                      </div>
                      <button 
                        onClick={handleRunCustomTestCase} 
                        className="exam-btn exam-btn-secondary"
                        disabled={isRunningTests || !customTestCase.input.trim()}
                      >
                        {isRunningTests ? 'Running...' : '▶ Run Custom Test'}
                      </button>
                    </div>
                    {customTestResult && (
                      <div className={`custom-test-result ${customTestResult.passed ? 'passed' : 'failed'}`}>
                        <div className="custom-test-result-header">
                          <span>Custom Test Result</span>
                          <span className={`test-case-status ${customTestResult.passed ? 'passed' : 'failed'}`}>
                            {customTestResult.passed ? '✓ Passed' : '✗ Failed'}
                          </span>
                        </div>
                        <div className="custom-test-result-content">
                          <div><strong>Output:</strong> <pre>{customTestResult.actualOutput || '(No output)'}</pre></div>
                          {customTestResult.error && (
                            <div><strong>Error:</strong> <pre>{customTestResult.error}</pre></div>
                          )}
                          {customTestCase.expectedOutput && (
                            <div>
                              <strong>Expected:</strong> <pre>{customTestCase.expectedOutput}</pre>
                              {!customTestResult.passed && (
                                <div><strong>Got:</strong> <pre>{customTestResult.actualOutput || '(No output)'}</pre></div>
                              )}
                            </div>
                          )}
                          {customTestResult.executionTime > 0 && (
                            <div><strong>Execution Time:</strong> {customTestResult.executionTime}ms</div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                </div>
              </div>

              {/* Resizable Divider */}
              <div className="resizer" onMouseDown={handleResizeStart}></div>
              
              {/* Right Panel - Code Editor */}
              <div className="editor-panel coding-editor-panel" style={{ width: `${100 - leftPanelWidth}%` }}>
                <div className="editor-header coding-editor-toolbar">
                  <span className="editor-toolbar-title">Code editor</span>
                  <select 
                    value={selectedLanguage} 
                    onChange={(e) => handleLanguageChange(e.target.value)}
                    disabled={!questionData.allowedLanguages || questionData.allowedLanguages.length === 0}
                    className="language-select"
                  >
                    {questionData.allowedLanguages && questionData.allowedLanguages.length > 0 ? (
                      questionData.allowedLanguages.map(lang => (
                        <option key={lang} value={lang}>{lang.toUpperCase()}</option>
                      ))
                    ) : (
                      <option value="python">PYTHON</option>
                    )}
                  </select>
                  <div className="editor-actions">
                    <button 
                      onClick={handleRunCode} 
                      className="exam-btn exam-btn-run" 
                      disabled={isRunningTests || savingAnswer}
                    >
                      {isRunningTests ? 'Running...' : '▶ Run'}
                    </button>
                    <button 
                      onClick={handleSubmitAnswer} 
                      className="exam-btn exam-btn-primary" 
                      disabled={savingAnswer}
                    >
                      {savingAnswer ? 'Saving...' : '✓ Submit'}
                    </button>
                  </div>
                </div>
                <div className="editor-wrapper coding-editor-body">
                  <MonacoCodeEditor
                    editorKey={`${questionKey(questionData._id)}-${selectedLanguage}`}
                    language={selectedLanguage}
                    value={getCodingCode(answers, questionKey(questionData._id), selectedLanguage, questionData)}
                    onChange={handleCodeChange}
                  />
                </div>
              </div>
            </>
          ) : currentQuestion.type === 'theory' ? (
            <div className="question-panel full-width">
              <div className="question-header">
                <h3>{currentSection.title} - Question {currentQuestionIndex + 1}</h3>
                <div className="question-badges">
                  <span className={`difficulty-badge ${questionData.difficulty || 'medium'}`}>
                    {questionData.difficulty || 'Medium'}
                  </span>
                  {questionData.subjectId?.name && (
                    <span className="section-badge">{questionData.subjectId.name}</span>
                  )}
                  {questionData.topicId?.name && (
                    <span className="section-badge">{questionData.topicId.name}</span>
                  )}
                </div>
              </div>

              <div className="question-description">
                <RichTextDisplay content={questionData.questionText} className="question-rich-text" />
              </div>

              <div className="form-group">
                <label>Your Answer</label>
                <textarea
                  rows="8"
                  value={answerFor(answers, questionData._id).textAnswer || ''}
                  onChange={(e) => handleTheoryAnswerChange(e.target.value)}
                  placeholder="Type your detailed answer here..."
                />
                <div style={{ marginTop: '8px', fontSize: '0.85em', color: 'var(--text-secondary)' }}>
                  Word count: {(answerFor(answers, questionData._id).textAnswer || '').trim().split(/\s+/).filter(Boolean).length}
                  {questionData.expectedAnswerLength ? ` · Expected: ~${questionData.expectedAnswerLength} words` : ''}
                </div>
              </div>

              <div className="question-actions">
                <button type="button" onClick={handleSubmitAnswer} className="exam-btn exam-btn-primary" disabled={savingAnswer}>
                  {savingAnswer ? 'Saving...' : 'Save answer'}
                </button>
              </div>
            </div>
          ) : currentQuestion.type === 'aptitude' ? (
            <div className="question-panel full-width">
              <div className="question-header">
                <h3>{currentSection.title} - Question {currentQuestionIndex + 1}</h3>
                <div className="question-badges">
                  <span className={`difficulty-badge ${questionData.difficulty || 'medium'}`}>
                    {questionData.difficulty || 'Medium'}
                  </span>
                  <span className="section-badge">{questionData.section}</span>
                  {questionData.subCategory && (
                    <span className="section-badge">{questionData.subCategory}</span>
                  )}
                </div>
              </div>

              {questionData.caseStudy && (
                <div className="case-study-block">
                  <h4>Case Study</h4>
                  <RichTextDisplay content={questionData.caseStudy} className="question-rich-text" />
                </div>
              )}

              <div className="question-description">
                <RichTextDisplay content={questionData.question} className="question-rich-text" />
              </div>

              {questionData.questionType === 'numeric' ? (
                <div className="numeric-answer">
                  <label>Enter your answer:</label>
                  <input
                    type="number"
                    value={answerFor(answers, questionData._id).numericAnswer ?? ''}
                    onChange={(e) => handleAptitudeNumeric(e.target.value)}
                    className="numeric-input"
                  />
                  {questionData.numericTolerance > 0 && (
                    <p className="numeric-hint">Tolerance: ±{questionData.numericTolerance}</p>
                  )}
                </div>
              ) : (
                <div className="mcq-options">
                  {questionData.options && questionData.options.length > 0 ? (
                    questionData.options.map((option, index) => {
                      const isMulti = questionData.questionType === 'multi';
                      const aptAnswer = answerFor(answers, questionData._id);
                      const selectedMulti = aptAnswer.selectedOptions || [];
                      const isSelected = isMulti
                        ? selectedMulti.includes(index)
                        : aptAnswer.selectedOption === index;

                      return (
                        <label key={index} className={`mcq-option ${isSelected ? 'selected' : ''}`}>
                          <input
                            type={isMulti ? 'checkbox' : 'radio'}
                            name={`question-${questionData._id}`}
                            checked={isSelected}
                            onChange={() => {
                              if (isMulti) {
                                handleAptitudeMulti(index);
                              } else {
                                handleAptitudeSingle(index);
                              }
                            }}
                          />
                          <RichTextDisplay content={option.text} className="option-text" />
                        </label>
                      );
                    })
                  ) : (
                    <p>No options available for this question.</p>
                  )}
                </div>
              )}

              <div className="question-actions">
                <button type="button" onClick={handleSubmitAnswer} className="exam-btn exam-btn-primary" disabled={savingAnswer}>
                  {savingAnswer ? 'Saving...' : 'Save answer'}
                </button>
              </div>
            </div>
          ) : currentQuestion.type === 'sql' ? (
            <div className="sql-test-single-screen">
              <div className="sql-left-panel" style={{ width: `${leftPanelWidth}%` }}>
                <div className="sql-question-block">
                  <div className="sql-task-label">
                    <span className="sql-task-icon">📋</span>
                    <span>Query to write</span>
                    <span className="q-marks-badge">{questionData.marks} mark(s)</span>
                  </div>
                  <div className="sql-question-text-wrap">
                    <RichTextDisplay content={questionData.text} className="sql-question-text question-rich-text" />
                  </div>
                </div>
                {test.datasetTemplate && (
                  <div className="schema-panel schema-panel-compact">
                    <h4>Database schema</h4>
                    <SchemaView schemaSql={test.datasetTemplate.schemaSql} />
                  </div>
                )}
              </div>
              <div className="resizer" onMouseDown={handleResizeStart} />
              <div className="sql-right-panel" style={{ width: `${100 - leftPanelWidth}%` }}>
                <div className="sql-editor-block">
                  <div className="editor-header sql-editor-header">
                    <span className="editor-label">Your SQL</span>
                    <div className="editor-actions">
                      <button
                        onClick={handleRunSql}
                        className="exam-btn exam-btn-run"
                        disabled={isRunningSql || savingAnswer}
                      >
                        {isRunningSql ? 'Running...' : '▶ Run'}
                      </button>
                      <button
                        type="button"
                        onClick={handleSubmitAnswer}
                        className="exam-btn exam-btn-primary"
                        disabled={savingAnswer}
                      >
                        {savingAnswer ? 'Saving...' : 'Save answer'}
                      </button>
                    </div>
                  </div>
                  <div className="sql-editor-wrapper">
                    <MonacoCodeEditor
                      editorKey={`sql-${questionKey(questionData._id)}`}
                      language="sql"
                      value={answerFor(answers, questionData._id).sql ?? ''}
                      onChange={handleSqlChange}
                      options={{ fontSize: 13 }}
                    />
                  </div>
                </div>
                <div className="sql-result-block">
                  <div className={`sql-output-panel ${sqlRunResult ? (sqlRunResult.success ? (sqlRunResult.isCorrect ? 'match' : 'no-match') : 'error') : isRunningSql ? 'loading' : 'empty'}`}>
                    {/* Clear correct / incorrect feedback banner */}
                    {sqlRunResult?.success && sqlRunResult.isCorrect && (
                      <div className="sql-feedback-banner sql-feedback-correct">
                        <span className="sql-feedback-icon">✓</span>
                        <div>
                          <strong>Correct!</strong> Your output matches the expected result. Answer saved automatically.
                        </div>
                      </div>
                    )}
                    {sqlRunResult?.success && !sqlRunResult.isCorrect && (
                      <div className="sql-feedback-banner sql-feedback-incorrect">
                        <span className="sql-feedback-icon">✗</span>
                        <div>
                          <strong>Output does not match expected.</strong> Modify your query and run again to get the correct result.
                        </div>
                      </div>
                    )}
                    <div className="sql-output-header">
                      <h4>Your query result</h4>
                      {sqlRunResult?.success && (
                        <span className={`sql-result-badge ${sqlRunResult.isCorrect ? 'match' : 'no-match'}`}>
                          {sqlRunResult.isCorrect ? '✓ Matching' : '✗ Not matching'}
                        </span>
                      )}
                      {sqlRunResult && !sqlRunResult.success && (
                        <span className="sql-result-badge error">✗ Error</span>
                      )}
                      {sqlRunResult?.runCount != null && (
                        <span className="sql-run-count">Runs: {sqlRunResult.runCount}/{sqlRunResult.maxRuns}</span>
                      )}
                    </div>
                    {isRunningSql ? (
                      <p className="sql-loading">Running query...</p>
                    ) : sqlRunResult?.success ? (
                      sqlRunResult.rows && sqlRunResult.rows.length > 0 ? (
                        <div className="sql-result-table-wrap">
                          <table className="sql-result-table">
                            <thead>
                              <tr>
                                {Object.keys(sqlRunResult.rows[0]).map((k) => (
                                  <th key={k}>{k}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {sqlRunResult.rows.map((row, i) => (
                                <tr key={i}>
                                  {Object.values(row).map((val, j) => (
                                    <td key={j}>{val != null ? String(val) : 'NULL'}</td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p className="sql-no-rows">Query returned no rows.</p>
                      )
                    ) : sqlRunResult ? (
                      <pre className="sql-error">{sqlRunResult.error || 'Unknown error'}</pre>
                    ) : (
                      <p className="sql-placeholder">Click <strong>Run</strong> to see your query result here.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="question-panel full-width">
              <div className="question-header">
                <h3>{currentSection.title} - Question {currentQuestionIndex + 1}</h3>
              </div>
              <div className="question-description">
                <RichTextDisplay content={questionData.question} className="question-rich-text" />
              </div>
              <div className="mcq-options">
                {questionData.options && questionData.options.length > 0 ? (
                  questionData.options.map((option, index) => (
                    <label key={index} className={`mcq-option ${answerFor(answers, questionData._id).selectedOption === index ? 'selected' : ''}`}>
                      <input
                        type="radio"
                        name={`question-${questionKey(questionData._id)}`}
                        checked={answerFor(answers, questionData._id).selectedOption === index}
                        onChange={() => handleMCQAnswer(index)}
                      />
                      <RichTextDisplay content={option.text} className="option-text" />
                    </label>
                  ))
                ) : (
                  <p>No options available for this question.</p>
                )}
              </div>
              <div className="question-actions">
                <button type="button" onClick={handleSubmitAnswer} className="exam-btn exam-btn-primary" disabled={savingAnswer}>
                  {savingAnswer ? 'Saving...' : 'Save answer'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <footer className="test-footer">
        <div className="footer-progress">
          <span>
            {currentSection.title} · Q{currentQuestionIndex + 1}/
            {currentSection.questions.length}
          </span>
          <div className="footer-progress-bar">
            <div
              className="footer-progress-fill"
              style={{ width: `${(currentQuestionNumber / totalQuestions) * 100}%` }}
            />
          </div>
        </div>
        <div className="footer-actions">
          {(currentQuestionIndex > 0 || currentSectionIndex > 0) && (
            <button type="button" onClick={navigatePrevious} className="exam-btn exam-btn-secondary">
              ← Previous
            </button>
          )}
          {showFooterSaveAnswer && (
            <button
              type="button"
              onClick={handleSubmitAnswer}
              className="exam-btn exam-btn-primary"
              disabled={savingAnswer}
            >
              {savingAnswer ? 'Saving…' : 'Save answer'}
            </button>
          )}
          {!isLastQuestion() ? (
            <button type="button" onClick={navigateNext} className="exam-btn exam-btn-primary">
              Next →
            </button>
          ) : (
            <button
              type="button"
              onClick={() => handleSubmitTest(false)}
              className="exam-btn exam-btn-submit-final"
              disabled={submitting}
            >
              {submitting ? 'Submitting…' : 'Submit test'}
            </button>
          )}
        </div>
      </footer>
    </div>
  );
};

export default TestTaking;
