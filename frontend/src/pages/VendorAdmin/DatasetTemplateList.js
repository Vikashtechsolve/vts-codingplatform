import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FiPlus, FiDatabase, FiEdit2, FiTrash2, FiLayers } from 'react-icons/fi';
import axiosInstance from '../../utils/axios';
import VendorHubPage from '../../components/VendorAdmin/VendorHubPage';
import { getPlatformTestConfig } from '../../utils/platformMode';
import './DatasetTemplateList.css';

const DatasetTemplateList = () => {
  const location = useLocation();
  const platformConfig = getPlatformTestConfig(location.pathname);
  const listPath = platformConfig.isPlatform
    ? '/super-admin/tests/dataset-templates'
    : '/vendor-admin/dataset-templates';
  const createPath = `${listPath}/create`;
  const editPathPrefix = platformConfig.isPlatform
    ? '/super-admin/tests/dataset-templates'
    : '/vendor-admin/dataset-templates';
  const backPath = platformConfig.isPlatform
    ? '/super-admin/tests?type=sql'
    : '/vendor-admin/tests?type=sql';

  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    fetchTemplates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await axiosInstance.get(platformConfig.datasetTemplatesApiBase);
      setTemplates(res.data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load dataset templates.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete dataset "${name}"? This will fail if it is used by any SQL test.`)) {
      return;
    }
    try {
      setDeletingId(id);
      await axiosInstance.delete(`${platformConfig.datasetTemplatesApiBase}/${id}`);
      setTemplates((prev) => prev.filter((t) => t._id !== id));
    } catch (err) {
      alert(err.response?.data?.message || 'Delete failed');
    } finally {
      setDeletingId(null);
    }
  };

  const domains = new Set(templates.map((t) => t.domain).filter(Boolean));

  return (
    <VendorHubPage
      className="vh-dataset-page"
      loading={loading}
      backTo={backPath}
      backLabel="Back to SQL tests"
      eyebrow={platformConfig.isPlatform ? 'Platform assessments' : 'Practical tools'}
      title="Dataset templates"
      subtitle={
        platformConfig.isPlatform
          ? 'Platform-wide schemas and sample data for SQL tests allocated to vendors.'
          : 'Define schemas and sample data for SQL tests. Each SQL assessment uses one template as its database.'
      }
      accent="#ca8a04"
      actions={
        <Link to={createPath} className="vh-btn vh-btn--primary">
          <FiPlus /> Create template
        </Link>
      }
    >
      {error && (
        <div className="vh-panel vh-dataset-error">
          <p>{error}</p>
          <button type="button" className="vh-btn vh-btn--secondary" onClick={fetchTemplates}>
            Try again
          </button>
        </div>
      )}

      {!error && (
        <>
          <div className="vh-stats">
            <div className="vh-stat vh-stat--accent">
              <span className="vh-stat-label">Templates</span>
              <span className="vh-stat-value">{templates.length}</span>
            </div>
            <div className="vh-stat">
              <span className="vh-stat-label">Domains</span>
              <span className="vh-stat-value">{domains.size}</span>
            </div>
          </div>

          {templates.length === 0 ? (
            <div className="vh-empty">
              <FiDatabase />
              <h3>No dataset templates yet</h3>
              <p>Create a template with tables and seed data before building SQL tests.</p>
              <Link to={createPath} className="vh-btn vh-btn--primary">
                <FiPlus /> Create your first template
              </Link>
            </div>
          ) : (
            <div className="vh-dataset-grid">
              {templates.map((template) => (
                <article key={template._id} className="vh-dataset-card">
                  <div className="vh-dataset-card-top">
                    <div className="vh-dataset-card-icon">
                      <FiLayers />
                    </div>
                    <div>
                      <h3>{template.name}</h3>
                      {template.domain && (
                        <span className="vh-badge vh-badge--global">{template.domain}</span>
                      )}
                    </div>
                  </div>
                  {template.description && (
                    <p className="vh-dataset-card-desc">{template.description}</p>
                  )}
                  <div className="vh-dataset-card-actions">
                    <Link
                      to={`${editPathPrefix}/${template._id}/edit`}
                      className="vh-btn vh-btn--secondary vh-btn--sm"
                    >
                      <FiEdit2 /> Edit
                    </Link>
                    <button
                      type="button"
                      className="vh-btn vh-btn--danger vh-btn--sm"
                      disabled={deletingId === template._id}
                      onClick={() => handleDelete(template._id, template.name)}
                    >
                      <FiTrash2 /> {deletingId === template._id ? 'Deleting…' : 'Delete'}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </>
      )}
    </VendorHubPage>
  );
};

export default DatasetTemplateList;
