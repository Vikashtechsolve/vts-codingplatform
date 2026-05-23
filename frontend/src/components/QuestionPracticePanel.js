import React, { useState, useCallback } from 'react';
import MonacoCodeEditor from './MonacoCodeEditor';
import axiosInstance from '../utils/axios';
import {
  CODE_REQUEST_TIMEOUT_BATCH_MS,
  CODE_REQUEST_TIMEOUT_EXECUTE_MS,
} from '../config/codeExecution';
import './QuestionPracticePanel.css';

/**
 * Post-test practice for a single question (does not affect stored result).
 */
const QuestionPracticePanel = ({ resultId, questionId, questionLabel, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [payload, setPayload] = useState(null);
  const [codeByLanguage, setCodeByLanguage] = useState({});
  const [language, setLanguage] = useState('python');
  const [running, setRunning] = useState(false);
  const [runResults, setRunResults] = useState(null);
  const [customInput, setCustomInput] = useState('');
  const [customExpected, setCustomExpected] = useState('');

  const loadPractice = useCallback(async () => {
    if (!resultId || !questionId) return;
    setLoading(true);
    setError(null);
    try {
      const { data } = await axiosInstance.get(
        `/results/${resultId}/practice/${questionId}`
      );
      setPayload(data);
      const langs = data.question?.allowedLanguages || ['python'];
      const lang = data.language && langs.includes(data.language) ? data.language : langs[0];
      setLanguage(lang);
      const starterMap = { ...(data.question?.starterCode || {}) };
      const submitted =
        typeof data.submittedAnswer === 'string' ? data.submittedAnswer : '';
      if (submitted) starterMap[lang] = submitted;
      setCodeByLanguage(starterMap);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load practice');
    } finally {
      setLoading(false);
    }
  }, [resultId, questionId]);

  React.useEffect(() => {
    loadPractice();
  }, [loadPractice]);

  const visibleTestCases =
    payload?.question?.testCases?.filter((tc) => !tc.isHidden) || [];

  const handleRunSample = async () => {
    if (!code.trim() || !visibleTestCases.length) return;
    setRunning(true);
    setRunResults(null);
    try {
      const { data } = await axiosInstance.post(
        '/code-execution/execute-batch',
        {
          code,
          language,
          testCases: visibleTestCases.map((tc) => ({
            input: tc.input,
            expectedOutput: tc.expectedOutput,
          })),
        },
        { timeout: CODE_REQUEST_TIMEOUT_BATCH_MS }
      );
      setRunResults(data);
    } catch (err) {
      setRunResults({
        success: false,
        error: err.response?.data?.message || err.message || 'Run failed',
      });
    } finally {
      setRunning(false);
    }
  };

  const handleRunCustom = async () => {
    if (!code.trim() || !customInput.trim()) return;
    setRunning(true);
    try {
      const { data } = await axiosInstance.post(
        '/code-execution/execute',
        {
          code,
          language,
          input: customInput,
          expectedOutput: customExpected || undefined,
        },
        { timeout: CODE_REQUEST_TIMEOUT_EXECUTE_MS }
      );
      setRunResults({ success: true, results: [data], testCasesPassed: data.passed ? 1 : 0, total: 1 });
    } catch (err) {
      setRunResults({
        success: false,
        error: err.response?.data?.message || err.message || 'Run failed',
      });
    } finally {
      setRunning(false);
    }
  };

  const q = payload?.question;
  const code =
    codeByLanguage[language] ??
    q?.starterCode?.[language] ??
    '';

  const setCode = (next) => {
    setCodeByLanguage((prev) => ({ ...prev, [language]: next }));
  };

  return (
    <div className="qpp-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="qpp-panel" onClick={(e) => e.stopPropagation()}>
        <header className="qpp-header">
          <div>
            <span className="qpp-badge">Practice mode</span>
            <h2>{questionLabel || q?.title || 'Practice question'}</h2>
            <p className="qpp-hint">Runs do not change your official score.</p>
          </div>
          <button type="button" className="qpp-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        {loading && <div className="qpp-loading">Loading question…</div>}
        {error && (
          <div className="qpp-error">
            <p>{error}</p>
            <button type="button" className="qpp-btn qpp-btn-secondary" onClick={loadPractice}>
              Retry
            </button>
          </div>
        )}

        {!loading && !error && payload && (
          <div className="qpp-body">
            {payload.questionType === 'coding' && (
              <>
                <div className="qpp-meta">
                  {q?.difficulty && (
                    <span className={`qpp-diff qpp-diff-${q.difficulty}`}>{q.difficulty}</span>
                  )}
                  <span className="qpp-meta-item">
                    Official: {payload.testCasesPassed ?? 0}/{payload.totalTestCases ?? 0} test cases
                  </span>
                  <span className="qpp-meta-item">
                    Score: {payload.points ?? 0}/{payload.maxPoints ?? 0}
                  </span>
                </div>

                {q?.description && (
                  <div
                    className="qpp-description"
                    dangerouslySetInnerHTML={{
                      __html: q.description.replace(/\n/g, '<br />'),
                    }}
                  />
                )}

                {visibleTestCases.length > 0 && (
                  <div className="qpp-samples">
                    <h4>Sample test cases (practice)</h4>
                    {visibleTestCases.map((tc, idx) => (
                      <div key={idx} className="qpp-sample">
                        <div><strong>In:</strong> <pre>{tc.input}</pre></div>
                        <div><strong>Expected:</strong> <pre>{tc.expectedOutput}</pre></div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="qpp-editor-toolbar">
                  <select
                    value={language}
                    onChange={(e) => {
                      const next = e.target.value;
                      setCodeByLanguage((prev) => ({
                        ...prev,
                        [language]: code,
                      }));
                      setLanguage(next);
                    }}
                    className="qpp-lang-select"
                  >
                    {(q?.allowedLanguages || ['python']).map((lang) => (
                      <option key={lang} value={lang}>
                        {lang.toUpperCase()}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="qpp-btn qpp-btn-run"
                    onClick={handleRunSample}
                    disabled={running || !visibleTestCases.length}
                  >
                    {running ? 'Running…' : '▶ Run sample tests'}
                  </button>
                </div>

                <div className="qpp-editor-wrap">
                  <MonacoCodeEditor
                    height="320px"
                    editorKey={`qpp-${questionId}-${language}`}
                    language={language}
                    value={code}
                    onChange={(v) => setCode(v || '')}
                  />
                </div>

                <div className="qpp-custom">
                  <h4>Custom test</h4>
                  <textarea
                    placeholder="Input"
                    value={customInput}
                    onChange={(e) => setCustomInput(e.target.value)}
                    rows={2}
                  />
                  <textarea
                    placeholder="Expected output (optional)"
                    value={customExpected}
                    onChange={(e) => setCustomExpected(e.target.value)}
                    rows={2}
                  />
                  <button
                    type="button"
                    className="qpp-btn qpp-btn-secondary"
                    onClick={handleRunCustom}
                    disabled={running || !customInput.trim()}
                  >
                    Run custom
                  </button>
                </div>

                {runResults && (
                  <div className={`qpp-results ${runResults.success === false ? 'failed' : ''}`}>
                    <h4>Run output</h4>
                    {runResults.error && <p className="qpp-run-error">{runResults.error}</p>}
                    {runResults.results?.map((r, i) => (
                      <div key={i} className={`qpp-run-row ${r.passed ? 'pass' : 'fail'}`}>
                        <span>{r.passed ? '✓ Passed' : '✗ Failed'}</span>
                        {r.actualOutput != null && (
                          <pre>Output: {r.actualOutput || '(empty)'}</pre>
                        )}
                        {r.error && <pre className="qpp-run-err">{r.error}</pre>}
                      </div>
                    ))}
                    {runResults.testCasesPassed != null && (
                      <p className="qpp-run-summary">
                        {runResults.testCasesPassed}/{runResults.total} passed
                      </p>
                    )}
                  </div>
                )}
              </>
            )}

            {payload.questionType === 'mcq' && q && (
              <div className="qpp-review">
                <p className="qpp-q-text">{q.question}</p>
                <div className="qpp-options">
                  {q.options?.map((opt, idx) => {
                    const selected = parseInt(payload.submittedAnswer, 10) === idx;
                    const correct = opt.isCorrect;
                    return (
                      <div
                        key={idx}
                        className={`qpp-opt ${correct ? 'correct' : ''} ${selected ? 'selected' : ''}`}
                      >
                        <span className="qpp-opt-letter">{String.fromCharCode(65 + idx)}.</span>
                        <span>{opt.text}</span>
                        {correct && <span className="qpp-opt-tag">Correct</span>}
                        {selected && <span className="qpp-opt-tag you">Your answer</span>}
                      </div>
                    );
                  })}
                </div>
                {q.explanation && (
                  <div className="qpp-explanation">
                    <strong>Explanation</strong>
                    <p>{q.explanation}</p>
                  </div>
                )}
                <p className="qpp-practice-note">
                  Review the solution above. Re-attempting MCQ in practice is view-only.
                </p>
              </div>
            )}

            {(payload.questionType === 'aptitude' || payload.questionType === 'theory' || payload.questionType === 'sql') && (
              <div className="qpp-review">
                <p className="qpp-practice-note">
                  Open the expanded card on the results page for full {payload.questionType} feedback.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default QuestionPracticePanel;
