import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import axiosInstance from '../../utils/axios';
import Modal from '../../components/Modal';
import { useExamSecurity } from '../../hooks/useExamSecurity';
import { parseSchemaSql } from '../../utils/schemaParser';
import './TestTaking.css';

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

const TestTaking = () => {
  const { testId } = useParams();
  const navigate = useNavigate();
  const [test, setTest] = useState(null);
  const [result, setResult] = useState(null);
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [loading, setLoading] = useState(true);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [timeExpired, setTimeExpired] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState('python');
  
  // Modal states
  const [modal, setModal] = useState({ isOpen: false, title: '', message: '', type: 'info' });
  
  // Exam security - initialize after result is loaded
  const handleMaxViolations = async () => {
    showModal('Auto-Submission', `You have reached the maximum number of violations. Your test will be automatically submitted.`, 'error');
    setTimeout(async () => {
      await handleSubmitTest();
    }, 2000);
  };
  
  const handleViolationWarning = (currentViolations, maxViolations) => {
    showModal(
      'Violation Warning', 
      `Warning: You have ${currentViolations} violation(s). After ${maxViolations} violations, your test will be automatically submitted. Please follow the exam rules.`, 
      'warning'
    );
  };
  
  const { violations } = useExamSecurity(
    result?._id || null,
    handleMaxViolations,
    handleViolationWarning
  );
  const [codeExecutionResult, setCodeExecutionResult] = useState(null);
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
  
  // Organize questions into sections
  const [sections, setSections] = useState([]);

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

  const handleSubmitTest = async (skipConfirmation = false) => {
    if (!result) {
      showModal('Error', 'Test session not found', 'error');
      return;
    }
    
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
      setLoading(true);
      console.log('📤 Submitting test:', result._id);
      await axiosInstance.post(`/results/${result._id}/submit`);
      console.log('✅ Test submitted successfully');
      navigate(`/student/result/${result._id}`);
    } catch (error) {
      setLoading(false);
      console.error('❌ Error submitting test:', error);
      const errorMsg = error.response?.data?.message || error.response?.data?.error || error.message || 'Error submitting test';
      showModal('Error', errorMsg, 'error');
    }
  };

  useEffect(() => {
    if (result && result.status === 'in_progress' && test) {
      const duration = test.duration * 60 * 1000;
      const elapsed = Date.now() - new Date(result.startedAt).getTime();
      const remaining = Math.max(0, duration - elapsed);
      setTimeRemaining(remaining);
      
      // Check if time already expired
      if (remaining <= 0) {
        setTimeExpired(true);
      }

      const timer = setInterval(() => {
        setTimeRemaining(prev => {
          const newTime = prev - 1000;
          if (newTime <= 0 && !timeExpired) {
            setTimeExpired(true);
            // Don't auto-submit, just mark as expired
            // User can still continue but will see time expired message
            return 0;
          }
          return Math.max(0, newTime);
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [result, test, timeExpired]);

  // Organize questions into sections
  useEffect(() => {
    if (test && test.questions) {
      const codingQuestions = test.questions.filter(q => q.type === 'coding');
      const mcqQuestions = test.questions.filter(q => q.type === 'mcq');
      const aptitudeQuestions = test.questions.filter(q => q.type === 'aptitude');
      const theoryQuestions = test.questions.filter(q => q.type === 'theory');
      const sqlQuestions = test.questions.filter(q => q.type === 'sql');
      
      const newSections = [];
      if (codingQuestions.length > 0) {
        newSections.push({
          type: 'coding',
          title: 'Section 1: Coding Questions',
          questions: codingQuestions
        });
      }
      if (mcqQuestions.length > 0) {
        newSections.push({
          type: 'mcq',
          title: 'Section 2: MCQ Questions',
          questions: mcqQuestions
        });
      }
      if (aptitudeQuestions.length > 0) {
        newSections.push({
          type: 'aptitude',
          title: `Section ${newSections.length + 1}: Aptitude Questions`,
          questions: aptitudeQuestions
        });
      }
      if (theoryQuestions.length > 0) {
        newSections.push({
          type: 'theory',
          title: `Section ${newSections.length + 1}: Theory Questions`,
          questions: theoryQuestions
        });
      }
      if (sqlQuestions.length > 0) {
        newSections.push({
          type: 'sql',
          title: `Section ${newSections.length + 1}: SQL Questions`,
          questions: sqlQuestions
        });
      }
      setSections(newSections);
    }
  }, [test]);

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
    setCodeExecutionResult(null);
    setSubmissionSummary(null);
  };

  const fetchTest = async () => {
    try {
      setLoading(true);
      console.log('📥 Fetching test:', testId);
      
      const testRes = await axiosInstance.get(`/tests/${testId}`);
      console.log('✅ Test fetched:', testRes.data);
      
      if (!testRes.data || !testRes.data.questions || testRes.data.questions.length === 0) {
        showModal('Error', 'Test has no questions. Please contact your instructor.', 'error');
        setTimeout(() => navigate('/student/dashboard'), 2000);
        return;
      }

      setTest(testRes.data);

      // Start test
      console.log('🚀 Starting test...');
      const resultRes = await axiosInstance.post(`/results/start/${testId}`);
      console.log('✅ Test started:', resultRes.data);
      
      setResult(resultRes.data);
      
      // Initialize answers with starter code for coding questions and previous answers if continuing
      const initialAnswers = {};
      testRes.data.questions.forEach((q) => {
        const existingAnswer = resultRes.data.answers.find(a => a.questionId.toString() === q.questionId._id.toString());
        
        if (q.type === 'coding') {
          const defaultLang = q.questionId.allowedLanguages?.[0] || 'python';
          initialAnswers[q.questionId._id] = {
            code: existingAnswer?.answer || q.questionId.starterCode?.[defaultLang] || '',
            attempted: !!existingAnswer?.answer
          };
        } else if (q.type === 'mcq') {
          initialAnswers[q.questionId._id] = {
            selectedOption: existingAnswer?.answer !== undefined ? existingAnswer.answer : null,
            attempted: existingAnswer?.answer !== undefined
          };
        } else if (q.type === 'aptitude') {
          const questionType = q.questionId.questionType;
          if (questionType === 'numeric') {
            const numericValue = existingAnswer?.answer !== undefined ? existingAnswer.answer : '';
            initialAnswers[q.questionId._id] = {
              numericAnswer: numericValue,
              attempted: numericValue !== '' && numericValue !== null && numericValue !== undefined
            };
          } else if (questionType === 'multi') {
            const selectedOptions = Array.isArray(existingAnswer?.answer) ? existingAnswer.answer : [];
            initialAnswers[q.questionId._id] = {
              selectedOptions,
              attempted: selectedOptions.length > 0
            };
          } else {
            initialAnswers[q.questionId._id] = {
              selectedOption: existingAnswer?.answer !== undefined ? existingAnswer.answer : null,
              attempted: existingAnswer?.answer !== undefined
            };
          }
        } else if (q.type === 'theory') {
          const theoryAnswer = existingAnswer?.answer || '';
          initialAnswers[q.questionId._id] = {
            textAnswer: theoryAnswer,
            attempted: theoryAnswer.trim().length > 0
          };
        } else if (q.type === 'sql') {
          const sqlAnswer = existingAnswer?.answer || '';
          initialAnswers[q.questionId._id] = {
            sql: sqlAnswer,
            attempted: sqlAnswer.trim().length > 0
          };
        }
      });
      setAnswers(initialAnswers);
      
      // Set default language for first coding question
      const firstQuestion = testRes.data.questions.find(q => q.type === 'coding');
      if (firstQuestion && firstQuestion.questionId?.allowedLanguages) {
        setSelectedLanguage(firstQuestion.questionId.allowedLanguages[0] || 'python');
      }
      
      setLoading(false);
    } catch (error) {
      console.error('❌ Error fetching/starting test:', error);
      const errorMsg = error.response?.data?.message || 'Error loading test. Please try again.';
      showModal('Error', errorMsg, 'error');
      setTimeout(() => navigate('/student/dashboard'), 2000);
      setLoading(false);
    }
  };

  const getCurrentQuestion = () => {
    if (!sections.length || currentSectionIndex >= sections.length) return null;
    const section = sections[currentSectionIndex];
    if (currentQuestionIndex >= section.questions.length) return null;
    return section.questions[currentQuestionIndex];
  };

  const getQuestionStatus = (questionId) => {
    if (!result || !result.answers) return 'not-attempted';
    const answer = result.answers.find(a => a.questionId.toString() === questionId.toString());
    if (!answer || answer.answer === undefined || answer.answer === null) return 'not-attempted';
    if (Array.isArray(answer.answer)) {
      return answer.answer.length > 0 ? 'attempted' : 'not-attempted';
    }
    if (typeof answer.answer === 'string' && answer.answer.trim() === '') {
      return 'not-attempted';
    }
    return 'attempted';
  };

  const handleLanguageChange = (newLanguage) => {
    const question = getCurrentQuestion();
    if (!question || !question.questionId || question.type !== 'coding') return;
    
    const questionId = question.questionId._id;
    const starterCode = question.questionId.starterCode?.[newLanguage] || '';
    
    // Always update to new starter code when language changes
    // This ensures boilerplate code changes properly
    setSelectedLanguage(newLanguage);
    setAnswers({
      ...answers,
      [questionId]: {
        ...answers[questionId],
        code: starterCode || ''
      }
    });
    // Clear test case results when language changes
    setTestCaseResults([]);
    setCustomTestResult(null);
  };

  const handleCodeChange = (value) => {
    const question = getCurrentQuestion();
    if (!question || !question.questionId) return;
    
    setAnswers({
      ...answers,
      [question.questionId._id]: {
        ...answers[question.questionId._id],
        code: value || '',
        attempted: (value || '').trim().length > 0
      }
    });
    // Clear test case results when code changes
    setTestCaseResults([]);
    setCustomTestResult(null);
  };

  const handleMCQAnswer = (optionIndex) => {
    const question = getCurrentQuestion();
    if (!question || !question.questionId) return;
    
    setAnswers({
      ...answers,
      [question.questionId._id]: {
        ...answers[question.questionId._id],
        selectedOption: optionIndex,
        attempted: true
      }
    });
  };

  const handleAptitudeSingle = (optionIndex) => {
    const question = getCurrentQuestion();
    if (!question || !question.questionId) return;
    setAnswers({
      ...answers,
      [question.questionId._id]: {
        ...answers[question.questionId._id],
        selectedOption: optionIndex,
        attempted: true
      }
    });
  };

  const handleAptitudeMulti = (optionIndex) => {
    const question = getCurrentQuestion();
    if (!question || !question.questionId) return;
    const current = answers[question.questionId._id]?.selectedOptions || [];
    const exists = current.includes(optionIndex);
    const updated = exists
      ? current.filter(idx => idx !== optionIndex)
      : [...current, optionIndex];
    setAnswers({
      ...answers,
      [question.questionId._id]: {
        ...answers[question.questionId._id],
        selectedOptions: updated,
        attempted: updated.length > 0
      }
    });
  };

  const handleAptitudeNumeric = (value) => {
    const question = getCurrentQuestion();
    if (!question || !question.questionId) return;
    setAnswers({
      ...answers,
      [question.questionId._id]: {
        ...answers[question.questionId._id],
        numericAnswer: value,
        attempted: value !== '' && value !== null && value !== undefined
      }
    });
  };

  const handleTheoryAnswerChange = (value) => {
    const question = getCurrentQuestion();
    if (!question || !question.questionId) return;
    setAnswers({
      ...answers,
      [question.questionId._id]: {
        ...answers[question.questionId._id],
        textAnswer: value,
        attempted: value.trim().length > 0
      }
    });
  };

  const handleSqlChange = (value) => {
    const question = getCurrentQuestion();
    if (!question || !question.questionId) return;
    setAnswers({
      ...answers,
      [question.questionId._id]: {
        ...answers[question.questionId._id],
        sql: value || '',
        attempted: (value || '').trim().length > 0
      }
    });
  };

  const handleRunSql = async () => {
    const question = getCurrentQuestion();
    if (!question || !question.questionId || !result) return;
    const query = answers[question.questionId._id]?.sql || '';
    if (!query.trim()) {
      showModal('Warning', 'Please enter a SQL query first', 'warning');
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
          showModal('Answer saved', 'Correct! Your answer was saved automatically.', 'success');
        } catch (saveErr) {
          console.error('Auto-save SQL answer failed:', saveErr);
          showModal('Save failed', 'Your answer was correct but could not be saved automatically. Please click Save Answer.', 'warning');
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
      showModal('Error', 'Question not loaded', 'error');
      return;
    }
    
    const code = answers[question.questionId._id]?.code || question.questionId.starterCode?.[selectedLanguage] || '';

    if (!code.trim()) {
      showModal('Warning', 'Please write some code first', 'warning');
      return;
    }

    if (!customTestCase.input.trim()) {
      showModal('Warning', 'Please provide input for the test case', 'warning');
      return;
    }

    try {
      setIsRunningTests(true);
      const response = await axiosInstance.post('/code-execution/execute', {
        code,
        language: selectedLanguage,
        input: customTestCase.input
      });

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
      const errorMsg = error.response?.data?.error || error.message || 'Error executing code';
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
      showModal('Error', 'Question not loaded', 'error');
      return;
    }
    
    const code = answers[question.questionId._id]?.code || question.questionId.starterCode?.[selectedLanguage] || '';

    if (!code.trim()) {
      showModal('Warning', 'Please write some code first', 'warning');
      return;
    }

    try {
      setIsRunningTests(true);
      setTestCaseResults([]);
      
      const questionData = question.questionId;
      const visibleTestCases = questionData.testCases?.filter(tc => !tc.isHidden) || [];
      
      if (visibleTestCases.length === 0) {
        showModal('Info', 'No sample test cases available for this question.', 'info');
        setIsRunningTests(false);
        return;
      }

      const response = await axiosInstance.post('/code-execution/execute-batch', {
        code,
        language: selectedLanguage,
        testCases: visibleTestCases.map(tc => ({ input: tc.input, expectedOutput: tc.expectedOutput }))
      });

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
        showModal('All Test Cases Passed!', `All ${totalCount} sample test case(s) passed!`, 'success');
      } else {
        showModal('Some Test Cases Failed', `${passedCount} out of ${totalCount} sample test case(s) passed.`, 'warning');
      }
    } catch (error) {
      setIsRunningTests(false);
      console.error('Error executing code:', error);
      const errorMsg = error.response?.data?.error || 
                      error.response?.data?.message || 
                      error.message || 
                      'Error executing code. Please check your code and try again.';
      showModal('Code Execution Error', errorMsg, 'error');
    }
  };

  const handleSubmitAnswer = async () => {
    const question = getCurrentQuestion();
    if (!question || !question.questionId || !result) {
      showModal('Error', 'Test data not loaded', 'error');
      return;
    }
    
    const questionId = question.questionId._id;

    try {
      setLoading(true);
      if (question.type === 'coding') {
        const code = answers[questionId]?.code || '';
        
        if (!code.trim()) {
          showModal('Warning', 'Please write some code before saving', 'warning');
          setLoading(false);
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
        });

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
        
        showModal('Answer Saved', '', 'success');
        
        // Refresh result to get updated answers
        const updatedResult = await axiosInstance.get(`/results/${result._id}`);
        setResult(updatedResult.data);
      } else if (question.type === 'mcq') {
        if (answers[questionId]?.selectedOption === undefined || answers[questionId]?.selectedOption === null) {
          showModal('Warning', 'Please select an answer', 'warning');
          setLoading(false);
          return;
        }

        await axiosInstance.post(`/results/${result._id}/answer`, {
          questionId,
          answer: answers[questionId]?.selectedOption
        });

        showModal('Success', 'Answer saved successfully!', 'success');
        const updatedResult = await axiosInstance.get(`/results/${result._id}`);
        setResult(updatedResult.data);
      } else if (question.type === 'aptitude') {
        const questionType = question.questionId.questionType;
        if (questionType === 'numeric') {
          const numericValue = answers[questionId]?.numericAnswer;
          if (numericValue === '' || numericValue === null || numericValue === undefined) {
            showModal('Warning', 'Please enter a numeric answer', 'warning');
            setLoading(false);
            return;
          }
          await axiosInstance.post(`/results/${result._id}/answer`, {
            questionId,
            answer: numericValue
          });
        } else if (questionType === 'multi') {
          const selectedOptions = answers[questionId]?.selectedOptions || [];
          if (!selectedOptions.length) {
            showModal('Warning', 'Please select at least one option', 'warning');
            setLoading(false);
            return;
          }
          await axiosInstance.post(`/results/${result._id}/answer`, {
            questionId,
            answer: selectedOptions
          });
        } else {
          const selectedOption = answers[questionId]?.selectedOption;
          if (selectedOption === undefined || selectedOption === null) {
            showModal('Warning', 'Please select an answer', 'warning');
            setLoading(false);
            return;
          }
          await axiosInstance.post(`/results/${result._id}/answer`, {
            questionId,
            answer: selectedOption
          });
        }

        showModal('Success', 'Answer saved successfully!', 'success');
        const updatedResult = await axiosInstance.get(`/results/${result._id}`);
        setResult(updatedResult.data);
      } else if (question.type === 'theory') {
        const textAnswer = answers[questionId]?.textAnswer || '';
        if (!textAnswer.trim()) {
          showModal('Warning', 'Please enter your answer', 'warning');
          setLoading(false);
          return;
        }
        await axiosInstance.post(`/results/${result._id}/answer`, {
          questionId,
          answer: textAnswer
        });
        showModal('Success', 'Answer saved successfully!', 'success');
        const updatedResult = await axiosInstance.get(`/results/${result._id}`);
        setResult(updatedResult.data);
      } else if (question.type === 'sql') {
        const sqlAnswer = answers[questionId]?.sql || '';
        const resultIdForApi = typeof result._id === 'object' && result._id?.toString ? result._id.toString() : String(result._id);
        const questionIdForApi = typeof questionId === 'object' && questionId?.toString ? questionId.toString() : String(questionId);
        await axiosInstance.post(`/results/${resultIdForApi}/answer`, {
          questionId: questionIdForApi,
          answer: sqlAnswer
        });
        showModal('Success', 'Answer saved successfully!', 'success');
        const updatedResult = await axiosInstance.get(`/results/${resultIdForApi}`);
        setResult(updatedResult.data);
      }
      setLoading(false);
    } catch (error) {
      setLoading(false);
      console.error('❌ Error submitting answer:', error);
      const errorMsg = error.response?.data?.message || error.response?.data?.error || error.message || 'Error saving answer';
      showModal('Error', errorMsg, 'error');
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

  if (loading && !test) {
    return <div className="loading">Loading test...</div>;
  }

  if (!test || !result) {
    return (
      <div className="container">
        <div className="error" style={{ padding: '20px', textAlign: 'center' }}>
          <h3>Error Loading Test</h3>
          <p>Unable to load the test. Please try again.</p>
          <button onClick={() => navigate('/student/dashboard')} className="btn btn-primary">
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!sections.length) {
    return (
      <div className="container">
        <div className="error" style={{ padding: '20px', textAlign: 'center' }}>
          <h3>No Questions Available</h3>
          <p>This test has no questions assigned.</p>
          <button onClick={() => navigate('/student/dashboard')} className="btn btn-primary">
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const currentQuestion = getCurrentQuestion();
  if (!currentQuestion || !currentQuestion.questionId) {
    return (
      <div className="container">
        <div className="error" style={{ padding: '20px', textAlign: 'center' }}>
          <h3>Error Loading Question</h3>
          <p>Unable to load question data.</p>
          <button onClick={() => navigate('/student/dashboard')} className="btn btn-primary">
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const questionData = currentQuestion.questionId;
  const currentSection = sections[currentSectionIndex];
  
  // Get visible (sample) test cases
  const visibleTestCases = questionData.testCases?.filter(tc => !tc.isHidden) || [];
  const hiddenTestCasesCount = questionData.testCases?.filter(tc => tc.isHidden).length || 0;

  return (
    <div className="test-taking-container">
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
              <button className="btn btn-primary" onClick={() => {
                closeModal();
                handleSubmitTest(true);
              }}>Submit</button>
            </div>
          </div>
        ) : submissionSummary ? (
          <div className="submission-summary">
            <h3>Test Case Results</h3>
            
            {/* Visible Test Cases */}
            {submissionSummary.visibleResults.length > 0 && (
              <div className="test-case-group">
                <h4>Sample Test Cases ({submissionSummary.visiblePassed}/{submissionSummary.visibleTotal} passed)</h4>
                <div className="test-case-results-list">
                  {submissionSummary.visibleResults.map((result, idx) => (
                    <div key={idx} className={`test-case-result-item ${result.passed ? 'passed' : 'failed'}`}>
                      <div className="test-case-result-header">
                        <span>Test Case {result.testCaseIndex}</span>
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

            {/* Hidden Test Cases */}
            {submissionSummary.hiddenResults.length > 0 && (
              <div className="test-case-group">
                <h4>Hidden Test Cases ({submissionSummary.hiddenPassed}/{submissionSummary.hiddenTotal} passed)</h4>
                <div className="test-case-results-list">
                  {submissionSummary.hiddenResults.map((result, idx) => (
                    <div key={idx} className={`test-case-result-item ${result.passed ? 'passed' : 'failed'}`}>
                      <div className="test-case-result-header">
                        <span>Hidden Test Case {result.testCaseIndex}</span>
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
              <strong>Total: {submissionSummary.totalPassed} / {submissionSummary.totalTestCases} test cases passed</strong>
            </div>
            <p style={{ marginTop: '15px', fontSize: '0.9em', color: '#666' }}>
              Answer saved successfully!
            </p>
          </div>
        ) : codeExecutionResult ? (
          <div>
            {codeExecutionResult.success ? (
              <div className="success-output">
                <strong>Output:</strong>
                <pre>{codeExecutionResult.output || '(No output)'}</pre>
                {codeExecutionResult.executionTime > 0 && (
                  <p>Execution time: {codeExecutionResult.executionTime}ms</p>
                )}
              </div>
            ) : (
              <div className="error-output">
                <strong>Error:</strong>
                <pre>{codeExecutionResult.error || 'Unknown error'}</pre>
              </div>
            )}
          </div>
        ) : (
          <p>{modal.message}</p>
        )}
      </Modal>

      <div className="test-header">
        <div className="test-header-left">
          <h2>{test.title}</h2>
          <span className="test-type-badge">{test.type}</span>
        </div>
        <div className="test-header-right">
          <div className="violations-indicator" style={{ 
            marginRight: '15px', 
            padding: '8px 15px', 
            background: violations >= 2 ? '#ff4444' : violations >= 1 ? '#ffaa00' : '#4CAF50',
            color: 'white',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: 'bold'
          }}>
            Violations: {violations}/3
          </div>
          <div className={`timer ${timeExpired ? 'timer-expired' : ''}`}>
            <span className="timer-icon">⏱️</span>
            <span>{timeExpired ? 'Time Expired' : formatTime(timeRemaining)}</span>
          </div>
          {timeExpired && (
            <div style={{ 
              padding: '8px 15px', 
              background: '#ff9800', 
              color: 'white', 
              borderRadius: '8px',
              fontSize: '12px',
              marginRight: '10px'
            }}>
              You can still attempt, but time is up
            </div>
          )}
          <button 
            onClick={() => handleSubmitTest(false)} 
            className="btn btn-danger btn-sm"
          >
            Submit Test
          </button>
        </div>
      </div>

      <div className="test-content">
        <div className="question-sidebar">
          <h3>Questions</h3>
          {sections.map((section, sectionIdx) => (
            <div key={sectionIdx} className="section-group">
              <div className="section-title">{section.title}</div>
              {section.questions.map((q, questionIdx) => {
                const status = getQuestionStatus(q.questionId._id);
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
        </div>

        <div className="main-content-wrapper">
          {currentQuestion.type === 'coding' ? (
            <>
              {/* Left Panel - Question Content */}
              <div className="question-panel" style={{ width: `${leftPanelWidth}%` }}>
                <div className="question-header">
                  <h3>{currentSection.title} - Question {currentQuestionIndex + 1}</h3>
                  <span className={`difficulty-badge ${questionData.difficulty || 'medium'}`}>
                    {questionData.difficulty || 'Medium'}
                  </span>
                </div>

                <div className="question-description">
                  <h4>{questionData.title}</h4>
                  <div className="description-content" dangerouslySetInnerHTML={{ __html: questionData.description.replace(/\n/g, '<br />') }} />
                  
                  {questionData.constraints && (
                    <div className="constraints-section">
                      <strong>Constraints:</strong>
                      <div className="constraints-content" dangerouslySetInnerHTML={{ __html: questionData.constraints.replace(/\n/g, '<br />') }} />
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
                          rows="3"
                          className="custom-test-input"
                        />
                      </div>
                      <div className="custom-input-group">
                        <label>Expected Output (optional):</label>
                        <textarea
                          value={customTestCase.expectedOutput}
                          onChange={(e) => setCustomTestCase({ ...customTestCase, expectedOutput: e.target.value })}
                          placeholder="Enter expected output (optional)..."
                          rows="3"
                          className="custom-test-input"
                        />
                      </div>
                      <button 
                        onClick={handleRunCustomTestCase} 
                        className="btn btn-secondary btn-sm"
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

              {/* Resizable Divider */}
              <div className="resizer" onMouseDown={handleResizeStart}></div>
              
              {/* Right Panel - Code Editor */}
              <div className="editor-panel" style={{ width: `${100 - leftPanelWidth}%` }}>
                <div className="editor-header">
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
                      className="btn btn-secondary btn-run" 
                      disabled={isRunningTests || loading}
                    >
                      {isRunningTests ? 'Running...' : '▶ Run'}
                    </button>
                    <button 
                      onClick={handleSubmitAnswer} 
                      className="btn btn-primary btn-submit" 
                      disabled={loading}
                    >
                      {loading ? 'Saving...' : '✓ Submit'}
                    </button>
                  </div>
                </div>
                <div className="editor-wrapper">
                  <Editor
                    height="calc(100vh - 200px)"
                    language={selectedLanguage}
                    value={answers[questionData._id]?.code || questionData.starterCode?.[selectedLanguage] || ''}
                    onChange={handleCodeChange}
                    theme={localStorage.getItem('theme') === 'dark' ? 'vs-dark' : 'light'}
                    options={{
                      minimap: { enabled: false },
                      fontSize: 14,
                      wordWrap: 'on',
                      lineNumbers: 'on',
                      scrollBeyondLastLine: false,
                      automaticLayout: true,
                      tabSize: 2
                    }}
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
                <h4>{questionData.questionText}</h4>
              </div>

              <div className="form-group">
                <label>Your Answer</label>
                <textarea
                  rows="8"
                  value={answers[questionData._id]?.textAnswer || ''}
                  onChange={(e) => handleTheoryAnswerChange(e.target.value)}
                  placeholder="Type your detailed answer here..."
                />
                <div style={{ marginTop: '8px', fontSize: '0.85em', color: 'var(--text-secondary)' }}>
                  Word count: {(answers[questionData._id]?.textAnswer || '').trim().split(/\s+/).filter(Boolean).length}
                  {questionData.expectedAnswerLength ? ` · Expected: ~${questionData.expectedAnswerLength} words` : ''}
                </div>
              </div>

              <div className="question-actions">
                <button onClick={handleSubmitAnswer} className="btn btn-primary" disabled={loading}>
                  {loading ? 'Saving...' : 'Save Answer'}
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
                  <p>{questionData.caseStudy}</p>
                </div>
              )}

              <div className="question-description">
                <h4>{questionData.question}</h4>
              </div>

              {questionData.questionType === 'numeric' ? (
                <div className="numeric-answer">
                  <label>Enter your answer:</label>
                  <input
                    type="number"
                    value={answers[questionData._id]?.numericAnswer ?? ''}
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
                      const selectedMulti = answers[questionData._id]?.selectedOptions || [];
                      const isSelected = isMulti
                        ? selectedMulti.includes(index)
                        : answers[questionData._id]?.selectedOption === index;

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
                          <span className="option-text">{option.text}</span>
                        </label>
                      );
                    })
                  ) : (
                    <p>No options available for this question.</p>
                  )}
                </div>
              )}

              <div className="question-actions">
                <button onClick={handleSubmitAnswer} className="btn btn-primary" disabled={loading}>
                  {loading ? 'Saving...' : 'Save Answer'}
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
                    <p className="sql-question-text">{questionData.text}</p>
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
                        className="btn btn-secondary btn-run"
                        disabled={isRunningSql || loading}
                      >
                        {isRunningSql ? 'Running...' : '▶ Run'}
                      </button>
                      <button
                        onClick={handleSubmitAnswer}
                        className="btn btn-primary btn-submit"
                        disabled={loading}
                      >
                        {loading ? 'Saving...' : 'Save Answer'}
                      </button>
                    </div>
                  </div>
                  <div className="sql-editor-wrapper">
                    <Editor
                      height="100%"
                      language="sql"
                      value={answers[questionData._id]?.sql || ''}
                      onChange={handleSqlChange}
                      theme={localStorage.getItem('theme') === 'dark' ? 'vs-dark' : 'light'}
                      options={{
                        minimap: { enabled: false },
                        fontSize: 13,
                        wordWrap: 'on',
                        lineNumbers: 'on',
                        scrollBeyondLastLine: false,
                        automaticLayout: true,
                        tabSize: 2
                      }}
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
                <h4>{questionData.question}</h4>
              </div>
              <div className="mcq-options">
                {questionData.options && questionData.options.length > 0 ? (
                  questionData.options.map((option, index) => (
                    <label key={index} className={`mcq-option ${answers[questionData._id]?.selectedOption === index ? 'selected' : ''}`}>
                      <input
                        type="radio"
                        name={`question-${questionData._id}`}
                        checked={answers[questionData._id]?.selectedOption === index}
                        onChange={() => handleMCQAnswer(index)}
                      />
                      <span className="option-text">{option.text}</span>
                    </label>
                  ))
                ) : (
                  <p>No options available for this question.</p>
                )}
              </div>
              <div className="question-actions">
                <button onClick={handleSubmitAnswer} className="btn btn-primary" disabled={loading}>
                  {loading ? 'Saving...' : 'Save Answer'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="test-footer">
        <div className="footer-actions">
          {(currentQuestionIndex > 0 || currentSectionIndex > 0) && (
            <button onClick={navigatePrevious} className="btn btn-secondary">
              ← Previous
            </button>
          )}
          {!isLastQuestion() ? (
            <button onClick={navigateNext} className="btn btn-primary">
              Next →
            </button>
          ) : (
            <button 
              onClick={() => handleSubmitTest(false)} 
              className="btn btn-danger"
            >
              Submit Test
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default TestTaking;
