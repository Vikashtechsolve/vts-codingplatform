import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import axiosInstance from '../../utils/axios';
import './SQLTestQuestions.css';

const SQLTestQuestions = () => {
  const { testId } = useParams();
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

  const fetchTest = useCallback(async () => {
    try {
      const res = await axiosInstance.get(`/tests/${testId}`);
      setTest(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Test not found');
    }
  }, [testId]);

  const fetchQuestions = useCallback(async () => {
    try {
      const res = await axiosInstance.get(`/sql-questions/test/${testId}`);
      setQuestions(res.data || []);
    } catch (err) {
      console.error(err);
    }
  }, [testId]);

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
      const res = await axiosInstance.post(`/sql-questions/test/${testId}/validate`);
      setValidateResult(res.data);
    } catch (err) {
      setValidateResult({ valid: false, results: [], error: err.response?.data?.message || 'Validation failed' });
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
      const res = await axiosInstance.post(`/sql-questions/test/${testId}/run-query`, { query });
      setRunResult(res.data);
    } catch (err) {
      setRunResult({
        success: false,
        rows: [],
        error: err.response?.data?.message || err.response?.data?.error || 'Failed to run query'
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
        await axiosInstance.post('/sql-questions', {
          testId,
          text: form.text,
          marks: Number(form.marks),
          correctSql: form.correctSql,
          order: questions.length
        });
      } else {
        await axiosInstance.put(`/sql-questions/${modal.question._id}`, {
          text: form.text,
          marks: Number(form.marks),
          ...(form.correctSql.trim() ? { correctSql: form.correctSql } : {})
        });
      }
      await fetchQuestions();
      closeModal();
    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data?.errors?.[0]?.msg || 'Save failed';
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this question?')) return;
    try {
      await axiosInstance.delete(`/sql-questions/${id}`);
      await fetchQuestions();
    } catch (err) {
      alert(err.response?.data?.message || 'Delete failed');
    }
  };

  if (loading) return <div className="container vendor-dashboard"><div className="loading">Loading...</div></div>;
  if (!test) return <div className="container vendor-dashboard"><div className="error-message">{error || 'Test not found'}</div><Link to="/vendor-admin/tests" className="btn btn-secondary">Back to tests</Link></div>;
  if (test.type !== 'sql') return <div className="container vendor-dashboard"><p>Not an SQL test.</p><Link to="/vendor-admin/tests" className="btn btn-secondary">Back to tests</Link></div>;

  return (
    <div className="container vendor-dashboard sql-test-questions">
      <div className="page-header-row">
        <div>
          <h1 className="page-title">SQL questions: {test.title}</h1>
          <p className="page-meta">Dataset: {test.datasetTemplate?.name || '—'} · Duration: {test.duration} min</p>
        </div>
        <div className="header-actions">
          <button type="button" className="btn btn-secondary" onClick={handleValidate}>Validate all</button>
          <Link to={`/vendor-admin/tests/${testId}/assign`} className="btn btn-primary">Assign to students</Link>
          <Link to="/vendor-admin/tests" className="btn btn-secondary">Back to tests</Link>
        </div>
      </div>

      {validateResult && (
        <div className={`validate-result ${validateResult.valid ? 'valid' : 'invalid'}`}>
          <strong>{validateResult.valid ? 'All queries run successfully.' : 'Some queries failed.'}</strong>
          {validateResult.results?.length > 0 && (
            <ul>
              {validateResult.results.map((r, i) => (
                <li key={i}>{r.text}: {r.success ? 'OK' : r.error}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="questions-toolbar">
        <button type="button" className="btn btn-primary" onClick={openAdd}>Add question</button>
      </div>

      {questions.length === 0 ? (
        <div className="empty-state">
          <p>No questions yet. Add questions with correct SQL; the system will compute expected output for evaluation.</p>
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
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => openEdit(q)}>Edit</button>
                <button type="button" className="btn btn-danger btn-sm" onClick={() => handleDelete(q._id)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal.open && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content sql-question-modal" onClick={e => e.stopPropagation()}>
            <h3>{modal.mode === 'add' ? 'Add question' : 'Edit question'}</h3>
            {error && <div className="error-message">{error}</div>}
            <form onSubmit={handleSaveQuestion}>
              <div className="form-group">
                <label>Question text *</label>
                <textarea
                  value={form.text}
                  onChange={e => setForm(f => ({ ...f, text: e.target.value }))}
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
                  onChange={e => setForm(f => ({ ...f, marks: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label>Correct SQL {modal.mode === 'add' ? '*' : ''} (used to generate expected output; not shown to students)</label>
                <textarea
                  value={form.correctSql}
                  onChange={e => setForm(f => ({ ...f, correctSql: e.target.value }))}
                  rows={8}
                  placeholder={modal.mode === 'edit' ? 'Leave blank to keep existing correct SQL' : 'SELECT ...'}
                  required={modal.mode === 'add'}
                  className="sql-textarea"
                />
                <button
                  type="button"
                  className="btn btn-secondary btn-run-query"
                  onClick={handleRunQuery}
                  disabled={isRunningQuery || !form.correctSql?.trim()}
                >
                  {isRunningQuery ? 'Running...' : '▶ Run query'}
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
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
                <button type="button" className="btn btn-secondary" onClick={closeModal}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SQLTestQuestions;
