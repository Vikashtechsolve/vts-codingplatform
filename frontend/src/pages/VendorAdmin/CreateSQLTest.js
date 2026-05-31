import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import axiosInstance from '../../utils/axios';
import VendorTestFormPage from '../../components/VendorAdmin/VendorTestFormPage';
import { getTestFormMeta } from '../../utils/vendorTestFormMeta';

const CreateSQLTest = () => {
  const navigate = useNavigate();
  const { testId } = useParams();
  const isEditMode = !!testId;
  const meta = getTestFormMeta('sql', isEditMode);

  const [templates, setTemplates] = useState([]);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    duration: 60,
    startDate: '',
    endDate: '',
    datasetTemplateId: '',
  });
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await axiosInstance.get('/dataset-templates');
        setTemplates(res.data || []);
      } catch {
        setError('Failed to load dataset templates');
      } finally {
        setPageLoading(false);
      }
    })();
  }, []);

  const toLocalDateTime = (v) => {
    if (!v) return '';
    try {
      return new Date(v).toISOString().slice(0, 16);
    } catch {
      return '';
    }
  };

  useEffect(() => {
    if (!isEditMode || !testId) return;
    (async () => {
      try {
        setPageLoading(true);
        const res = await axiosInstance.get(`/tests/${testId}`);
        const test = res.data;
        if (test?.type !== 'sql') {
          setError('This test is not an SQL test.');
          return;
        }
        setFormData({
          title: test.title || '',
          description: test.description || '',
          duration: test.duration ?? 60,
          startDate: toLocalDateTime(test.startDate),
          endDate: toLocalDateTime(test.endDate),
          datasetTemplateId: test.datasetTemplateId || test.datasetTemplate?._id || '',
        });
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load SQL test');
      } finally {
        setPageLoading(false);
      }
    })();
  }, [isEditMode, testId]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const validateSchedule = () => {
    if (formData.startDate && formData.endDate) {
      if (new Date(formData.endDate) <= new Date(formData.startDate)) {
        setError('End date must be after the start date.');
        return false;
      }
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!formData.title.trim()) {
      setError('Test title is required.');
      return;
    }
    if (!formData.datasetTemplateId) {
      setError('Please select a dataset template.');
      return;
    }
    if (!validateSchedule()) return;

    setLoading(true);
    try {
      const payload = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        type: 'sql',
        duration: Number(formData.duration) || 60,
        startDate: formData.startDate || undefined,
        endDate: formData.endDate || undefined,
        datasetTemplateId: formData.datasetTemplateId,
      };

      if (isEditMode) {
        await axiosInstance.put(`/tests/${testId}`, payload);
        navigate(`/vendor-admin/sql-tests/${testId}/questions`);
      } else {
        const res = await axiosInstance.post('/tests', { ...payload, questions: [] });
        navigate(`/vendor-admin/sql-tests/${res.data._id}/questions`);
      }
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.response?.data?.errors?.[0]?.msg ||
          (isEditMode ? 'Update failed' : 'Create failed')
      );
    } finally {
      setLoading(false);
    }
  };

  const selectedTemplate = templates.find((t) => t._id === formData.datasetTemplateId);

  const footer = (
    <>
      <span className="vtf-footer-meta">
        {selectedTemplate ? (
          <>Dataset: <strong>{selectedTemplate.name}</strong></>
        ) : (
          'Select a dataset template to continue'
        )}
      </span>
      <button
        type="button"
        className="va-btn va-btn--secondary"
        onClick={() => navigate(meta.back)}
      >
        Cancel
      </button>
      <button
        type="submit"
        form="sql-test-form"
        className="va-btn va-btn--primary"
        disabled={loading || templates.length === 0}
        style={{ '--va-accent': meta.accent }}
      >
        {loading
          ? isEditMode
            ? 'Updating…'
            : 'Creating…'
          : isEditMode
            ? 'Save & manage questions'
            : 'Create & add questions'}
      </button>
    </>
  );

  return (
    <VendorTestFormPage
      loading={pageLoading}
      backTo={meta.back}
      backLabel="SQL assessments"
      eyebrow={meta.eyebrow}
      title={meta.title}
      subtitle={meta.subtitle}
      accent={meta.accent}
      error={error}
      notice={
        templates.length === 0 && !pageLoading ? (
          <>
            Create at least one{' '}
            <Link to="/vendor-admin/dataset-templates/create">dataset template</Link> before
            building an SQL test.
          </>
        ) : null
      }
      footer={footer}
    >
      <form id="sql-test-form" onSubmit={handleSubmit}>
        <section className="vtf-section">
          <h2 className="vtf-section-title">Test details</h2>
          <div className="vtf-field">
            <label htmlFor="sql-title">Title *</label>
            <input
              id="sql-title"
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              placeholder="e.g. SQL Basics — HR Database"
              required
            />
          </div>
          <div className="vtf-field">
            <label htmlFor="sql-desc">Description</label>
            <textarea
              id="sql-desc"
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="What students should know before starting…"
              rows={3}
            />
          </div>
          <div className="vtf-row">
            <div className="vtf-field">
              <label htmlFor="sql-duration">Duration (minutes) *</label>
              <input
                id="sql-duration"
                type="number"
                name="duration"
                min={1}
                value={formData.duration}
                onChange={handleChange}
                required
              />
            </div>
            <div className="vtf-field">
              <label htmlFor="sql-template">Dataset template *</label>
              <select
                id="sql-template"
                name="datasetTemplateId"
                value={formData.datasetTemplateId}
                onChange={handleChange}
                required
                disabled={templates.length === 0}
              >
                <option value="">Select a template</option>
                {templates.map((t) => (
                  <option key={t._id} value={t._id}>
                    {t.name} ({t.domain})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        <section className="vtf-section">
          <h2 className="vtf-section-title">Schedule (optional)</h2>
          <p className="vtf-section-hint">Leave blank for an always-available test.</p>
          <div className="vtf-row">
            <div className="vtf-field">
              <label htmlFor="sql-start">Start</label>
              <input
                id="sql-start"
                type="datetime-local"
                name="startDate"
                value={formData.startDate}
                onChange={handleChange}
              />
            </div>
            <div className="vtf-field">
              <label htmlFor="sql-end">End</label>
              <input
                id="sql-end"
                type="datetime-local"
                name="endDate"
                value={formData.endDate}
                onChange={handleChange}
              />
            </div>
          </div>
        </section>
      </form>
    </VendorTestFormPage>
  );
};

export default CreateSQLTest;
