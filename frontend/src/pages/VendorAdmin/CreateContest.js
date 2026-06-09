import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FiSave, FiSend, FiLink } from 'react-icons/fi';
import axiosInstance from '../../utils/axios';
import { useToast } from '../../context/ToastContext';
import VendorHubPage from '../../components/VendorAdmin/VendorHubPage';
import { VENDOR_ACCENT } from '../../constants/vendorSections';
import './CreateContest.css';

const ASSESSMENT_TYPES = [
  { value: 'test', label: 'Test' },
  { value: 'interview', label: 'Mock Interview' },
  { value: 'assignment', label: 'Project Assignment' },
  { value: 'system_design', label: 'System Design' },
];

const toLocalInput = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const CreateContest = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);
  const { showToast } = useToast();

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [assessments, setAssessments] = useState([]);
  const [status, setStatus] = useState('draft');
  const [slug, setSlug] = useState('');

  const [form, setForm] = useState({
    title: '',
    description: '',
    assessmentType: 'test',
    assessmentId: '',
    registrationOpensAt: '',
    registrationClosesAt: '',
    attemptWindowStart: '',
    attemptWindowEnd: '',
    collectPhone: false,
    collectCollege: false,
    collectRollNumber: false,
    showLeaderboard: false,
    maxParticipants: '',
  });

  const fetchAssessments = useCallback(async (type) => {
    try {
      const { data } = await axiosInstance.get(`/contests/vendor/assessments?type=${type}`);
      setAssessments(data.items || []);
    } catch {
      setAssessments([]);
    }
  }, []);

  const fetchContest = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await axiosInstance.get(`/contests/vendor/${id}`);
      setStatus(data.status);
      setSlug(data.slug);
      setForm({
        title: data.title || '',
        description: data.description || '',
        assessmentType: data.assessmentType || 'test',
        assessmentId: data.assessmentId || '',
        registrationOpensAt: toLocalInput(data.registrationOpensAt),
        registrationClosesAt: toLocalInput(data.registrationClosesAt),
        attemptWindowStart: toLocalInput(data.attemptWindowStart),
        attemptWindowEnd: toLocalInput(data.attemptWindowEnd),
        collectPhone: data.settings?.collectPhone || false,
        collectCollege: data.settings?.collectCollege || false,
        collectRollNumber: data.settings?.collectRollNumber || false,
        showLeaderboard: data.settings?.showLeaderboard || false,
        maxParticipants: data.settings?.maxParticipants || '',
      });
      await fetchAssessments(data.assessmentType);
    } catch {
      showToast('Failed to load contest', 'error');
      navigate('/vendor-admin/contests');
    } finally {
      setLoading(false);
    }
  }, [id, navigate, showToast, fetchAssessments]);

  useEffect(() => {
    if (isEdit) {
      fetchContest();
    } else {
      fetchAssessments(form.assessmentType);
    }
  }, [isEdit, fetchContest, fetchAssessments, form.assessmentType]);

  const handleTypeChange = async (e) => {
    const type = e.target.value;
    setForm((prev) => ({ ...prev, assessmentType: type, assessmentId: '' }));
    await fetchAssessments(type);
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const buildPayload = () => ({
    title: form.title,
    description: form.description,
    assessmentType: form.assessmentType,
    assessmentId: form.assessmentId,
    registrationOpensAt: form.registrationOpensAt || null,
    registrationClosesAt: form.registrationClosesAt || null,
    attemptWindowStart: form.attemptWindowStart,
    attemptWindowEnd: form.attemptWindowEnd,
    settings: {
      collectPhone: form.collectPhone,
      collectCollege: form.collectCollege,
      collectRollNumber: form.collectRollNumber,
      showLeaderboard: form.showLeaderboard,
      maxParticipants: form.maxParticipants ? Number(form.maxParticipants) : null,
    },
  });

  const handleSave = async (publish = false) => {
    if (!form.title || !form.assessmentId || !form.attemptWindowStart || !form.attemptWindowEnd) {
      showToast('Please fill in all required fields', 'error');
      return;
    }

    try {
      setSaving(true);
      let contestId = id;
      if (isEdit) {
        await axiosInstance.put(`/contests/vendor/${id}`, buildPayload());
      } else {
        const { data } = await axiosInstance.post('/contests/vendor', buildPayload());
        contestId = data._id;
      }

      if (publish) {
        await axiosInstance.post(`/contests/vendor/${contestId}/publish`);
        showToast('Contest published', 'success');
      } else {
        showToast(isEdit ? 'Contest updated' : 'Contest created', 'success');
      }

      navigate('/vendor-admin/contests');
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to save contest', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <VendorHubPage className="vco-page" loading accent={VENDOR_ACCENT} />
    );
  }

  return (
    <VendorHubPage
      className="vco-page vco-form-page"
      backTo="/vendor-admin/contests"
      backLabel="Back to contests"
      eyebrow={isEdit ? 'Edit event' : 'New event'}
      title={isEdit ? 'Edit contest' : 'Create contest'}
      subtitle="Students register through a public link. Everyone attempts during the same scheduled window."
      accent={VENDOR_ACCENT}
    >
      <div className="vco-form-layout">
        <div className="vco-form-main">
          <section className="vh-panel">
            <div className="vh-panel-head">
              <div>
                <h2 className="vh-panel-title">Basic information</h2>
                <p className="vh-panel-desc">Title and description shown on the public contest page.</p>
              </div>
            </div>
            <div className="vh-panel-body">
              <div className="vh-form-grid">
                <div className="vh-field">
                  <label htmlFor="contest-title">Contest title *</label>
                  <input
                    id="contest-title"
                    name="title"
                    value={form.title}
                    onChange={handleChange}
                    placeholder="e.g. Spring coding challenge 2026"
                    required
                  />
                </div>
                <div className="vh-field">
                  <label htmlFor="contest-desc">Description</label>
                  <textarea
                    id="contest-desc"
                    name="description"
                    value={form.description}
                    onChange={handleChange}
                    rows={3}
                    placeholder="Optional instructions for participants"
                  />
                </div>
              </div>
            </div>
          </section>

          <section className="vh-panel">
            <div className="vh-panel-head">
              <div>
                <h2 className="vh-panel-title">Assessment</h2>
                <p className="vh-panel-desc">Pick the test or activity students will complete.</p>
              </div>
            </div>
            <div className="vh-panel-body">
              <div className="vco-form-row">
                <div className="vh-field">
                  <label htmlFor="assessment-type">Type *</label>
                  <select
                    id="assessment-type"
                    name="assessmentType"
                    value={form.assessmentType}
                    onChange={handleTypeChange}
                    disabled={isEdit}
                  >
                    {ASSESSMENT_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div className="vh-field">
                  <label htmlFor="assessment-id">Assessment *</label>
                  <select
                    id="assessment-id"
                    name="assessmentId"
                    value={form.assessmentId}
                    onChange={handleChange}
                    required
                    disabled={isEdit}
                  >
                    <option value="">Select assessment…</option>
                    {assessments.map((a) => (
                      <option key={a._id} value={a._id}>{a.title}</option>
                    ))}
                  </select>
                  {isEdit && (
                    <span className="vh-field-hint">Assessment cannot be changed after creation.</span>
                  )}
                </div>
              </div>
            </div>
          </section>

          <section className="vh-panel">
            <div className="vh-panel-head">
              <div>
                <h2 className="vh-panel-title">Schedule</h2>
                <p className="vh-panel-desc">Registration can stay open; attempts are only allowed in the attempt window.</p>
              </div>
            </div>
            <div className="vh-panel-body">
              <div className="vco-form-row">
                <div className="vh-field">
                  <label htmlFor="reg-opens">Registration opens</label>
                  <input
                    id="reg-opens"
                    type="datetime-local"
                    name="registrationOpensAt"
                    value={form.registrationOpensAt}
                    onChange={handleChange}
                  />
                </div>
                <div className="vh-field">
                  <label htmlFor="reg-closes">Registration closes</label>
                  <input
                    id="reg-closes"
                    type="datetime-local"
                    name="registrationClosesAt"
                    value={form.registrationClosesAt}
                    onChange={handleChange}
                  />
                  <span className="vh-field-hint">Defaults to attempt window end if empty.</span>
                </div>
              </div>
              <div className="vco-form-row">
                <div className="vh-field">
                  <label htmlFor="attempt-start">Attempt window start *</label>
                  <input
                    id="attempt-start"
                    type="datetime-local"
                    name="attemptWindowStart"
                    value={form.attemptWindowStart}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="vh-field">
                  <label htmlFor="attempt-end">Attempt window end *</label>
                  <input
                    id="attempt-end"
                    type="datetime-local"
                    name="attemptWindowEnd"
                    value={form.attemptWindowEnd}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>
            </div>
          </section>

          <section className="vh-panel">
            <div className="vh-panel-head">
              <div>
                <h2 className="vh-panel-title">Registration options</h2>
                <p className="vh-panel-desc">Extra fields and limits for public sign-up.</p>
              </div>
            </div>
            <div className="vh-panel-body">
              <div className="vco-check-grid">
                <label className="vco-check">
                  <input type="checkbox" name="collectPhone" checked={form.collectPhone} onChange={handleChange} />
                  <span>Require phone number</span>
                </label>
                <label className="vco-check">
                  <input type="checkbox" name="collectCollege" checked={form.collectCollege} onChange={handleChange} />
                  <span>Require college</span>
                </label>
                <label className="vco-check">
                  <input type="checkbox" name="collectRollNumber" checked={form.collectRollNumber} onChange={handleChange} />
                  <span>Require roll number</span>
                </label>
                <label className="vco-check">
                  <input type="checkbox" name="showLeaderboard" checked={form.showLeaderboard} onChange={handleChange} />
                  <span>Show leaderboard (tests only)</span>
                </label>
              </div>
              <div className="vh-field vco-max-field">
                <label htmlFor="max-participants">Max participants</label>
                <input
                  id="max-participants"
                  type="number"
                  name="maxParticipants"
                  value={form.maxParticipants}
                  onChange={handleChange}
                  min="1"
                  placeholder="Unlimited"
                />
              </div>
            </div>
          </section>

          <div className="vh-form-actions vco-form-actions">
            <button type="button" className="vh-btn vh-btn--secondary" onClick={() => navigate('/vendor-admin/contests')}>
              Cancel
            </button>
            <button type="button" className="vh-btn vh-btn--secondary" disabled={saving} onClick={() => handleSave(false)}>
              <FiSave /> {saving ? 'Saving…' : 'Save draft'}
            </button>
            {(!isEdit || status === 'draft') && (
              <button type="button" className="vh-btn vh-btn--primary" disabled={saving} onClick={() => handleSave(true)}>
                <FiSend /> {saving ? 'Publishing…' : 'Save & publish'}
              </button>
            )}
          </div>
        </div>

        {slug && (
          <aside className="vco-form-aside">
            <div className="vh-panel vco-link-panel">
              <div className="vh-panel-head">
                <div>
                  <h2 className="vh-panel-title">Public link</h2>
                  <p className="vh-panel-desc">Share after publishing.</p>
                </div>
              </div>
              <div className="vh-panel-body">
                <div className="vco-link-box">
                  <FiLink />
                  <code>{window.location.origin}/contest/{slug}</code>
                </div>
                {status !== 'published' && (
                  <p className="vh-field-hint">Publish the contest to activate this link for students.</p>
                )}
              </div>
            </div>
          </aside>
        )}
      </div>
    </VendorHubPage>
  );
};

export default CreateContest;
