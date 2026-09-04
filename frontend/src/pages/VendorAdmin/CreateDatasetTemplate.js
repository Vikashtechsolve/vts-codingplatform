import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import axiosInstance from '../../utils/axios';
import { getPlatformTestConfig } from '../../utils/platformMode';
import VendorTestFormPage from '../../components/VendorAdmin/VendorTestFormPage';
import './CreateDatasetTemplate.css';

const CreateDatasetTemplate = () => {
  const { id } = useParams();
  const location = useLocation();
  const platformConfig = getPlatformTestConfig(location.pathname);
  const listPath = platformConfig.isPlatform
    ? '/super-admin/tests/dataset-templates'
    : '/vendor-admin/dataset-templates';
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    domain: 'General',
    schemaSql: '',
    dataSql: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isEdit) {
      (async () => {
        try {
          const res = await axiosInstance.get(`${platformConfig.datasetTemplatesApiBase}/${id}`);
          setFormData({
            name: res.data.name || '',
            description: res.data.description || '',
            domain: res.data.domain || 'General',
            schemaSql: res.data.schemaSql || '',
            dataSql: res.data.dataSql || '',
          });
        } catch (err) {
          setError(err.response?.data?.message || 'Failed to load template');
        }
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isEdit]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isEdit) {
        await axiosInstance.put(`${platformConfig.datasetTemplatesApiBase}/${id}`, formData);
      } else {
        await axiosInstance.post(platformConfig.datasetTemplatesApiBase, formData);
      }
      navigate(listPath);
    } catch (err) {
      setError(err.response?.data?.message || (err.response?.data?.errors?.[0]?.msg) || 'Save failed');
    } finally {
      setLoading(false);
    }
  };

  const footer = (
    <>
      <span className="vtf-footer-meta">SQLite-compatible SQL only</span>
      <button
        type="button"
        className="va-btn va-btn--secondary"
        onClick={() => navigate(listPath)}
        disabled={loading}
      >
        Cancel
      </button>
      <button
        type="submit"
        form="dataset-template-form"
        className="va-btn va-btn--primary"
        disabled={loading}
      >
        {loading ? 'Saving…' : (isEdit ? 'Update template' : 'Create template')}
      </button>
    </>
  );

  return (
    <VendorTestFormPage
      backTo={listPath}
      backLabel="Dataset templates"
      eyebrow="SQL"
      title={isEdit ? 'Edit dataset template' : 'Create dataset template'}
      subtitle="Define the database schema (CREATE TABLE) and optional sample data (INSERT). Only INSERT is allowed in data SQL."
      accent="#ca8a04"
      error={error}
      footer={footer}
      className="create-dataset-template"
    >
      <form id="dataset-template-form" onSubmit={handleSubmit}>
        <section className="vtf-section">
          <h2 className="vtf-section-title">Template details</h2>
          <div className="vtf-field">
            <label htmlFor="dataset-name">Name *</label>
            <input
              id="dataset-name"
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="e.g. Company HR"
              required
            />
          </div>
          <div className="vtf-field">
            <label htmlFor="dataset-description">Description</label>
            <input
              id="dataset-description"
              type="text"
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Short description"
            />
          </div>
          <div className="vtf-field">
            <label htmlFor="dataset-domain">Domain</label>
            <select
              id="dataset-domain"
              name="domain"
              value={formData.domain}
              onChange={handleChange}
            >
              <option value="General">General</option>
              <option value="HR">HR</option>
              <option value="Banking">Banking</option>
              <option value="Sales">Sales</option>
              <option value="E-commerce">E-commerce</option>
            </select>
          </div>
        </section>

        <section className="vtf-section">
          <h2 className="vtf-section-title">Schema SQL *</h2>
          <p className="vtf-section-hint">CREATE TABLE statements used to set up the student database.</p>
          <div className="vtf-field">
            <label htmlFor="dataset-schema">Schema</label>
            <textarea
              id="dataset-schema"
              name="schemaSql"
              value={formData.schemaSql}
              onChange={handleChange}
              rows={12}
              placeholder={"CREATE TABLE employees (id INTEGER PRIMARY KEY, name TEXT, dept_id INTEGER);\nCREATE TABLE departments (id INTEGER PRIMARY KEY, name TEXT);"}
              required
              className="sql-textarea"
            />
          </div>
        </section>

        <section className="vtf-section">
          <h2 className="vtf-section-title">Sample data SQL</h2>
          <p className="vtf-section-hint">Optional INSERT statements. No other SQL is allowed here.</p>
          <div className="vtf-field">
            <label htmlFor="dataset-data">Data</label>
            <textarea
              id="dataset-data"
              name="dataSql"
              value={formData.dataSql}
              onChange={handleChange}
              rows={10}
              placeholder={"INSERT INTO departments (id, name) VALUES (1, 'Engineering');\nINSERT INTO employees (id, name, dept_id) VALUES (1, 'Alice', 1);"}
              className="sql-textarea"
            />
          </div>
        </section>
      </form>
    </VendorTestFormPage>
  );
};

export default CreateDatasetTemplate;
