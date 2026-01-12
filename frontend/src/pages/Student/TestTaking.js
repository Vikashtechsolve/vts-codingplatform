import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import axiosInstance from '../../utils/axios';
import Modal from '../../components/Modal';
import { useExamSecurity } from '../../hooks/useExamSecurity';
import './TestTaking.css';

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
      const errorMsg = error.response?.data?.message || error.message || 'Error submitting test';
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
    if (!answer || !answer.answer) return 'not-attempted';
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
      // Get visible test cases (non-hidden)
      const visibleTestCases = questionData.testCases?.filter(tc => !tc.isHidden) || [];
      
      if (visibleTestCases.length === 0) {
        showModal('Info', 'No sample test cases available for this question.', 'info');
        setIsRunningTests(false);
        return;
      }

      // Run code against all visible test cases
      const results = [];
      for (let i = 0; i < visibleTestCases.length; i++) {
        const testCase = visibleTestCases[i];
        try {
          const response = await axiosInstance.post('/code-execution/execute', {
            code,
            language: selectedLanguage,
            input: testCase.input
          });

          const expectedNormalized = normalizeOutput(testCase.expectedOutput);
          const actualNormalized = normalizeOutput(response.data.output || '');
          const passed = response.data.success && expectedNormalized === actualNormalized;
          
          results.push({
            testCaseIndex: i + 1,
            input: testCase.input,
            expectedOutput: testCase.expectedOutput,
            actualOutput: response.data.output || '',
            error: response.data.error || '',
            passed,
            executionTime: response.data.executionTime || 0
          });
        } catch (error) {
          results.push({
            testCaseIndex: i + 1,
            input: testCase.input,
            expectedOutput: testCase.expectedOutput,
            actualOutput: '',
            error: error.response?.data?.error || error.message || 'Execution failed',
            passed: false,
            executionTime: 0
          });
        }
      }

      setTestCaseResults(results);
      setIsRunningTests(false);
      
      const passedCount = results.filter(r => r.passed).length;
      const totalCount = results.length;
      
      if (passedCount === totalCount) {
        showModal('All Test Cases Passed!', `✅ All ${totalCount} sample test case(s) passed!`, 'success');
      } else {
        showModal('Some Test Cases Failed', `${passedCount} out of ${totalCount} sample test case(s) passed.`, 'warning');
      }
    } catch (error) {
      setIsRunningTests(false);
      console.error('❌ Error executing code:', error);
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
        
        // Run ALL test cases (both visible and hidden) and calculate score
        const allTestCases = question.questionId.testCases || [];
        const visibleTestCases = allTestCases.filter(tc => !tc.isHidden);
        const hiddenTestCases = allTestCases.filter(tc => tc.isHidden);
        
        let testCasesPassed = 0;
        const visibleResults = [];
        const hiddenResults = [];

        // Run visible test cases
        for (let i = 0; i < visibleTestCases.length; i++) {
          const testCase = visibleTestCases[i];
          try {
            const response = await axiosInstance.post('/code-execution/execute', {
              code,
              language: selectedLanguage,
              input: testCase.input
            });

            const expectedNormalized = normalizeOutput(testCase.expectedOutput);
            const actualNormalized = normalizeOutput(response.data.output || '');
            const passed = response.data.success && expectedNormalized === actualNormalized;
            if (passed) testCasesPassed++;
            
            visibleResults.push({
              testCaseIndex: i + 1,
              input: testCase.input,
              expectedOutput: testCase.expectedOutput,
              actualOutput: response.data.output || '',
              passed,
              isHidden: false,
              executionTime: response.data.executionTime || 0
            });
          } catch (error) {
            visibleResults.push({
              testCaseIndex: i + 1,
              input: testCase.input,
              expectedOutput: testCase.expectedOutput,
              actualOutput: '',
              passed: false,
              isHidden: false,
              error: error.response?.data?.error || error.message,
              executionTime: 0
            });
          }
        }

        // Run hidden test cases
        for (let i = 0; i < hiddenTestCases.length; i++) {
          const testCase = hiddenTestCases[i];
          try {
            const response = await axiosInstance.post('/code-execution/execute', {
              code,
              language: selectedLanguage,
              input: testCase.input
            });

            const expectedNormalized = normalizeOutput(testCase.expectedOutput);
            const actualNormalized = normalizeOutput(response.data.output || '');
            const passed = response.data.success && expectedNormalized === actualNormalized;
            if (passed) testCasesPassed++;
            
            hiddenResults.push({
              testCaseIndex: i + 1,
              input: '[Hidden]', // Don't show actual input
              expectedOutput: '[Hidden]', // Don't show expected output
              actualOutput: passed ? '[Passed]' : '[Failed]',
              passed,
              isHidden: true,
              executionTime: response.data.executionTime || 0
            });
          } catch (error) {
            hiddenResults.push({
              testCaseIndex: i + 1,
              input: '[Hidden]',
              expectedOutput: '[Hidden]',
              actualOutput: '[Failed]',
              passed: false,
              isHidden: true,
              error: 'Execution failed',
              executionTime: 0
            });
          }
        }

        await axiosInstance.post(`/results/${result._id}/answer`, {
          questionId,
          answer: code,
          language: selectedLanguage,
          testCasesPassed,
          totalTestCases: allTestCases.length
        });
        
        // Show submission summary with detailed results
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
      } else {
        if (answers[questionId]?.selectedOption === undefined) {
          showModal('Warning', 'Please select an answer', 'warning');
          setLoading(false);
          return;
        }
        
        await axiosInstance.post(`/results/${result._id}/answer`, {
          questionId,
          answer: answers[questionId]?.selectedOption
        });
        
        showModal('Success', 'Answer saved successfully!', 'success');
        // Refresh result to get updated answers
        const updatedResult = await axiosInstance.get(`/results/${result._id}`);
        setResult(updatedResult.data);
      }
      setLoading(false);
    } catch (error) {
      setLoading(false);
      console.error('❌ Error submitting answer:', error);
      const errorMsg = error.response?.data?.message || error.message || 'Error saving answer';
      showModal('Error', errorMsg, 'error');
    }
  };


  const navigateToQuestion = (sectionIdx, questionIdx) => {
    setCurrentSectionIndex(sectionIdx);
    setCurrentQuestionIndex(questionIdx);
    // Clear test case results when navigating
    setTestCaseResults([]);
    setSubmissionSummary(null);
    setHiddenTestCaseResults([]);
    setCustomTestResult(null);
    setCustomTestCase({ input: '', expectedOutput: '' });
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
