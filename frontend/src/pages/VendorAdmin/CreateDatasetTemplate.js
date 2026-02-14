import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Link } from 'react-router-dom';
import axiosInstance from '../../utils/axios';
import './CreateDatasetTemplate.css';

const CreateDatasetTemplate = () => {
  const { id } = useParams();
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
          const res = await axiosInstance.get(`/dataset-templates/${id}`);
          setFormData({
            name: res.data.name || '',
            description: res.data.description || '',
            domain: res.data.domain || 'General',
            schemaSql: res.data.schemaSql || '',
            dataSql: res.data.dataSql || ''
          });
        } catch (err) {
          setError(err.response?.data?.message || 'Failed to load template');
        }
      })();
    }
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
        await axiosInstance.put(`/dataset-templates/${id}`, formData);
      } else {
        await axiosInstance.post('/dataset-templates', formData);
      }
      navigate('/vendor-admin/dataset-templates');
    } catch (err) {
      setError(err.response?.data?.message || (err.response?.data?.errors?.[0]?.msg) || 'Save failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container vendor-dashboard create-dataset-template">
      <div className="page-header-row">
        <h1 className="page-title">{isEdit ? 'Edit Dataset Template' : 'Create Dataset Template'}</h1>
        <Link to="/vendor-admin/dataset-templates" className="btn btn-secondary">Back to list</Link>
      </div>
      <p className="page-description">
        Define the database schema (CREATE TABLE...) and optional sample data (INSERT...). Use SQLite-compatible SQL. Only INSERT is allowed in data SQL.
      </p>
      {error && <div className="error-message">{error}</div>}
      <form onSubmit={handleSubmit} className="dataset-template-form">
        <div className="form-group">
          <label>Name *</label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            placeholder="e.g. Company HR"
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
            placeholder="Short description"
          />
        </div>
        <div className="form-group">
          <label>Domain</label>
          <select name="domain" value={formData.domain} onChange={handleChange}>
            <option value="General">General</option>
            <option value="HR">HR</option>
            <option value="Banking">Banking</option>
            <option value="Sales">Sales</option>
            <option value="E-commerce">E-commerce</option>
          </select>
        </div>
        <div className="form-group">
          <label>Schema SQL * (CREATE TABLE...)</label>
          <textarea
            name="schemaSql"
            value={formData.schemaSql}
            onChange={handleChange}
            rows={12}
            placeholder="CREATE TABLE employees (id INTEGER PRIMARY KEY, name TEXT, dept_id INTEGER);&#10;CREATE TABLE departments (id INTEGER PRIMARY KEY, name TEXT);"
            required
            className="sql-textarea"
          />
        </div>
        <div className="form-group">
          <label>Data SQL (INSERT only)</label>
          <textarea
            name="dataSql"
            value={formData.dataSql}
            onChange={handleChange}
            rows={10}
            placeholder="INSERT INTO departments (id, name) VALUES (1, 'Engineering');&#10;INSERT INTO employees (id, name, dept_id) VALUES (1, 'Alice', 1);"
            className="sql-textarea"
          />
        </div>
        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Saving...' : (isEdit ? 'Update' : 'Create')}
          </button>
          <Link to="/vendor-admin/dataset-templates" className="btn btn-secondary">Cancel</Link>
        </div>
      </form>
    </div>
  );
};

export default CreateDatasetTemplate;
