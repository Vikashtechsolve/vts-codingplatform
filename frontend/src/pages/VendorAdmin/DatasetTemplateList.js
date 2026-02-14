import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axiosInstance from '../../utils/axios';
import './DatasetTemplateList.css';

const DatasetTemplateList = () => {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const res = await axiosInstance.get('/dataset-templates');
      setTemplates(res.data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete dataset "${name}"? This will fail if it is used by any test.`)) return;
    try {
      await axiosInstance.delete(`/dataset-templates/${id}`);
      setTemplates(prev => prev.filter(t => t._id !== id));
    } catch (err) {
      alert(err.response?.data?.message || 'Delete failed');
    }
  };

  if (loading) return <div className="container vendor-dashboard"><div className="loading">Loading...</div></div>;
  if (error) return <div className="container vendor-dashboard"><div className="error-message">{error}</div></div>;

  return (
    <div className="container vendor-dashboard dataset-template-list">
      <div className="page-header-row">
        <h1 className="page-title">Dataset Templates</h1>
        <Link to="/vendor-admin/dataset-templates/create" className="btn btn-primary">
          Create Dataset Template
        </Link>
      </div>
      <p className="page-description">
        Create and manage database templates for SQL tests. Each template defines schema and sample data; tests use one template per test.
      </p>
      {templates.length === 0 ? (
        <div className="empty-state">
          <p>No dataset templates yet.</p>
          <Link to="/vendor-admin/dataset-templates/create" className="btn btn-primary">Create your first template</Link>
        </div>
      ) : (
        <div className="template-grid">
          {templates.map(t => (
            <div key={t._id} className="template-card">
              <div className="template-card-header">
                <h3>{t.name}</h3>
                <span className="domain-badge">{t.domain}</span>
              </div>
              {t.description && <p className="template-description">{t.description}</p>}
              <div className="template-actions">
                <Link to={`/vendor-admin/dataset-templates/${t._id}/edit`} className="btn btn-secondary btn-sm">Edit</Link>
                <button type="button" className="btn btn-danger btn-sm" onClick={() => handleDelete(t._id, t.name)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DatasetTemplateList;
