import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { FiPlus, FiTrash2 } from 'react-icons/fi';
import axiosInstance from '../../utils/axios';
import Modal from '../../components/Modal';
import TagInput from '../../components/TagInput';
import VendorQuestionFormPage from '../../components/VendorAdmin/VendorQuestionFormPage';
import { QUESTION_FORM_META } from '../../utils/vendorQuestionFormMeta';
import './CreateInterviewQuestion.css';

const defaultRubric = { title: '', description: '', weight: 1 };

const INTERVIEW_TYPES = [
  'Technical',
  'HR',
  'Behavioral',
  'Managerial',
  'System Design',
  'Mixed',
];

const CreateInterviewQuestion = () => {
  const { id } = useParams();
  const location = useLocation();
  const isEditMode = !!id;
  const isGlobal = location.pathname.includes('/super-admin');
  const apiBase = isGlobal ? '/super-admin/interview-questions' : '/interview-questions';
  const navigate = useNavigate();
  const meta = QUESTION_FORM_META.interview;
  const backTo = isGlobal ? '/super-admin/interview-questions' : meta.back;

  const [formData, setFormData] = useState({
    question: '',
    interviewType: '',
    topic: '',
    difficulty: 'beginner',
    expectedAnswer: '',
    rubrics: [{ ...defaultRubric }],
    followUpHints: [''],
    points: 10,
    tags: [],
  });
  const [pageLoading, setPageLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [modal, setModal] = useState({ isOpen: false, title: '', message: '', type: 'info' });
  const [customType, setCustomType] = useState(false);

  useEffect(() => {
    if (isEditMode && id) {
      fetchQuestion();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run when id or isEditMode changes
  }, [id, isEditMode]);

  const fetchQuestion = async () => {
    try {
      setPageLoading(true);
      const response = await axiosInstance.get(`${apiBase}/${id}`);
      const q = response.data;
      const type = q.interviewType || '';
      setCustomType(Boolean(type && !INTERVIEW_TYPES.includes(type)));
      setFormData({
        question: q.question || '',
        interviewType: type,
        topic: q.topic || '',
        difficulty: q.difficulty || 'beginner',
        expectedAnswer: q.expectedAnswer || '',
        rubrics: q.rubrics?.length ? q.rubrics : [{ ...defaultRubric }],
        followUpHints: q.followUpHints?.length ? q.followUpHints : [''],
        points: q.points || 10,
        tags: q.tags || [],
      });
    } catch (error) {
      showModal('Error', error.response?.data?.message || 'Failed to load question', 'error');
    } finally {
      setPageLoading(false);
    }
  };

  const showModal = (title, message, type = 'info') => {
    setModal({ isOpen: true, title, message, type });
  };

  const closeModal = () => setModal({ isOpen: false, title: '', message: '', type: 'info' });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleTypeSelect = (e) => {
    const value = e.target.value;
    if (value === '__custom__') {
      setCustomType(true);
      setFormData({ ...formData, interviewType: '' });
      return;
    }
    setCustomType(false);
    setFormData({ ...formData, interviewType: value });
  };

  const handleRubricChange = (index, field, value) => {
    const updated = [...formData.rubrics];
    updated[index] = { ...updated[index], [field]: value };
    setFormData({ ...formData, rubrics: updated });
  };

  const addRubric = () => {
    setFormData({ ...formData, rubrics: [...formData.rubrics, { ...defaultRubric }] });
  };

  const removeRubric = (index) => {
    if (formData.rubrics.length <= 1) return;
    setFormData({ ...formData, rubrics: formData.rubrics.filter((_, i) => i !== index) });
  };

  const handleHintChange = (index, value) => {
    const updated = [...formData.followUpHints];
    updated[index] = value;
    setFormData({ ...formData, followUpHints: updated });
  };

  const addHint = () => {
    setFormData({ ...formData, followUpHints: [...formData.followUpHints, ''] });
  };

  const removeHint = (index) => {
    if (formData.followUpHints.length <= 1) return;
    setFormData({ ...formData, followUpHints: formData.followUpHints.filter((_, i) => i !== index) });
  };

  const validateForm = () => {
    if (!formData.question.trim()) {
      showModal('Validation Error', 'Question text is required', 'error');
      return false;
    }
    if (!formData.interviewType.trim()) {
      showModal('Validation Error', 'Interview type is required', 'error');
      return false;
    }
    if (!formData.topic.trim()) {
      showModal('Validation Error', 'Topic is required', 'error');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setSaving(true);
    try {
      const payload = {
        ...formData,
        points: Number(formData.points) || 10,
        rubrics: formData.rubrics
          .filter((r) => r.title.trim())
          .map((r) => ({ ...r, weight: Number(r.weight) || 1 })),
        followUpHints: formData.followUpHints.filter((h) => h.trim()),
      };

      if (isEditMode) {
        await axiosInstance.put(`${apiBase}/${id}`, payload);
        showModal('Success', 'Question updated successfully!', 'success');
      } else {
        await axiosInstance.post(apiBase, payload);
        showModal('Success', 'Question created successfully!', 'success');
      }

      setTimeout(() => navigate(backTo), 1200);
    } catch (error) {
      showModal(
        'Error',
        error.response?.data?.message ||
          error.response?.data?.errors?.map((err) => err.msg || err.message).join(', ') ||
          'Failed to save question',
        'error'
      );
    } finally {
      setSaving(false);
    }
  };

  const typeSelectValue = customType ? '__custom__' : formData.interviewType || '';

  const modalEl = (
    <Modal isOpen={modal.isOpen} onClose={closeModal} title={modal.title} type={modal.type}>
      <p>{modal.message}</p>
    </Modal>
  );

  const formFooter = (
    <div className="form-actions">
      <button type="button" onClick={() => navigate(backTo)} className="btn btn-secondary">
        Cancel
      </button>
      <button type="submit" form="interview-question-form" className="btn btn-primary" disabled={saving}>
        {saving ? 'Saving…' : isEditMode ? 'Update question' : 'Create question'}
      </button>
    </div>
  );

  return (
    <VendorQuestionFormPage
      className="create-interview-question"
      loading={pageLoading}
      backTo={backTo}
      backLabel="Back to question pool"
      eyebrow={meta.label}
      title={isEditMode ? meta.editTitle : meta.createTitle}
      subtitle={meta.subtitle}
      accent={meta.accent}
      isGlobal={isGlobal}
      modal={modalEl}
      footer={formFooter}
    >
      <form id="interview-question-form" onSubmit={handleSubmit} className="question-form">
        <div className="form-section">
          <h2 className="section-title">Question details</h2>

          <div className="form-group full-width">
            <label htmlFor="question">Question *</label>
            <textarea
              id="question"
              name="question"
              value={formData.question}
              onChange={handleChange}
              rows={5}
              className="form-textarea"
              placeholder="What would you ask the candidate in the interview?"
              required
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="interviewTypeSelect">Interview type *</label>
              <select
                id="interviewTypeSelect"
                value={typeSelectValue}
                onChange={handleTypeSelect}
                className="form-select"
              >
                <option value="">Select type…</option>
                {INTERVIEW_TYPES.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
                <option value="__custom__">Custom type…</option>
              </select>
              {customType && (
                <input
                  type="text"
                  name="interviewType"
                  value={formData.interviewType}
                  onChange={handleChange}
                  className="form-input viq-custom-type"
                  placeholder="Enter custom interview type"
                  required
                />
              )}
            </div>
            <div className="form-group">
              <label htmlFor="topic">Topic *</label>
              <input
                id="topic"
                type="text"
                name="topic"
                value={formData.topic}
                onChange={handleChange}
                className="form-input"
                placeholder="e.g. Arrays, Leadership, React hooks"
                required
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="difficulty">Difficulty</label>
              <select
                id="difficulty"
                name="difficulty"
                value={formData.difficulty}
                onChange={handleChange}
                className="form-select"
              >
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="points">Points</label>
              <input
                id="points"
                type="number"
                name="points"
                value={formData.points}
                onChange={handleChange}
                min="1"
                className="form-input"
              />
            </div>
            <TagInput
              label="Tags"
              value={formData.tags}
              onChange={(tags) => setFormData((prev) => ({ ...prev, tags }))}
            />
          </div>
        </div>

        <div className="form-section">
          <h2 className="section-title">Expected answer (optional)</h2>
          <p className="section-hint">Reference answer for AI scoring — not shown to candidates during the interview.</p>
          <textarea
            name="expectedAnswer"
            value={formData.expectedAnswer}
            onChange={handleChange}
            rows={4}
            className="form-textarea"
            placeholder="Key points or sample answer the AI should look for…"
          />
        </div>

        <div className="form-section">
          <div className="section-header">
            <div>
              <h2 className="section-title">Rubrics</h2>
              <p className="section-hint">Criteria used to evaluate the candidate&apos;s response.</p>
            </div>
            <button type="button" className="btn btn-secondary btn-sm" onClick={addRubric}>
              <FiPlus /> Add rubric
            </button>
          </div>
          <div className="viq-nested-list">
            {formData.rubrics.map((rubric, index) => (
              <div key={index} className="vqf-nested-card viq-rubric-card">
                <div className="viq-nested-head">
                  <span className="viq-nested-label">Rubric {index + 1}</span>
                  <button
                    type="button"
                    className="btn-icon btn-danger"
                    onClick={() => removeRubric(index)}
                    disabled={formData.rubrics.length <= 1}
                    title="Remove rubric"
                  >
                    <FiTrash2 />
                  </button>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Title</label>
                    <input
                      value={rubric.title}
                      onChange={(e) => handleRubricChange(index, 'title', e.target.value)}
                      className="form-input"
                      placeholder="e.g. Problem solving"
                    />
                  </div>
                  <div className="form-group">
                    <label>Weight</label>
                    <input
                      type="number"
                      min="1"
                      value={rubric.weight}
                      onChange={(e) => handleRubricChange(index, 'weight', e.target.value)}
                      className="form-input"
                    />
                  </div>
                </div>
                <div className="form-group full-width">
                  <label>Description</label>
                  <textarea
                    value={rubric.description}
                    onChange={(e) => handleRubricChange(index, 'description', e.target.value)}
                    className="form-textarea"
                    rows={2}
                    placeholder="What should a strong answer demonstrate?"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="form-section">
          <div className="section-header">
            <div>
              <h2 className="section-title">Follow-up hints</h2>
              <p className="section-hint">Optional prompts if the candidate needs guidance during the interview.</p>
            </div>
            <button type="button" className="btn btn-secondary btn-sm" onClick={addHint}>
              <FiPlus /> Add hint
            </button>
          </div>
          <div className="viq-nested-list">
            {formData.followUpHints.map((hint, index) => (
              <div key={index} className="viq-hint-row">
                <input
                  value={hint}
                  onChange={(e) => handleHintChange(index, e.target.value)}
                  className="form-input"
                  placeholder={`Follow-up hint ${index + 1}`}
                />
                <button
                  type="button"
                  className="btn-icon btn-danger"
                  onClick={() => removeHint(index)}
                  disabled={formData.followUpHints.length <= 1}
                  title="Remove hint"
                >
                  <FiTrash2 />
                </button>
              </div>
            ))}
          </div>
        </div>
      </form>
    </VendorQuestionFormPage>
  );
};

export default CreateInterviewQuestion;
