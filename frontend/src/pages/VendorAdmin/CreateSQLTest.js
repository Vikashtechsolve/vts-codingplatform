import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Link } from 'react-router-dom';
import axiosInstance from '../../utils/axios';
import './CreateSQLTest.css';

const CreateSQLTest = () => {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState([]);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    duration: 60,
    startDate: '',
    endDate: '',
    datasetTemplateId: ''
  });
  const [loading, setLoading] = useState(false);
  const [fetchingTemplates, setFetchingTemplates] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await axiosInstance.get('/dataset-templates');
        setTemplates(res.data || []);
      } catch (err) {
        setError('Failed to load dataset templates');
      } finally {
        setFetchingTemplates(false);
      }
    })();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!formData.datasetTemplateId) {
      setError('Please select a dataset template.');
      return;
    }
    setLoading(true);
    try {
      const res = await axiosInstance.post('/tests', {
        title: formData.title,
        description: formData.description,
        type: 'sql',
        duration: Number(formData.duration),
        startDate: formData.startDate || undefined,
        endDate: formData.endDate || undefined,
        datasetTemplateId: formData.datasetTemplateId,
        questions: []
      });
      navigate(`/vendor-admin/sql-tests/${res.data._id}/questions`);
    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data?.errors?.[0]?.msg || 'Create failed';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  if (fetchingTemplates) {
    return <div className="container vendor-dashboard"><div className="loading">Loading...</div></div>;
  }

  return (
    <div className="container vendor-dashboard create-sql-test">
      <div className="page-header-row">
        <h1 className="page-title">Create SQL Test</h1>
        <Link to="/vendor-admin/tests" className="btn btn-secondary">Back to tests</Link>
      </div>
      <p className="page-description">
        Create a new SQL test. Choose a dataset template; then add questions with correct SQL. Evaluation is based on query output, not the query text.
      </p>
      {templates.length === 0 && (
        <div className="info-banner">
          Create at least one <Link to="/vendor-admin/dataset-templates/create">dataset template</Link> before creating an SQL test.
        </div>
      )}
      {error && <div className="error-message">{error}</div>}
      <form onSubmit={handleSubmit} className="sql-test-form">
        <div className="form-group">
          <label>Test title *</label>
          <input
            type="text"
            name="title"
            value={formData.title}
            onChange={handleChange}
            placeholder="e.g. SQL Basics – HR Database"
            required
          />
        </div>
        <div className="form-group">
          <label>Description</label>
          <input
            type="text"
            name="description"
            value={formData.description}
            onChange={handleChange}
            placeholder="Optional description"
          />
        </div>
        <div className="form-group">
          <label>Duration (minutes) *</label>
          <input
            type="number"
            name="duration"
            min={1}
            value={formData.duration}
            onChange={handleChange}
            required
          />
        </div>
        <div className="form-group">
          <label>Dataset template *</label>
          <select
            name="datasetTemplateId"
            value={formData.datasetTemplateId}
            onChange={handleChange}
            required
          >
            <option value="">Select a template</option>
            {templates.map(t => (
              <option key={t._id} value={t._id}>{t.name} ({t.domain})</option>
            ))}
          </select>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Start date/time</label>
            <input
              type="datetime-local"
              name="startDate"
              value={formData.startDate}
              onChange={handleChange}
            />
          </div>
          <div className="form-group">
            <label>End date/time</label>
            <input
              type="datetime-local"
              name="endDate"
              value={formData.endDate}
              onChange={handleChange}
            />
          </div>
        </div>
        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={loading || templates.length === 0}>
            {loading ? 'Creating...' : 'Create test & add questions'}
          </button>
          <Link to="/vendor-admin/tests" className="btn btn-secondary">Cancel</Link>
        </div>
      </form>
    </div>
  );
};

export default CreateSQLTest;
