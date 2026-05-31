import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import axiosInstance from '../../utils/axios';
import { CODE_REQUEST_TIMEOUT_EXECUTE_MS } from '../../config/codeExecution';
import Modal from '../../components/Modal';
import RichTextEditor from '../../components/RichTextEditor';
import RichTextDisplay from '../../components/RichTextDisplay';
import VendorQuestionFormPage from '../../components/VendorAdmin/VendorQuestionFormPage';
import { QUESTION_FORM_META } from '../../utils/vendorQuestionFormMeta';
import { isRichTextEmpty } from '../../utils/richTextUtils';
import TagInput from '../../components/TagInput';
import CodingQuestionCodeWorkspace from '../../components/VendorAdmin/CodingQuestionCodeWorkspace';
import './CreateCodingQuestion.css';

const CODE_LANGS = ['java', 'cpp', 'c', 'python', 'javascript', 'js', 'node', 'nodejs'];

const normalizeLangKey = (rawKey = '') => {
  const key = String(rawKey).trim().toLowerCase();
  if (!key) return null;
  if (key === 'java') return 'java';
  if (['cpp', 'c++', 'cxx', 'cplusplus'].includes(key)) return 'cpp';
  if (key === 'c') return 'c';
  if (['python', 'python3', 'py'].includes(key)) return 'python';
  if (['javascript', 'js', 'node', 'nodejs'].includes(key)) return 'javascript';
  return key || null;
};

/**
 * Handles legacy code shapes: string, array[{language,code}], or object aliases.
 */
const normalizeCodeMap = (raw, allowedLanguages = []) => {
  const base = { java: '', cpp: '', c: '', python: '', javascript: '' };
  const preferred = allowedLanguages.find((l) => CODE_LANGS.includes(l)) || 'python';

  if (!raw) return base;

  if (typeof raw === 'string') {
    base[preferred] = raw;
    return base;
  }

  if (Array.isArray(raw)) {
    raw.forEach((entry) => {
      if (!entry) return;
      const lang = normalizeLangKey(entry.language || entry.lang || entry.key);
      const code = entry.code || entry.solution || entry.value || '';
      if (lang && typeof code === 'string') base[lang] = code;
    });
    return base;
  }

  if (typeof raw === 'object') {
    // Legacy shape: { language: 'python', code: '...' }
    const singleLang = normalizeLangKey(raw.language || raw.lang || raw.key);
    const singleCode = raw.code || raw.solution || raw.value;
    if (singleLang && typeof singleCode === 'string') {
      base[singleLang] = singleCode;
      return base;
    }

    Object.entries(raw).forEach(([k, v]) => {
      const lang = normalizeLangKey(k);
      if (!lang || ['language', 'lang', 'key', 'code', 'value', 'solution'].includes(lang)) return;
      if (typeof v === 'string') {
        base[lang] = v;
      } else if (v && typeof v === 'object') {
        const nested = v.code || v.solution || v.value;
        if (typeof nested === 'string') base[lang] = nested;
      }
    });
  }

  return base;
};

const mergeSolutionSources = (question, allowedLanguages = []) => {
  const merged = { java: '', cpp: '', c: '', python: '', javascript: '' };
  const sourceKeys = [
    'solution',
    'solutions',
    'solutionCode',
    'referenceSolution',
    'answerCode',
    'testCode',
    'codeSolution',
    'privateSolution',
    'editorSolution',
  ];

  const assign = (lang, code) => {
    if (!lang || typeof code !== 'string') return;
    const normalized = normalizeLangKey(lang);
    if (!normalized || !code.trim()) return;
    merged[normalized] = code;
  };

  const extract = (raw, preferredLang) => {
    if (!raw) return;

    if (typeof raw === 'string') {
      assign(preferredLang || allowedLanguages[0] || 'python', raw);
      return;
    }

    if (Array.isArray(raw)) {
      raw.forEach((item) => extract(item, preferredLang));
      return;
    }

    if (typeof raw !== 'object') return;

    const explicitLang = raw.language || raw.lang || raw.key;
    const explicitCode = raw.code || raw.solution || raw.value || raw.source || raw.answer;
    if (typeof explicitCode === 'string') {
      assign(explicitLang || preferredLang, explicitCode);
    }

    Object.entries(raw).forEach(([k, v]) => {
      const langFromKey = normalizeLangKey(k);
      if (langFromKey && typeof v === 'string') {
        assign(langFromKey, v);
        return;
      }
      if (langFromKey && v && typeof v === 'object') {
        const nestedCode = v.code || v.solution || v.value || v.source || v.answer;
        if (typeof nestedCode === 'string') {
          assign(langFromKey, nestedCode);
          return;
        }
      }
      if (v && typeof v === 'object') {
        extract(v, langFromKey || preferredLang);
      }
    });
  };

  sourceKeys.forEach((key) => extract(question?.[key], allowedLanguages[0] || 'python'));
  return mergeCodeMaps(merged);
};

