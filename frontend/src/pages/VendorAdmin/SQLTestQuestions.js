import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import axiosInstance from '../../utils/axios';
import { getPlatformTestConfig, getPlatformSqlQuestionsApi } from '../../utils/platformMode';
import './SQLTestQuestions.css';

const SQLTestQuestions = () => {
  const { testId } = useParams();
  const location = useLocation();
  const platformConfig = getPlatformTestConfig(location.pathname);
  const sqlApi = getPlatformSqlQuestionsApi(testId, location.pathname);

  const [test, setTest] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [validateResult, setValidateResult] = useState(null);
  const [modal, setModal] = useState({ open: false, mode: 'add', question: null });
  const [form, setForm] = useState({ text: '', marks: 10, correctSql: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [runResult, setRunResult] = useState(null);
  const [isRunningQuery, setIsRunningQuery] = useState(false);

  const backPath = platformConfig.isPlatform
    ? '/super-admin/tests?type=sql'
    : '/vendor-admin/tests?type=sql';

  const fetchTest = useCallback(async () => {
    try {
      const res = await axiosInstance.get(`${platformConfig.testsApiBase}/${testId}`);
      setTest(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Test not found');
    }
  }, [platformConfig.testsApiBase, testId]);

  const fetchQuestions = useCallback(async () => {
    try {
      const res = await axiosInstance.get(sqlApi.list);
      setQuestions(res.data || []);
    } catch (err) {
      console.error(err);
    }
  }, [sqlApi.list]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await fetchTest();
      await fetchQuestions();
      setLoading(false);
    };
    load();
  }, [fetchTest, fetchQuestions]);

  const handleValidate = async () => {
    setValidateResult(null);
    try {
      const res = await axiosInstance.post(sqlApi.validate);
      setValidateResult(res.data);
    } catch (err) {
      setValidateResult({
        valid: false,
        results: [],
        error: err.response?.data?.message || 'Validation failed',
      });
    }
  };

  const openAdd = () => {
    setForm({ text: '', marks: 10, correctSql: '' });
    setModal({ open: true, mode: 'add', question: null });
    setError('');
    setRunResult(null);
  };

  const openEdit = (q) => {
    setForm({ text: q.text, marks: q.marks, correctSql: '' });
    setModal({ open: true, mode: 'edit', question: q });
    setError('');
    setRunResult(null);
  };

  const closeModal = () => {
    setModal({ open: false, mode: 'add', question: null });
    setRunResult(null);
  };

  const handleRunQuery = async () => {
    const query = form.correctSql?.trim();
    if (!query) {
      setRunResult({ success: false, rows: [], error: 'Enter a query first.' });
      return;
    }
    setRunResult(null);
    setIsRunningQuery(true);
    try {
      const res = await axiosInstance.post(sqlApi.runQuery, { query });
      setRunResult(res.data);
    } catch (err) {
      setRunResult({
        success: false,
        rows: [],
        error: err.response?.data?.message || err.response?.data?.error || 'Failed to run query',
      });
    } finally {
      setIsRunningQuery(false);
    }
  };

  const handleSaveQuestion = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      if (modal.mode === 'add') {
        await axiosInstance.post(sqlApi.create, {
          text: form.text,
          marks: Number(form.marks),
          correctSql: form.correctSql,
          order: questions.length,
        });
      } else {
        await axiosInstance.put(sqlApi.update(modal.question._id), {
          text: form.text,
          marks: Number(form.marks),
          ...(form.correctSql.trim() ? { correctSql: form.correctSql } : {}),
        });
      }
      await fetchQuestions();
      closeModal();
    } catch (err) {
      const msg =
        err.response?.data?.message || err.response?.data?.errors?.[0]?.msg || 'Save failed';
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this question?')) return;
    try {
      await axiosInstance.delete(sqlApi.delete(id));
      await fetchQuestions();
    } catch (err) {
      alert(err.response?.data?.message || 'Delete failed');
    }
  };

  const pageStyle = { '--va-accent': '#ca8a04' };

  if (loading) {
    return (
      <div className="va-page sql-test-questions" style={pageStyle}>
        <div className="va-loading">
          <div className="va-spinner" />
          <p>Loading SQL questions…</p>
        </div>
      </div>
    );
  }

  if (!test) {
    return (
      <div className="va-page sql-test-questions" style={pageStyle}>
        <div className="sql-test-questions-error">{error || 'Test not found'}</div>
        <Link to={backPath} className="va-btn va-btn--secondary">
          Back to tests
        </Link>
      </div>
    );
  }

  if (test.type !== 'sql') {
    return (
      <div className="va-page sql-test-questions" style={pageStyle}>
        <p className="page-meta">Not an SQL test.</p>
        <Link to={backPath} className="va-btn va-btn--secondary">
          Back to tests
        </Link>
      </div>
    );
  }

  return (
    <div className="va-page sql-test-questions" style={pageStyle}>
      <header className="va-header">
        <div>
          <Link to={backPath} className="va-back">← Back to tests</Link>
          <p className="va-eyebrow">SQL assessment</p>
          <h1 className="va-title">{test.title}</h1>
          <p className="va-subtitle">
            Dataset: {test.datasetTemplate?.name || '—'} · Duration: {test.duration} min
          </p>
        </div>
        <div className="va-header-actions">
          <button type="button" className="va-btn va-btn--secondary" onClick={handleValidate}>
            Validate all
          </button>
          {!platformConfig.isPlatform && (
            <Link to={`/vendor-admin/tests/${testId}/assign`} className="va-btn va-btn--primary">
              Assign to students
            </Link>
          )}
          {platformConfig.isPlatform && (
            <Link
              to={`/super-admin/tests/${testId}/allocate`}
              className="va-btn va-btn--primary"
            >
              Allocate to vendors
            </Link>
          )}
        </div>
      </header>

      {validateResult && (
        <div className={`validate-result ${validateResult.valid ? 'valid' : 'invalid'}`}>
          <strong>{validateResult.valid ? 'All queries run successfully.' : 'Some queries failed.'}</strong>
          {validateResult.results?.length > 0 && (
            <ul>
              {validateResult.results.map((r, i) => (
                <li key={i}>
                  {r.text}: {r.success ? 'OK' : r.error}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="questions-toolbar">
        <button type="button" className="va-btn va-btn--primary" onClick={openAdd}>
          Add question
        </button>
      </div>

      {questions.length === 0 ? (
        <div className="empty-state">
          <p>
            No questions yet. Add questions with correct SQL; the system will compute expected
            output for evaluation.
          </p>
        </div>
      ) : (
        <div className="questions-list">
          {questions.map((q, idx) => (
            <div key={q._id} className="question-card">
              <div className="question-card-header">
                <span className="q-num">Q{idx + 1}</span>
                <span className="q-marks">{q.marks} mark(s)</span>
              </div>
              <p className="question-text">{q.text}</p>
              <div className="question-actions">
                <button type="button" className="va-btn va-btn--secondary va-btn--sm" onClick={() => openEdit(q)}>
                  Edit
                </button>
                <button type="button" className="va-btn va-btn--danger va-btn--sm" onClick={() => handleDelete(q._id)}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal.open && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="sql-question-modal" onClick={(e) => e.stopPropagation()}>
            <h2>{modal.mode === 'add' ? 'Add SQL question' : 'Edit SQL question'}</h2>
            {error && <div className="sql-test-questions-error">{error}</div>}
            <form onSubmit={handleSaveQuestion}>
              <div className="form-group">
                <label>Question text *</label>
                <textarea
                  value={form.text}
                  onChange={(e) => setForm((f) => ({ ...f, text: e.target.value }))}
                  rows={3}
                  required
                />
              </div>
              <div className="form-group">
                <label>Marks *</label>
                <input
                  type="number"
                  min={1}
                  value={form.marks}
                  onChange={(e) => setForm((f) => ({ ...f, marks: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label>
                  Correct SQL {modal.mode === 'add' ? '*' : ''} (used to generate expected output;
                  not shown to students)
                </label>
                <textarea
                  value={form.correctSql}
                  onChange={(e) => setForm((f) => ({ ...f, correctSql: e.target.value }))}
                  rows={8}
                  placeholder={
                    modal.mode === 'edit' ? 'Leave blank to keep existing correct SQL' : 'SELECT ...'
                  }
                  required={modal.mode === 'add'}
                  className="sql-textarea"
                />
                <button
                  type="button"
                  className="va-btn va-btn--secondary btn-run-query"
                  onClick={handleRunQuery}
                  disabled={isRunningQuery || !form.correctSql?.trim()}
                >
                  {isRunningQuery ? 'Running...' : 'Run query'}
                </button>
              </div>
              {runResult && (
                <div className={`vendor-query-output ${runResult.success ? 'success' : 'error'}`}>
                  {runResult.success ? (
                    runResult.rows && runResult.rows.length > 0 ? (
                      <div className="vendor-query-table-wrap">
                        <table className="vendor-query-table">
                          <thead>
                            <tr>
                              {Object.keys(runResult.rows[0]).map((k) => (
                                <th key={k}>{k}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {runResult.rows.map((row, i) => (
                              <tr key={i}>
                                {Object.keys(runResult.rows[0]).map((k) => (
                                  <td key={k}>{row[k] != null ? String(row[k]) : ''}</td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="vendor-query-empty">No rows returned.</p>
                    )
                  ) : (
                    <p className="vendor-query-error">{runResult.error}</p>
                  )}
                </div>
              )}
              <div className="form-actions">
                <button type="submit" className="va-btn va-btn--primary" disabled={saving}>
                  {saving ? 'Saving...' : 'Save'}
                </button>
                <button type="button" className="va-btn va-btn--secondary" onClick={closeModal}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SQLTestQuestions;
