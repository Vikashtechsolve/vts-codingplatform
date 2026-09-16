import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { FiArrowLeft, FiPlay, FiSend } from 'react-icons/fi';
import MonacoCodeEditor from '../../../components/MonacoCodeEditor';
import RichTextDisplay from '../../../components/RichTextDisplay';
import axiosInstance from '../../../utils/axios';
import PracticeLoading from '../../../components/Practice/PracticeLoading';
import PracticeEmptyState from '../../../components/Practice/PracticeEmptyState';
import { capitalize, formatStatus, statusClass } from '../../../components/Practice/practiceUtils';
import {
  CODE_REQUEST_TIMEOUT_BATCH_MS,
} from '../../../config/codeExecution';
import '../../../styles/practice-pages.css';

const PracticeSolve = () => {
  const { questionId } = useParams();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [payload, setPayload] = useState(null);
  const [codeByLanguage, setCodeByLanguage] = useState({});
  const [language, setLanguage] = useState('python');
  const [running, setRunning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [runResults, setRunResults] = useState(null);
  const [submitResult, setSubmitResult] = useState(null);
  const startTimeRef = useRef(Date.now());

  const loadQuestion = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const { data } = await axiosInstance.get(`/practice/questions/${questionId}`);
      setPayload(data);
      const langs = data.question?.allowedLanguages || ['python'];
      const lang = data.lastSubmission?.language && langs.includes(data.lastSubmission.language)
        ? data.lastSubmission.language
        : langs[0];
      setLanguage(lang);
      const starter = { ...(data.question?.starterCode || {}) };
      if (data.lastSubmission?.code) {
        starter[lang] = data.lastSubmission.code;
      }
      setCodeByLanguage(starter);
      startTimeRef.current = Date.now();
      setRunResults(null);
      setSubmitResult(null);
    } catch (err) {
      setLoadError(err.response?.data?.message || 'Failed to load question');
    } finally {
      setLoading(false);
    }
  }, [questionId]);

  useEffect(() => {
    loadQuestion();
  }, [loadQuestion]);

  const q = payload?.question;
  const code = codeByLanguage[language] ?? q?.starterCode?.[language] ?? '';
  const setCode = (next) => setCodeByLanguage((prev) => ({ ...prev, [language]: next }));
  const visibleCases = (q?.testCases || []).filter((tc) => !tc.isHidden);

  const handleRun = async () => {
    if (!code.trim()) return;
    setRunning(true);
    setRunResults(null);
    try {
      const { data } = await axiosInstance.post(
        `/practice/questions/${questionId}/run`,
        { code, language },
        { timeout: CODE_REQUEST_TIMEOUT_BATCH_MS }
      );
      setRunResults(data);
    } catch (err) {
      setRunResults({ success: false, error: err.response?.data?.message || 'Run failed' });
    } finally {
      setRunning(false);
    }
  };

  const handleSubmit = async () => {
    if (!code.trim()) return;
    setSubmitting(true);
    setSubmitResult(null);
    const timeSpentMs = Date.now() - startTimeRef.current;
    try {
      const { data } = await axiosInstance.post(`/practice/questions/${questionId}/submit`, {
        code,
        language,
        timeSpentMs,
      });
      setSubmitResult(data);
      if (data.accepted) loadQuestion();
    } catch (err) {
      setSubmitResult({ accepted: false, error: err.response?.data?.message || 'Submit failed' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="practice-solve-page">
        <PracticeLoading message="Loading problem…" />
      </div>
    );
  }

  if (loadError || !q) {
    return (
      <div className="practice-solve-page">
        <PracticeEmptyState
          title="Problem not found"
          description={loadError || 'This question may have been removed.'}
          actionLabel="Back to problems"
          actionTo="/student/practice/problems"
        />
      </div>
    );
  }

  return (
    <div className="practice-solve-page">
      <div className="practice-solve-layout">
        <div className="practice-solve-left">
          <Link to="/student/practice/problems" className="practice-solve-back">
            <FiArrowLeft aria-hidden /> Back to problems
          </Link>

          <h1 className="practice-solve-title">{q.title}</h1>

          <div className="practice-problem-meta" style={{ marginBottom: 20 }}>
            <span className={`practice-diff practice-diff-${q.difficulty}`}>
              {capitalize(q.difficulty)}
            </span>
            <span className={`practice-status practice-status-${statusClass(payload.userStatus)}`}>
              {formatStatus(payload.userStatus)}
            </span>
            {(q.practiceTopics || []).map((t) => (
              <span key={t._id} className="practice-topic-chip">{t.label}</span>
            ))}
          </div>

          {q.description && (
            <div className="practice-solve-block rich-text-display">
              <RichTextDisplay content={q.description} />
            </div>
          )}

          {q.constraints && (
            <div className="practice-solve-block">
              <h4>Constraints</h4>
              <p style={{ margin: 0, color: 'var(--text-secondary)', lineHeight: 1.55 }}>{q.constraints}</p>
            </div>
          )}

          {(q.examples || []).length > 0 && (
            <div className="practice-solve-block">
              <h4>Examples</h4>
              {q.examples.map((ex, i) => (
                <div key={i} className="practice-example-box">
                  <div><strong>Input</strong><pre>{ex.input}</pre></div>
                  <div><strong>Output</strong><pre>{ex.output}</pre></div>
                  {ex.explanation && <div><strong>Explanation</strong><p style={{ margin: '4px 0 0' }}>{ex.explanation}</p></div>}
                </div>
              ))}
            </div>
          )}

          {visibleCases.length > 0 && (
            <div className="practice-solve-block">
              <h4>Sample test cases</h4>
              {visibleCases.map((tc, i) => (
                <div key={i} className="practice-example-box">
                  <div><strong>Input</strong><pre>{tc.input}</pre></div>
                  <div><strong>Expected</strong><pre>{tc.expectedOutput}</pre></div>
                </div>
              ))}
            </div>
          )}

          {runResults && (
            <div className={`practice-run-results ${runResults.error || runResults.success === false ? 'is-error' : ''}`}>
              <strong>Run results</strong>
              {runResults.error ? (
                <p style={{ margin: '8px 0 0' }}>{runResults.error}</p>
              ) : (
                <>
                  <p style={{ margin: '8px 0' }}>
                    Passed {runResults.testCasesPassed ?? 0} / {runResults.total ?? visibleCases.length}
                  </p>
                  {(runResults.results || []).map((r, i) => (
                    <div key={i} className="practice-run-case">
                      <span>{r.passed ? '✓' : '✗'}</span>
                      <span>Test case {i + 1}</span>
                      {r.error && <span style={{ color: 'var(--practice-danger)' }}>{r.error}</span>}
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </div>

        <div className="practice-solve-right">
          <div className="practice-solve-toolbar">
            <select value={language} onChange={(e) => setLanguage(e.target.value)} aria-label="Language">
              {(q.allowedLanguages || ['python']).map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
            <button
              type="button"
              className="practice-btn practice-btn-secondary"
              onClick={handleRun}
              disabled={running || submitting || !code.trim()}
            >
              <FiPlay aria-hidden /> {running ? 'Running…' : 'Run'}
            </button>
            <button
              type="button"
              className="practice-btn practice-btn-success"
              onClick={handleSubmit}
              disabled={running || submitting || !code.trim()}
            >
              <FiSend aria-hidden /> {submitting ? 'Submitting…' : 'Submit'}
            </button>
          </div>

          {submitResult && (
            <div className={`practice-result-banner ${submitResult.accepted ? 'practice-result-accepted' : 'practice-result-failed'}`}>
              {submitResult.accepted
                ? `Accepted! ${submitResult.passedTests}/${submitResult.totalTests} test cases passed.`
                : submitResult.error || `Wrong answer — ${submitResult.passedTests ?? 0}/${submitResult.totalTests ?? '?'} passed`}
            </div>
          )}

          <div className="practice-editor-wrap">
            <MonacoCodeEditor
              language={language}
              value={code}
              onChange={setCode}
              height="100%"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default PracticeSolve;