const mergeCodeMaps = (...maps) => {
  const merged = { java: '', cpp: '', c: '', python: '', javascript: '' };
  maps.forEach((m) => {
    if (!m || typeof m !== 'object') return;
    Object.keys(merged).forEach((lang) => {
      const value = m[lang];
      if (typeof value === 'string' && value.trim()) {
        merged[lang] = value;
      }
    });
  });
  return merged;
};

const CreateCodingQuestion = () => {
  const { id } = useParams();
  const location = useLocation();
  useAuth();
  const isEditMode = !!id;
  const isGlobal = location.pathname.includes('/super-admin/global-questions');
  const apiBase = isGlobal ? '/super-admin/global-questions' : '/questions';
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    difficulty: 'medium',
    allowedLanguages: [],
    testCases: [{ input: '', expectedOutput: '', isHidden: false, points: 10 }],
    starterCode: { java: '', cpp: '', c: '', python: '', javascript: '' },
    constraints: '',
    tags: []
  });
  const [pageLoading, setPageLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [modal, setModal] = useState({ isOpen: false, title: '', message: '', type: 'info' });
  const [selectedLanguage, setSelectedLanguage] = useState('python');
  const [testCode, setTestCode] = useState({ java: '', cpp: '', c: '', python: '', javascript: '' });
  const [testResults, setTestResults] = useState({}); // Store results for each test case
  const [isTestingAll, setIsTestingAll] = useState(false);
  const [, setTestingIndex] = useState(null);
  const navigate = useNavigate();
  const languageOptions = useMemo(() => {
    const base = ['python', 'java', 'cpp', 'c'];
    const legacy = (formData.allowedLanguages || []).filter((l) => !base.includes(l));
    return [...base, ...legacy];
  }, [formData.allowedLanguages]);

  useEffect(() => {
    if (isEditMode && id) {
      fetchQuestion();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run when id or isEditMode changes
  }, [id, isEditMode]);

  const fetchQuestion = async () => {
    try {
      setPageLoading(true);
      console.log('📥 Fetching question for edit:', id);
      const response = await axiosInstance.get(`${apiBase}/coding/${id}`);
      const q = response.data;
      console.log('✅ Question data received:', q);
      const allowed = q.allowedLanguages || [];
      const normalizedStarter = normalizeCodeMap(q.starterCode, allowed);
      const loadedSolution = mergeSolutionSources(q, allowed);
      const codeLanguages = [
        ...Object.keys(normalizedStarter).filter((k) => String(normalizedStarter[k] || '').trim()),
        ...Object.keys(loadedSolution).filter((k) => String(loadedSolution[k] || '').trim()),
      ];
      const mergedAllowed = Array.from(new Set([...(allowed || []), ...codeLanguages]));
      
      setFormData({
        title: q.title || '',
        description: q.description || '',
        difficulty: q.difficulty || 'medium',
        allowedLanguages: mergedAllowed,
        testCases: q.testCases && q.testCases.length > 0 ? q.testCases : [{ input: '', expectedOutput: '', isHidden: false, points: 10 }],
        starterCode: normalizedStarter,
        constraints: q.constraints || '',
        tags: q.tags || []
      });

      setTestCode(loadedSolution);

      // Prefer a language that already has code to avoid blank editor in edit mode
      const langs = Array.isArray(mergedAllowed) ? mergedAllowed : [];
      const withStarter = langs.find((lang) => String(normalizedStarter?.[lang] || '').trim());
      const withSolution = langs.find((lang) => String(loadedSolution?.[lang] || '').trim());
      if (withSolution || withStarter || langs.length > 0) {
        // Prefer opening the language that has saved solution to avoid false "blank solution" impression.
        setSelectedLanguage(withSolution || withStarter || langs[0]);
      }
    } catch (error) {
      console.error('❌ Error fetching question:', error);
      showModal('Error', `Failed to load question data: ${error.response?.data?.message || error.message}`, 'error');
    } finally {
      setPageLoading(false);
    }
  };

  const meta = QUESTION_FORM_META.coding;
  const backTo = isGlobal ? '/super-admin/global-questions' : meta.back;

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
    const next = formData.allowedLanguages.includes(lang)
      ? formData.allowedLanguages.filter((l) => l !== lang)
      : [...formData.allowedLanguages, lang];
    setFormData({ ...formData, allowedLanguages: next });
    if (!next.includes(selectedLanguage) && next.length > 0) {
      setSelectedLanguage(next[0]);
    }
  };

  useEffect(() => {
    if (
      formData.allowedLanguages.length > 0 &&
      !formData.allowedLanguages.includes(selectedLanguage)
    ) {
      setSelectedLanguage(formData.allowedLanguages[0]);
    }
  }, [formData.allowedLanguages, selectedLanguage]);

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
  };

  const handleTestCodeChange = (lang, value) => {
    setTestCode({ ...testCode, [lang]: value });
    // Clear all test results when code changes
    setTestResults({});
  };

  const handleCopyStarterToSolution = (lang) => {
    const starter = formData.starterCode?.[lang] || '';
    setTestCode((prev) => ({ ...prev, [lang]: starter }));
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

  // eslint-disable-next-line no-unused-vars -- reserved for single test case UI
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
      }, { timeout: CODE_REQUEST_TIMEOUT_EXECUTE_MS });

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
          }, { timeout: CODE_REQUEST_TIMEOUT_EXECUTE_MS });

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
    
    if (isRichTextEmpty(formData.description)) {
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
    
    const payload = {
      ...formData,
      solution: testCode,
    };

    setSaving(true);

    try {
      if (isEditMode) {
        console.log('📤 Updating coding question...');
        await axiosInstance.put(`${apiBase}/coding/${id}`, payload);
        console.log('✅ Question updated');
        showModal('Success', 'Question updated successfully!', 'success');
      } else {
        console.log('📤 Creating coding question...');
        const response = await axiosInstance.post(`${apiBase}/coding`, payload);
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
      setSaving(false);
    }
  };

  const modalEl = (
    <Modal
      isOpen={modal.isOpen}
      onClose={closeModal}
      title={modal.title}
      type={modal.type}
      showFooter={typeof modal.message === 'string'}
    >
      {modal.message}
    </Modal>
  );

  const formFooter = (
    <div className="form-actions">
      <button type="button" onClick={() => navigate(backTo)} className="btn btn-secondary">
        Cancel
      </button>
      <button type="submit" form="coding-question-form" className="btn btn-primary" disabled={saving}>
        {saving ? 'Saving…' : isEditMode ? 'Update question' : 'Create question'}
      </button>
    </div>
  );

  return (
    <VendorQuestionFormPage
      className="create-coding-question"
      loading={pageLoading}
      backTo={backTo}
      backLabel="Back to questions"
      eyebrow={meta.label}
      title={isEditMode ? meta.editTitle : meta.createTitle}
      subtitle={meta.subtitle}
      accent={meta.accent}
      isGlobal={isGlobal}
      modal={modalEl}
      footer={formFooter}
    >
      <form id="coding-question-form" onSubmit={handleSubmit} className="question-form">
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

          <div className="vqf-rich-field">
            <label>Description *</label>
            <RichTextEditor
              variant="full"
              value={formData.description}
              onChange={(html) => setFormData((prev) => ({ ...prev, description: html }))}
              placeholder="Problem statement, examples, input/output format — use headings, lists, code blocks, links, and images (URL)."
              minHeight={220}
            />
            {!isRichTextEmpty(formData.description) && (
              <div className="vqf-rich-preview">
                <p className="vqf-rich-preview-label">Preview</p>
                <RichTextDisplay content={formData.description} />
              </div>
            )}
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
        </div>

        <div className="form-section cq-section">
          <h2 className="section-title">Tags &amp; languages</h2>
          <p className="section-description">
            Add searchable tags and choose which languages students can use.
          </p>
          <TagInput
            label="Tags"
            hint="Type a tag name — matching tags from your library appear as you type. Press Enter or click a suggestion to add."
            value={formData.tags}
            onChange={(tags) => setFormData((prev) => ({ ...prev, tags }))}
          />
          <div className="form-group cq-lang-picker">
            <label>Allowed languages *</label>
            <div className="cq-lang-pills">
              {languageOptions.map((id) => (
                <button
                  key={id}
                  type="button"
                  className={`cq-lang-pill ${formData.allowedLanguages.includes(id) ? 'active' : ''}`}
                  onClick={() => handleLanguageToggle(id)}
                  aria-pressed={formData.allowedLanguages.includes(id)}
                >
                  {id === 'cpp' ? 'C++' : id === 'javascript' ? 'JavaScript' : id.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Test Cases Section */}
        <div className="form-section cq-section">
          <div className="section-header">
            <div>
              <h2 className="section-title">Test cases</h2>
              <p className="section-description cq-section-desc-inline">
                Define inputs and expected outputs. Use monospace fields for precise formatting.
              </p>
            </div>
            <button type="button" onClick={handleAddTestCase} className="btn btn-secondary btn-sm">
              + Add test case
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
                        className="form-textarea cq-io-textarea"
                        spellCheck={false}
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
                        className="form-textarea cq-io-textarea"
                        spellCheck={false}
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

        <div className="form-section cq-section cq-code-section">
          <h2 className="section-title">Code templates</h2>
          <p className="section-description">
            Write starter and private solution code side-by-side for the selected language.
          </p>
          <CodingQuestionCodeWorkspace
            allowedLanguages={formData.allowedLanguages}
            activeLang={selectedLanguage}
            onActiveLangChange={setSelectedLanguage}
            starterCode={formData.starterCode}
            testCode={testCode}
            onStarterChange={handleStarterCodeChange}
            onTestCodeChange={handleTestCodeChange}
            onCopyStarterToSolution={handleCopyStarterToSolution}
            onRunAllTests={handleTestAllTestCases}
            isTestingAll={isTestingAll}
            canRunTests={formData.allowedLanguages.length > 0 && formData.testCases.length > 0}
          />
        </div>

      </form>
    </VendorQuestionFormPage>
  );
};

export default CreateCodingQuestion;
