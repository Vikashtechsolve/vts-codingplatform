import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { FiArrowLeft, FiPlay, FiSend, FiRotateCcw, FiCheck } from 'react-icons/fi';
import MonacoCodeEditor from '../../../components/MonacoCodeEditor';
import RichTextDisplay from '../../../components/RichTextDisplay';
import { isRichTextEmpty } from '../../../utils/richTextUtils';
import axiosInstance from '../../../utils/axios';
import PracticeLoading from '../../../components/Practice/PracticeLoading';
import PracticeEmptyState from '../../../components/Practice/PracticeEmptyState';
import PracticeStatusIcon from '../../../components/Practice/PracticeStatusIcon';
import {
  capitalize,
  formatLanguage,
  formatRelativeTime,
  formatScore,
  formatStatus,
  statusClass,
} from '../../../components/Practice/practiceUtils';
import { CODE_REQUEST_TIMEOUT_BATCH_MS } from '../../../config/codeExecution';
import '../../../styles/practice-solve.css';

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
const RUN_HINT = isMac ? '⌘↵' : 'Ctrl+Enter';
const SUBMIT_HINT = isMac ? '⌘⇧↵' : 'Ctrl+Shift+Enter';

function statusPill(status) {
  const st = statusClass(status);
  if (st === 'solved') return { className: 'psx-pill psx-pill--solved', label: 'Solved' };
  if (st === 'attempted') return { className: 'psx-pill psx-pill--attempted', label: 'Attempted' };
  return { className: 'psx-pill psx-pill--todo', label: 'Todo' };
}

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
  const [leftTab, setLeftTab] = useState('description');
  const [consoleTab, setConsoleTab] = useState('testcase');
  const [activeCase, setActiveCase] = useState(0);
  const [userStatus, setUserStatus] = useState('unsolved');
  const [attempts, setAttempts] = useState(0);
  const [bestScore, setBestScore] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [splitPct, setSplitPct] = useState(42);
  const [consoleH, setConsoleH] = useState(220);
  const [dragAxis, setDragAxis] = useState(null);
  const startTimeRef = useRef(Date.now());
  const editorRef = useRef(null);
  const editorWrapRef = useRef(null);
  const bodyRef = useRef(null);
  const codePaneRef = useRef(null);
  const dragRef = useRef(null);

  const loadQuestion = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const { data } = await axiosInstance.get(`/practice/questions/${questionId}`);
      setPayload(data);
      setUserStatus(data.userStatus || 'unsolved');
      setAttempts(data.attempts || 0);
      setBestScore(data.bestScore ?? null);
      setSubmissions(data.submissions || []);
      const langs = data.question?.allowedLanguages || ['python'];
      const lang = data.lastSubmission?.language && langs.includes(data.lastSubmission.language)
        ? data.lastSubmission.language
        : langs[0];
      setLanguage(lang);
      const starter = { ...(data.question?.starterCode || {}) };
      if (data.lastSubmission?.code) starter[lang] = data.lastSubmission.code;
      setCodeByLanguage(starter);
      startTimeRef.current = Date.now();
      setRunResults(null);
      setSubmitResult(null);
      setActiveCase(0);
      setLeftTab('description');
      setConsoleTab('testcase');
    } catch (err) {
      setLoadError(err.response?.data?.message || 'Failed to load question');
    } finally {
      setLoading(false);
    }
  }, [questionId]);

  useEffect(() => {
    loadQuestion();
  }, [loadQuestion]);

  useEffect(() => {
    const el = editorWrapRef.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(() => editorRef.current?.layout?.());
    ro.observe(el);
    return () => ro.disconnect();
  }, [loading]);

  const q = payload?.question;
  const code = codeByLanguage[language] ?? q?.starterCode?.[language] ?? '';
  const setCode = (next) => setCodeByLanguage((prev) => ({ ...prev, [language]: next }));
  const visibleCases = (q?.testCases || []).filter((tc) => !tc.isHidden);
  const activeTest = visibleCases[activeCase] || visibleCases[0];
  const busy = running || submitting;

  const handleRun = useCallback(async () => {
    if (!code.trim() || busy) return;
    setRunning(true);
    setRunResults(null);
    setSubmitResult(null);
    setConsoleTab('result');
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
  }, [busy, code, language, questionId]);

  const handleSubmit = useCallback(async () => {
    if (!code.trim() || busy) return;
    setSubmitting(true);
    setSubmitResult(null);
    setConsoleTab('result');
    const timeSpentMs = Date.now() - startTimeRef.current;
    try {
      const { data } = await axiosInstance.post(`/practice/questions/${questionId}/submit`, {
        code,
        language,
        timeSpentMs,
      });
      setSubmitResult(data);
      setRunResults(null);
      setUserStatus(data.accepted ? 'solved' : 'attempted');
      setAttempts((n) => n + 1);
      setBestScore((prev) => {
        const score = data.score ?? 0;
        return prev == null ? score : Math.max(prev, score);
      });
      setSubmissions((prev) => [
        {
          _id: data.submissionId || `local-${Date.now()}`,
          status: data.status,
          language,
          passedTests: data.passedTests,
          totalTests: data.totalTests,
          score: data.score,
          submittedAt: new Date().toISOString(),
          code,
          attemptNumber: data.attemptNumber,
        },
        ...prev,
      ]);
    } catch (err) {
      setSubmitResult({ accepted: false, error: err.response?.data?.message || 'Submit failed' });
    } finally {
      setSubmitting(false);
    }
  }, [busy, code, language, questionId]);

  useEffect(() => {
    const onKey = (e) => {
      const meta = e.metaKey || e.ctrlKey;
      if (!meta || e.key !== 'Enter') return;
      e.preventDefault();
      if (e.shiftKey) handleSubmit();
      else handleRun();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleRun, handleSubmit]);

  const resetCode = () => {
    const starter = q?.starterCode?.[language] ?? '';
    setCodeByLanguage((prev) => ({ ...prev, [language]: starter }));
  };

  const restoreSubmission = (sub) => {
    if (!sub?.code) return;
    setLanguage(sub.language || language);
    setCodeByLanguage((prev) => ({ ...prev, [sub.language || language]: sub.code }));
    setLeftTab('description');
  };

  const onGutterDown = (axis) => (e) => {
    e.preventDefault();
    const parent = (axis === 'x' ? bodyRef.current : codePaneRef.current)?.getBoundingClientRect();
    if (!parent) return;
    dragRef.current = { axis, parent };
    setDragAxis(axis);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onGutterMove = (e) => {
    const drag = dragRef.current;
    if (!drag) return;
    if (drag.axis === 'x') {
      const pct = ((e.clientX - drag.parent.left) / drag.parent.width) * 100;
      setSplitPct(Math.min(62, Math.max(28, pct)));
    } else {
      const height = drag.parent.bottom - e.clientY;
      setConsoleH(Math.min(420, Math.max(140, height)));
    }
  };

  const onGutterUp = () => {
    dragRef.current = null;
    setDragAxis(null);
  };

  if (loading) {
    return (
      <div className="psx">
        <PracticeLoading message="Loading problem…" />
      </div>
    );
  }

  if (loadError || !q) {
    return (
      <div className="psx">
        <PracticeEmptyState
          title="Problem not found"
          description={loadError || 'This question may have been removed.'}
          actionLabel="Back to problems"
          actionTo="/student/practice/problems"
        />
      </div>
    );
  }

  const pill = statusPill(userStatus);
  const samplePassed = runResults
    && !runResults.error
    && runResults.success !== false
    && runResults.testCasesPassed === runResults.total;
  const resultRows = submitResult?.batchResult?.results || runResults?.results || [];
  const caseOutcome = (i) => {
    const row = (runResults?.results || [])[i];
    if (!row) return '';
    return row.passed ? ' is-pass' : ' is-fail';
  };

  return (
    <div className={`psx ${dragAxis === 'x' ? 'is-dragging' : ''} ${dragAxis === 'y' ? 'is-dragging-y' : ''}`}>
      <header className="psx-topbar">
        <Link to="/student/practice/problems" className="psx-back">
          <FiArrowLeft aria-hidden /> Problems
        </Link>
        <h1 className="psx-topbar-title">{q.title}</h1>
        <div className="psx-topbar-meta">
          <span className={pill.className}>
            {userStatus === 'solved' ? <FiCheck aria-hidden /> : null}
            {pill.label}
          </span>
          <span className={`psx-diff psx-diff--${q.difficulty}`}>{capitalize(q.difficulty)}</span>
        </div>
        <div className="psx-topbar-spacer" />
        <div className="psx-topbar-stats">
          {attempts > 0 ? (
            <span>Best {formatScore(bestScore)} · {attempts} attempt{attempts === 1 ? '' : 's'}</span>
          ) : (
            <span>Not attempted yet</span>
          )}
        </div>
      </header>

      <div className="psx-body" ref={bodyRef}>
        <section className="psx-pane psx-pane--desc" style={{ width: `${splitPct}%` }}>
          <div className="psx-tabs" role="tablist">
            <button
              type="button"
              className={`psx-tab ${leftTab === 'description' ? 'is-active' : ''}`}
              onClick={() => setLeftTab('description')}
            >
              Description
            </button>
            <button
              type="button"
              className={`psx-tab ${leftTab === 'submissions' ? 'is-active' : ''}`}
              onClick={() => setLeftTab('submissions')}
            >
              Submissions{attempts ? ` (${attempts})` : ''}
            </button>
          </div>

          {leftTab === 'description' ? (
            <div className="psx-scroll">
              <div className="psx-problem-head">
                <h1>{q.title}</h1>
                <div className="psx-chip-row">
                  <PracticeStatusIcon status={userStatus} size={16} showLabel />
                  <span className={`psx-diff psx-diff--${q.difficulty}`}>{capitalize(q.difficulty)}</span>
                  {(q.practiceTopics || []).map((t) => (
                    <span key={t._id} className="psx-topic">{t.label}</span>
                  ))}
                </div>
              </div>

              {q.description && (
                <RichTextDisplay content={q.description} />
              )}

              {(q.examples || []).length > 0 && (
                <div className="psx-section">
                  <h2 className="psx-section-title">Examples</h2>
                  {q.examples.map((ex, i) => (
                    <article key={i} className="psx-example">
                      <p className="psx-example-kicker">Example {i + 1}</p>
                      <div className="psx-kv"><span>Input</span><pre>{ex.input}</pre></div>
                      <div className="psx-kv"><span>Output</span><pre>{ex.output}</pre></div>
                      {ex.explanation && (
                        <p className="psx-note">{ex.explanation}</p>
                      )}
                    </article>
                  ))}
                </div>
              )}

              {!isRichTextEmpty(q.constraints) && (
                <div className="psx-section">
                  <h2 className="psx-section-title">Constraints</h2>
                  <RichTextDisplay content={q.constraints} className="practice-constraints-content" />
                </div>
              )}
            </div>
          ) : (
            <div className="psx-scroll">
              {!submissions.length ? (
                <PracticeEmptyState
                  title="No submissions yet"
                  description="Run the sample cases, then submit to see verdict, score, and history."
                />
              ) : (
                <>
                  <div className="psx-sub-list">
                    {submissions.map((s) => {
                      const ok = s.status === 'accepted';
                      return (
                        <button
                          key={s._id}
                          type="button"
                          className="psx-sub"
                          onClick={() => restoreSubmission(s)}
                        >
                          <span className={`psx-sub-status ${ok ? 'is-ok' : 'is-bad'}`}>
                            {formatStatus(s.status)}
                          </span>
                          <span>{formatScore(s.score)}</span>
                          <span>{s.passedTests}/{s.totalTests}</span>
                          <span>{formatLanguage(s.language)}</span>
                          <span className="psx-hint" style={{ margin: 0 }}>{formatRelativeTime(s.submittedAt)}</span>
                        </button>
                      );
                    })}
                  </div>
                  <p className="psx-hint">Click a submission to restore that code in the editor.</p>
                </>
              )}
            </div>
          )}
        </section>

        <div
          className="psx-gutter"
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize problem and editor"
          onPointerDown={onGutterDown('x')}
          onPointerMove={onGutterMove}
          onPointerUp={onGutterUp}
        />

        <section className="psx-pane psx-pane--code" ref={codePaneRef}>
          <div className="psx-toolbar">
            <span className="psx-toolbar-label">Code</span>
            <select
              className="psx-select"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              aria-label="Language"
            >
              {(q.allowedLanguages || ['python']).map((l) => (
                <option key={l} value={l}>{formatLanguage(l)}</option>
              ))}
            </select>
            <div className="psx-toolbar-actions">
              <button
                type="button"
                className="psx-btn psx-btn--ghost"
                onClick={resetCode}
                disabled={busy}
              >
                <FiRotateCcw aria-hidden /> Reset
              </button>
              <button
                type="button"
                className="psx-btn psx-btn--run"
                onClick={handleRun}
                disabled={busy || !code.trim()}
              >
                <FiPlay aria-hidden /> {running ? 'Running…' : 'Run'}
                <span className="psx-kbd">{RUN_HINT}</span>
              </button>
              <button
                type="button"
                className="psx-btn psx-btn--submit"
                onClick={handleSubmit}
                disabled={busy || !code.trim()}
              >
                <FiSend aria-hidden /> {submitting ? 'Submitting…' : 'Submit'}
                <span className="psx-kbd" style={{ color: 'inherit', opacity: 0.8 }}>{SUBMIT_HINT}</span>
              </button>
            </div>
          </div>

          <div className="psx-editor" ref={editorWrapRef}>
            <MonacoCodeEditor
              language={language}
              value={code}
              onChange={setCode}
              height="100%"
              onEditorMount={(ed) => { editorRef.current = ed; }}
            />
          </div>

          <div
            className="psx-gutter-y"
            role="separator"
            aria-orientation="horizontal"
            aria-label="Resize test console"
            onPointerDown={onGutterDown('y')}
            onPointerMove={onGutterMove}
            onPointerUp={onGutterUp}
          />

          <div className="psx-console" style={{ height: consoleH }}>
            <div className="psx-tabs" role="tablist">
              <button
                type="button"
                className={`psx-tab ${consoleTab === 'testcase' ? 'is-active' : ''}`}
                onClick={() => setConsoleTab('testcase')}
              >
                Testcases
              </button>
              <button
                type="button"
                className={`psx-tab ${consoleTab === 'result' ? 'is-active' : ''}`}
                onClick={() => setConsoleTab('result')}
              >
                Result
              </button>
            </div>

            {consoleTab === 'testcase' ? (
              <div className="psx-console-body">
                {visibleCases.length ? (
                  <>
                    <div className="psx-cases">
                      {visibleCases.map((_, i) => (
                        <button
                          key={i}
                          type="button"
                          className={`psx-case${activeCase === i ? ' is-active' : ''}${caseOutcome(i)}`}
                          onClick={() => setActiveCase(i)}
                        >
                          Case {i + 1}
                        </button>
                      ))}
                    </div>
                    {activeTest && (
                      <>
                        <div className="psx-kv"><span>Input</span><pre>{activeTest.input}</pre></div>
                        {activeTest.expectedOutput != null && (
                          <div className="psx-kv"><span>Expected</span><pre>{activeTest.expectedOutput}</pre></div>
                        )}
                      </>
                    )}
                  </>
                ) : (
                  <p className="psx-empty">No public sample cases. Submit to run the hidden tests.</p>
                )}
              </div>
            ) : (
              <div className="psx-console-body">
                {busy && (
                  <p className="psx-empty">{submitting ? 'Judging against all test cases…' : 'Running sample cases…'}</p>
                )}
                {!busy && !submitResult && !runResults && (
                  <p className="psx-empty">Run sample tests, or submit for a full verdict and score.</p>
                )}
                {submitResult && (
                  <div className={`psx-verdict ${submitResult.accepted ? 'is-ok' : 'is-bad'}`}>
                    <strong>{submitResult.accepted ? 'Accepted' : (submitResult.error || formatStatus(submitResult.status))}</strong>
                    <span>{submitResult.passedTests ?? 0}/{submitResult.totalTests ?? 0} tests · {formatScore(submitResult.score)}</span>
                  </div>
                )}
                {runResults && !submitResult && (
                  <div className={`psx-verdict ${samplePassed ? 'is-ok' : 'is-bad'}`}>
                    <strong>
                      {runResults.error ? 'Run failed' : samplePassed ? 'Sample cases passed' : 'Wrong answer'}
                    </strong>
                    <span>
                      {runResults.error
                        ? runResults.error
                        : `${runResults.testCasesPassed ?? 0}/${runResults.total ?? visibleCases.length} sample tests`}
                    </span>
                  </div>
                )}
                {resultRows.length > 0 && (
                  <div className="psx-result">
                    {resultRows.map((r, i) => {
                      const tc = (q.testCases || [])[i];
                      const hidden = !!tc?.isHidden;
                      return (
                        <div key={i} className={`psx-result-row ${r.passed ? 'is-pass' : 'is-fail'}`}>
                          <span>{r.passed ? '✓' : '✗'}</span>
                          <span>{hidden ? `Hidden case ${i + 1}` : `Case ${i + 1}`}</span>
                          {!hidden && r.error && <span>{r.error}</span>}
                          {!hidden && r.output != null && !r.passed && (
                            <pre>Got: {String(r.output)}</pre>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

export default PracticeSolve;
