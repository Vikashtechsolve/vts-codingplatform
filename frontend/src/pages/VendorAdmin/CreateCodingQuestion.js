import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import axiosInstance from '../../utils/axios';
import Modal from '../../components/Modal';
import Editor from '@monaco-editor/react';
import './CreateCodingQuestion.css';

const CreateCodingQuestion = () => {
  const { id } = useParams();
  const location = useLocation();
  const { user } = useAuth();
  const isEditMode = !!id;
  const isGlobal = location.pathname.includes('/super-admin/global-questions');
  const apiBase = isGlobal ? '/super-admin/global-questions' : '/questions';
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    difficulty: 'medium',
    allowedLanguages: [],
    testCases: [{ input: '', expectedOutput: '', isHidden: false, points: 10 }],
    starterCode: { java: '', cpp: '', c: '', python: '' },
    constraints: ''
  });
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState({ isOpen: false, title: '', message: '', type: 'info' });
  const [selectedLanguage, setSelectedLanguage] = useState('python');
  const [testCode, setTestCode] = useState({ java: '', cpp: '', c: '', python: '' });
  const [testResults, setTestResults] = useState({}); // Store results for each test case
  const [isTestingAll, setIsTestingAll] = useState(false);
  const [testingIndex, setTestingIndex] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (isEditMode && id) {
      fetchQuestion();
    }
  }, [id, isEditMode]);

  const fetchQuestion = async () => {
    try {
      setLoading(true);
      console.log('📥 Fetching question for edit:', id);
      const response = await axiosInstance.get(`${apiBase}/coding/${id}`);
      const q = response.data;
      console.log('✅ Question data received:', q);
      
      setFormData({
        title: q.title || '',
        description: q.description || '',
        difficulty: q.difficulty || 'medium',
        allowedLanguages: q.allowedLanguages || [],
        testCases: q.testCases && q.testCases.length > 0 ? q.testCases : [{ input: '', expectedOutput: '', isHidden: false, points: 10 }],
        starterCode: q.starterCode || { java: '', cpp: '', c: '', python: '' },
        constraints: q.constraints || ''
      });
      
      setTestCode(q.solution || { java: '', cpp: '', c: '', python: '' });
      
      // Set selected language if available
      if (q.allowedLanguages && q.allowedLanguages.length > 0) {
        setSelectedLanguage(q.allowedLanguages[0]);
      }
    } catch (error) {
      console.error('❌ Error fetching question:', error);
      showModal('Error', `Failed to load question data: ${error.response?.data?.message || error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const showModal = (title, message, type = 'info') => {
    setModal({ isOpen: true, title, message, type });
  };

  const closeModal = () => {
    setModal({ isOpen: false, title: '', message: '', type: 'info' });
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleLanguageToggle = (lang) => {
    setFormData({
      ...formData,
      allowedLanguages: formData.allowedLanguages.includes(lang)
        ? formData.allowedLanguages.filter(l => l !== lang)
        : [...formData.allowedLanguages, lang]
    });
  };

  const handleAddTestCase = () => {
    setFormData({
      ...formData,
      testCases: [...formData.testCases, { input: '', expectedOutput: '', isHidden: false, points: 10 }]
    });
  };

  const handleTestCaseChange = (index, field, value) => {
    const newTestCases = [...formData.testCases];
    newTestCases[index][field] = value;
    setFormData({ ...formData, testCases: newTestCases });
    // Clear test result for this test case when it changes
    if (testResults[index]) {
      const newResults = { ...testResults };
      delete newResults[index];
      setTestResults(newResults);
    }
  };

  const handleRemoveTestCase = (index) => {
    if (formData.testCases.length <= 1) {
      showModal('Warning', 'At least one test case is required', 'warning');
      return;
    }
    const newTestCases = formData.testCases.filter((_, i) => i !== index);
    setFormData({ ...formData, testCases: newTestCases });
    // Remove test result for this test case
    const newResults = { ...testResults };
    delete newResults[index];
    setTestResults(newResults);
  };

  const handleStarterCodeChange = (lang, value) => {
    setFormData({
      ...formData,
      starterCode: { ...formData.starterCode, [lang]: value }
    });
    // Also update test code if it matches starter code
    if (testCode[lang] === formData.starterCode[lang] || !testCode[lang]) {
      setTestCode({ ...testCode, [lang]: value });
    }
  };

  const handleTestCodeChange = (lang, value) => {
    setTestCode({ ...testCode, [lang]: value });
    // Clear all test results when code changes
    setTestResults({});
  };

  const normalizeOutput = (output) => {
    if (!output) return '';
    return output
      .trim()
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .join('\n');
  };

  const handleTestSingleTestCase = async (testCaseIndex) => {
    const testCase = formData.testCases[testCaseIndex];
    if (!testCase.input.trim() || !testCase.expectedOutput.trim()) {
      showModal('Warning', 'Please provide both input and expected output for this test case', 'warning');
      return;
    }

    const code = testCode[selectedLanguage] || formData.starterCode[selectedLanguage] || '';
    if (!code.trim()) {
      showModal('Warning', 'Please write code to test', 'warning');
      return;
    }

    if (formData.allowedLanguages.length === 0 || !formData.allowedLanguages.includes(selectedLanguage)) {
      showModal('Warning', 'Please select at least one allowed language first', 'warning');
      return;
    }

    try {
      setTestingIndex(testCaseIndex);
      const response = await axiosInstance.post('/code-execution/execute', {
        code,
        language: selectedLanguage,
        input: testCase.input
      });

      const expectedNormalized = normalizeOutput(testCase.expectedOutput);
      const actualNormalized = normalizeOutput(response.data.output || '');
      const passed = response.data.success && expectedNormalized === actualNormalized;

      setTestResults({
        ...testResults,
        [testCaseIndex]: {
          input: testCase.input,
          expectedOutput: testCase.expectedOutput,
          actualOutput: response.data.output || '',
          error: response.data.error || '',
          passed,
          executionTime: response.data.executionTime || 0
        }
      });
      setTestingIndex(null);
    } catch (error) {
      setTestingIndex(null);
      console.error('❌ Error testing test case:', error);
      const errorMsg = error.response?.data?.error || error.message || 'Error executing code';
      setTestResults({
        ...testResults,
        [testCaseIndex]: {
          input: testCase.input,
          expectedOutput: testCase.expectedOutput,
          actualOutput: '',
          error: errorMsg,
          passed: false,
          executionTime: 0
        }
      });
    }
  };

  const handleTestAllTestCases = async () => {
    const code = testCode[selectedLanguage] || formData.starterCode[selectedLanguage] || '';
    if (!code.trim()) {
      showModal('Warning', 'Please write code to test', 'warning');
      return;
    }

    if (formData.allowedLanguages.length === 0 || !formData.allowedLanguages.includes(selectedLanguage)) {
      showModal('Warning', 'Please select at least one allowed language first', 'warning');
      return;
    }

    // Validate all test cases have input and output
    const invalidTestCases = formData.testCases.filter(tc => !tc.input.trim() || !tc.expectedOutput.trim());
    if (invalidTestCases.length > 0) {
      showModal('Warning', 'All test cases must have both input and expected output', 'warning');
      return;
    }

    try {
      setIsTestingAll(true);
      const results = {};

      for (let i = 0; i < formData.testCases.length; i++) {
        const testCase = formData.testCases[i];
        try {
          const response = await axiosInstance.post('/code-execution/execute', {
            code,
            language: selectedLanguage,
            input: testCase.input
          });

          const expectedNormalized = normalizeOutput(testCase.expectedOutput);
          const actualNormalized = normalizeOutput(response.data.output || '');
          const passed = response.data.success && expectedNormalized === actualNormalized;

          results[i] = {
            input: testCase.input,
            expectedOutput: testCase.expectedOutput,
            actualOutput: response.data.output || '',
            error: response.data.error || '',
            passed,
            executionTime: response.data.executionTime || 0
          };
        } catch (error) {
          results[i] = {
            input: testCase.input,
            expectedOutput: testCase.expectedOutput,
            actualOutput: '',
            error: error.response?.data?.error || error.message || 'Error executing code',
            passed: false,
            executionTime: 0
          };
        }
      }

      setTestResults(results);
      setIsTestingAll(false);

      const passedCount = Object.values(results).filter(r => r.passed).length;
      const totalCount = formData.testCases.length;
      const failedCount = totalCount - passedCount;
      
      if (passedCount === totalCount) {
        showModal('Success', (
          <div className="test-result-summary success">
            <div style={{ fontSize: '1.2em', marginBottom: '10px', fontWeight: '600' }}>
              ✅ All Test Cases Passed!
            </div>
            <div className="test-result-stats">
              <div className="stat-item">
                <span className="stat-icon">✓</span>
                <span>{passedCount} / {totalCount} passed</span>
              </div>
            </div>
          </div>
        ), 'success');
      } else {
        showModal('Test Results', (
          <div className="test-result-summary warning">
            <div style={{ fontSize: '1.2em', marginBottom: '10px', fontWeight: '600' }}>
              ⚠️ Some Test Cases Failed
            </div>
            <div className="test-result-stats">
              <div className="stat-item" style={{ color: '#28a745' }}>
                <span className="stat-icon">✓</span>
                <span>{passedCount} passed</span>
              </div>
              <div className="stat-item" style={{ color: '#dc3545' }}>
                <span className="stat-icon">✗</span>
                <span>{failedCount} failed</span>
              </div>
              <div className="stat-item">
                <span>Total: {totalCount}</span>
              </div>
            </div>
            <p style={{ marginTop: '15px', fontSize: '0.95em', color: 'var(--text-secondary)' }}>
              Please check the test case results below and fix any issues.
            </p>
          </div>
        ), 'warning');
      }
    } catch (error) {
      setIsTestingAll(false);
      console.error('❌ Error testing all test cases:', error);
      showModal('Error', 'Error testing test cases. Please try again.', 'error');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Client-side validation
    if (!formData.title.trim()) {
      showModal('Validation Error', 'Title is required', 'error');
      return;
    }
    
    if (!formData.description.trim()) {
      showModal('Validation Error', 'Description is required', 'error');
      return;
    }
    
    if (formData.allowedLanguages.length === 0) {
      showModal('Validation Error', 'Please select at least one allowed language', 'error');
      return;
    }
    
    if (formData.testCases.length === 0) {
      showModal('Validation Error', 'At least one test case is required', 'error');
      return;
    }
    
    // Validate test cases
    const invalidTestCases = formData.testCases.filter(tc => !tc.input.trim() || !tc.expectedOutput.trim());
    if (invalidTestCases.length > 0) {
      showModal('Validation Error', 'All test cases must have both input and expected output', 'error');
      return;
    }
    
    setLoading(true);

    try {
      if (isEditMode) {
        console.log('📤 Updating coding question...');
        await axiosInstance.put(`${apiBase}/coding/${id}`, formData);
        console.log('✅ Question updated');
        showModal('Success', 'Question updated successfully!', 'success');
      } else {
        console.log('📤 Creating coding question...');
        const response = await axiosInstance.post(`${apiBase}/coding`, formData);
        console.log('✅ Question created:', response.data);
        showModal('Success', 'Question created successfully!', 'success');
      }
      setTimeout(() => {
        navigate(isGlobal ? '/super-admin/global-questions' : '/vendor-admin/questions');
      }, 1500);
    } catch (error) {
      console.error('❌ Error saving question:', error);
      const errorMsg = error.response?.data?.message || 
                       error.response?.data?.errors?.map(e => e.msg || e.message).join(', ') ||
                       `Error ${isEditMode ? 'updating' : 'creating'} question. Please try again.`;
      showModal('Error', errorMsg, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container create-coding-question">
      <Modal 
        isOpen={modal.isOpen} 
        onClose={closeModal}
        title={modal.title}
        type={modal.type}
        showFooter={typeof modal.message === 'string'}
      >
        {modal.message}
      </Modal>

      <div className="page-header">
        <h1 className="page-title">
          {isEditMode ? 'Edit' : 'Create'} {isGlobal ? 'Global ' : ''}Coding Question
        </h1>
        <button 
          onClick={() => navigate(isGlobal ? '/super-admin/global-questions' : '/vendor-admin/questions')} 
          className="btn btn-secondary"
        >
          Back to Questions
        </button>
      </div>

      <form onSubmit={handleSubmit} className="question-form">
        {/* Basic Information Section */}
        <div className="form-section">
          <h2 className="section-title">Basic Information</h2>
          <div className="form-row">
            <div className="form-group">
              <label>Title *</label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleChange}
                required
                placeholder="e.g., Two Sum - Find two numbers that add up to target"
                className="form-input"
              />
            </div>
            <div className="form-group">
              <label>Difficulty *</label>
              <select name="difficulty" value={formData.difficulty} onChange={handleChange} className="form-select">
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>Description *</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              required
              rows="8"
              placeholder="Describe the problem statement, input/output format..."
              className="form-textarea"
            />
          </div>

          <div className="form-group">
            <label>Constraints</label>
            <textarea
              name="constraints"
              value={formData.constraints}
              onChange={handleChange}
              rows="3"
              placeholder="e.g., 1 ≤ n ≤ 10^5, -10^9 ≤ nums[i] ≤ 10^9"
              className="form-textarea"
            />
          </div>

          <div className="form-group">
            <label>Allowed Languages *</label>
            <div className="language-checkboxes">
              {['java', 'cpp', 'c', 'python'].map(lang => (
                <label key={lang} className="language-checkbox">
                  <input
                    type="checkbox"
                    checked={formData.allowedLanguages.includes(lang)}
                    onChange={() => handleLanguageToggle(lang)}
                  />
                  <span className="language-label">{lang.toUpperCase()}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Test Cases Section */}
        <div className="form-section">
          <div className="section-header">
            <h2 className="section-title">Test Cases</h2>
            <button type="button" onClick={handleAddTestCase} className="btn btn-secondary btn-sm">
              + Add Test Case
            </button>
          </div>

          <div className="test-cases-container">
            {formData.testCases.map((tc, index) => (
              <div key={index} className={`test-case-card ${testResults[index] ? (testResults[index].passed ? 'test-case-passed' : 'test-case-failed') : ''}`}>
                <div className="test-case-header">
                  <h3>Test Case {index + 1}</h3>
                  <div className="test-case-actions">
                    {testResults[index] && (
                      <span className={`test-status-badge ${testResults[index].passed ? 'passed' : 'failed'}`}>
                        {testResults[index].passed ? '✓ Passed' : '✗ Failed'}
                      </span>
                    )}
                    <button 
                      type="button" 
                      onClick={() => handleRemoveTestCase(index)} 
                      className="btn-icon btn-danger"
                      disabled={formData.testCases.length <= 1}
                      title="Remove Test Case"
                    >
                      ×
                    </button>
                  </div>
                </div>

                <div className="test-case-content">
                  <div className="form-row">
                    <div className="form-group">
                      <label>Input *</label>
                      <textarea
                        value={tc.input}
                        onChange={(e) => handleTestCaseChange(index, 'input', e.target.value)}
                        required
                        rows="4"
                        placeholder="Enter test input..."
                        className="form-textarea"
                      />
                    </div>
                    <div className="form-group">
                      <label>Expected Output *</label>
                      <textarea
                        value={tc.expectedOutput}
                        onChange={(e) => handleTestCaseChange(index, 'expectedOutput', e.target.value)}
                        required
                        rows="4"
                        placeholder="Enter expected output..."
                        className="form-textarea"
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={tc.isHidden}
                        onChange={(e) => handleTestCaseChange(index, 'isHidden', e.target.checked)}
                      />
                      <span>Hidden Test Case (will not be visible to students)</span>
                    </label>
                  </div>

                  {testResults[index] && (
                    <div className={`test-result-box ${testResults[index].passed ? 'result-passed' : 'result-failed'}`}>
                      <div className="test-result-header">
                        <strong>Test Result:</strong>
                        <span className={`test-status ${testResults[index].passed ? 'passed' : 'failed'}`}>
                          {testResults[index].passed ? '✓ Passed' : '✗ Failed'}
                        </span>
                      </div>
                      {!testResults[index].passed && (
                        <div className="test-result-details">
                          <div><strong>Expected:</strong> <pre>{testResults[index].expectedOutput}</pre></div>
                          <div><strong>Got:</strong> <pre>{testResults[index].actualOutput || '(No output)'}</pre></div>
                          {testResults[index].error && (
                            <div className="test-error"><strong>Error:</strong> <pre>{testResults[index].error}</pre></div>
                          )}
                        </div>
                      )}
                      {testResults[index].executionTime > 0 && (
                        <div className="test-execution-time">Execution Time: {testResults[index].executionTime}ms</div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Test Your Code Section */}
        <div className="form-section test-code-section">
          <h2 className="section-title">Test Your Test Cases</h2>
          <p className="section-description">
            Write code and test it against all test cases to verify they work correctly in the selected language.
          </p>

          <div className="test-code-container">
            <div className="form-group">
              <label>Select Language for Testing</label>
              <select 
                value={selectedLanguage} 
                onChange={(e) => {
                  setSelectedLanguage(e.target.value);
                  if (!testCode[e.target.value] && formData.starterCode[e.target.value]) {
                    setTestCode({ ...testCode, [e.target.value]: formData.starterCode[e.target.value] });
                  }
                }}
                className="form-select"
                disabled={formData.allowedLanguages.length === 0}
              >
                {formData.allowedLanguages.length > 0 ? (
                  formData.allowedLanguages.map(lang => (
                    <option key={lang} value={lang}>{lang.toUpperCase()}</option>
                  ))
                ) : (
                  <option value="python">Select languages first</option>
                )}
              </select>
            </div>

            <div className="form-group">
              <label>Test Code</label>
              <div className="code-editor-wrapper">
                <Editor
                  height="300px"
                  language={selectedLanguage}
                  value={testCode[selectedLanguage] || formData.starterCode[selectedLanguage] || ''}
                  onChange={(value) => handleTestCodeChange(selectedLanguage, value || '')}
                  theme={localStorage.getItem('theme') === 'dark' ? 'vs-dark' : 'light'}
                  options={{
                    minimap: { enabled: false },
                    fontSize: 14,
                    wordWrap: 'on',
                    lineNumbers: 'on'
                  }}
                />
              </div>
            </div>

            <div className="test-actions">
              <button 
                type="button" 
                onClick={handleTestAllTestCases} 
                className="btn btn-primary"
                disabled={isTestingAll || formData.allowedLanguages.length === 0}
              >
                {isTestingAll ? 'Testing All...' : '▶ Test All Test Cases'}
              </button>
            </div>
          </div>
        </div>

        {/* Starter Code Section */}
        <div className="form-section">
          <h2 className="section-title">Starter Code</h2>
          <p className="section-description">
            Provide starter code templates for each allowed language.
          </p>

          <div className="starter-code-container">
            {formData.allowedLanguages.length === 0 ? (
              <div className="empty-state">
                <p>Please select at least one allowed language to add starter code.</p>
              </div>
            ) : (
              formData.allowedLanguages.map(lang => (
                <div key={lang} className="starter-code-item">
                  <label className="starter-code-label">{lang.toUpperCase()}</label>
                  <div className="code-editor-wrapper">
                    <Editor
                      height="200px"
                      language={lang}
                      value={formData.starterCode[lang]}
                      onChange={(value) => handleStarterCodeChange(lang, value || '')}
                      theme={localStorage.getItem('theme') === 'dark' ? 'vs-dark' : 'light'}
                      options={{
                        minimap: { enabled: false },
                        fontSize: 14,
                        wordWrap: 'on',
                        lineNumbers: 'on'
                      }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Submit Button */}
        <div className="form-actions">
          <button 
            type="button" 
            onClick={() => navigate(isGlobal ? '/super-admin/global-questions' : '/vendor-admin/questions')} 
            className="btn btn-secondary"
          >
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Creating...' : 'Create Question'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreateCodingQuestion;
