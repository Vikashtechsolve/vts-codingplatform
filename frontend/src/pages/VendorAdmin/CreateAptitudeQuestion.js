import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import axiosInstance from '../../utils/axios';
import Modal from '../../components/Modal';
import RichTextEditor from '../../components/RichTextEditor';
import VendorQuestionFormPage from '../../components/VendorAdmin/VendorQuestionFormPage';
import { QUESTION_FORM_META } from '../../utils/vendorQuestionFormMeta';
import { isRichTextEmpty } from '../../utils/richTextUtils';
import TagInput from '../../components/TagInput';
import './CreateAptitudeQuestion.css';

const defaultOptions = [
  { text: '', isCorrect: false },
  { text: '', isCorrect: false }
];

const CreateAptitudeQuestion = () => {
  const { id } = useParams();
  const location = useLocation();
  const isEditMode = !!id;
  const isGlobal = location.pathname.includes('/super-admin/global-questions');
  const apiBase = isGlobal ? '/super-admin/global-questions' : '/questions';
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    question: '',
    caseStudy: '',
    questionType: 'single',
    section: 'quantitative',
    subCategory: '',
    difficulty: 'medium',
    points: 10,
    explanation: '',
    options: defaultOptions,
    numericAnswer: '',
    numericTolerance: 0,
    tags: []
  });
  const [pageLoading, setPageLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [modal, setModal] = useState({ isOpen: false, title: '', message: '', type: 'info' });

  useEffect(() => {
    if (isEditMode && id) {
      fetchQuestion();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run when id or isEditMode changes
  }, [id, isEditMode]);

  const showModal = (title, message, type = 'info') => {
    setModal({ isOpen: true, title, message, type });
  };

  const closeModal = () => {
    setModal({ isOpen: false, title: '', message: '', type: 'info' });
  };

  const fetchQuestion = async () => {
    try {
      setPageLoading(true);
      const response = await axiosInstance.get(`${apiBase}/aptitude/${id}`);
      const q = response.data;

      const enrichedOptions = (q.options || []).map((opt, index) => ({
        text: opt.text || '',
        isCorrect: (q.correctOptions || []).includes(index)
      }));

      setFormData({
        question: q.question || '',
        caseStudy: q.caseStudy || '',
        questionType: q.questionType || 'single',
        section: q.section || 'quantitative',
        subCategory: q.subCategory || '',
        difficulty: q.difficulty || 'medium',
        points: q.points || 10,
        explanation: q.explanation || '',
        options: enrichedOptions.length ? enrichedOptions : defaultOptions,
        numericAnswer: q.numericAnswer ?? '',
        numericTolerance: q.numericTolerance ?? 0,
        tags: q.tags || []
      });
    } catch (error) {
      showModal('Error', `Failed to load question data: ${error.response?.data?.message || error.message}`, 'error');
    } finally {
      setPageLoading(false);
    }
  };

  const meta = QUESTION_FORM_META.aptitude;
  const backTo = isGlobal ? '/super-admin/global-questions' : meta.back;

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleOptionChange = (index, field, value) => {
    const updated = [...formData.options];
    updated[index][field] = value;
    setFormData({ ...formData, options: updated });
  };

  const handleAddOption = () => {
    setFormData({
      ...formData,
      options: [...formData.options, { text: '', isCorrect: false }]
    });
  };

  const handleRemoveOption = (index) => {
    if (formData.options.length <= 2) {
      showModal('Warning', 'At least 2 options are required', 'warning');
      return;
    }
    const updated = formData.options.filter((_, i) => i !== index);
    setFormData({ ...formData, options: updated });
  };

  const handleSingleCorrect = (index) => {
    const updated = formData.options.map((opt, idx) => ({
      ...opt,
      isCorrect: idx === index
    }));
    setFormData({ ...formData, options: updated });
  };

  const validateForm = () => {
    if (isRichTextEmpty(formData.question)) {
      showModal('Validation Error', 'Question text is required', 'error');
      return false;
    }

    if (formData.questionType === 'numeric') {
      const numericValue = parseFloat(formData.numericAnswer);
      if (Number.isNaN(numericValue)) {
        showModal('Validation Error', 'Numeric answer is required', 'error');
        return false;
      }
      return true;
    }

    const validOptions = formData.options.filter(opt => opt.text.trim());
    if (validOptions.length < 2) {
      showModal('Validation Error', 'At least 2 options are required', 'error');
      return false;
    }

    const correctCount = validOptions.filter(opt => opt.isCorrect).length;
    if (correctCount === 0) {
      showModal('Validation Error', 'Mark at least one correct option', 'error');
      return false;
    }
    if (['single', 'case_study'].includes(formData.questionType) && correctCount !== 1) {
      showModal('Validation Error', 'Select exactly one correct option', 'error');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setSaving(true);
    try {
      const validOptions = formData.options.filter(opt => opt.text.trim());
      const correctOptions = validOptions
        .map((opt, index) => (opt.isCorrect ? index : null))
        .filter(val => val !== null);

      const payload = {
        question: formData.question,
        caseStudy: formData.caseStudy,
        questionType: formData.questionType,
        section: formData.section,
        subCategory: formData.subCategory,
        difficulty: formData.difficulty,
        points: formData.points,
        explanation: formData.explanation,
        tags: formData.tags,
        options: formData.questionType === 'numeric' ? [] : validOptions.map(opt => ({ text: opt.text })),
        correctOptions: formData.questionType === 'numeric' ? [] : correctOptions,
        numericAnswer: formData.questionType === 'numeric' ? formData.numericAnswer : null,
        numericTolerance: formData.questionType === 'numeric' ? formData.numericTolerance : 0
      };

      if (isEditMode) {
        await axiosInstance.put(`${apiBase}/aptitude/${id}`, payload);
        showModal('Success', 'Question updated successfully!', 'success');
      } else {
        await axiosInstance.post(`${apiBase}/aptitude`, payload);
        showModal('Success', 'Question created successfully!', 'success');
      }

      setTimeout(() => {
        navigate(isGlobal ? '/super-admin/global-questions' : '/vendor-admin/questions');
      }, 1200);
    } catch (error) {
      const errorMsg = error.response?.data?.message ||
        error.response?.data?.errors?.map(e => e.msg || e.message).join(', ') ||
        `Error ${isEditMode ? 'updating' : 'creating'} question. Please try again.`;
      showModal('Error', errorMsg, 'error');
    } finally {
      setSaving(false);
    }
  };

  const isNumeric = formData.questionType === 'numeric';
  const isSingle = ['single', 'case_study'].includes(formData.questionType);

  const modalEl = (
    <Modal isOpen={modal.isOpen} onClose={closeModal} title={modal.title} type={modal.type}>
      <p>{modal.message}</p>
    </Modal>
  );

  const formFooter = (
    <div className="form-actions">
      <button type="button" onClick={() => navigate(backTo)} className="btn btn-secondary">Cancel</button>
      <button type="submit" form="aptitude-question-form" className="btn btn-primary" disabled={saving}>
        {saving ? 'Saving…' : isEditMode ? 'Update question' : 'Create question'}
      </button>
    </div>
  );

  return (
    <VendorQuestionFormPage
      className="create-aptitude-question"
      loading={pageLoading}
      backTo={backTo}
      backLabel="Back to questions"
      eyebrow={meta.label}
      title={isEditMode ? meta.editTitle : meta.createTitle}
      subtitle={meta.subtitle}
      accent={meta.accent}
      isGlobal={isGlobal}
      modal={modalEl}
      footer={formFooter}
    >
      <form id="aptitude-question-form" onSubmit={handleSubmit} className="question-form">
        <div className="form-section">
          <h2 className="section-title">Question details</h2>

          <div className="vqf-rich-field">
            <label>Question text *</label>
            <RichTextEditor
              variant="full"
              value={formData.question}
              onChange={(html) => setFormData((prev) => ({ ...prev, question: html }))}
              placeholder="Enter the aptitude question…"
              minHeight={160}
            />
          </div>

          <div className="vqf-rich-field">
            <label>Case study / context (optional)</label>
            <RichTextEditor
              variant="standard"
              value={formData.caseStudy}
              onChange={(html) => setFormData((prev) => ({ ...prev, caseStudy: html }))}
              placeholder="Passage or scenario shown before the question…"
              minHeight={120}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Question Type *</label>
              <select name="questionType" value={formData.questionType} onChange={handleChange} className="form-select">
                <option value="single">Single Correct</option>
                <option value="multi">Multi Correct</option>
                <option value="numeric">Numeric Input</option>
                <option value="case_study">Case Study</option>
              </select>
            </div>
            <div className="form-group">
              <label>Section *</label>
              <select name="section" value={formData.section} onChange={handleChange} className="form-select">
                <option value="quantitative">Quantitative Aptitude</option>
                <option value="logical">Logical Reasoning</option>
                <option value="analytical">Analytical Reasoning</option>
              </select>
            </div>
            <div className="form-group">
              <label>Sub-Category</label>
              <input
                type="text"
                name="subCategory"
                value={formData.subCategory}
                onChange={handleChange}
                placeholder="e.g., Percentages, Puzzles"
                className="form-input"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Difficulty *</label>
              <select name="difficulty" value={formData.difficulty} onChange={handleChange} className="form-select">
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
            <div className="form-group">
              <label>Points *</label>
              <input
                type="number"
                name="points"
                value={formData.points}
                onChange={handleChange}
                min="1"
                className="form-input"
                required
              />
            </div>
            <TagInput
              label="Tags"
              value={formData.tags}
              onChange={(tags) => setFormData((prev) => ({ ...prev, tags }))}
            />
          </div>
        </div>

        {isNumeric ? (
          <div className="form-section">
            <h2 className="section-title">Numeric Answer</h2>
            <div className="form-row">
              <div className="form-group">
                <label>Correct Answer *</label>
                <input
                  type="number"
                  name="numericAnswer"
                  value={formData.numericAnswer}
                  onChange={handleChange}
                  className="form-input"
                  required
                />
              </div>
              <div className="form-group">
                <label>Tolerance</label>
                <input
                  type="number"
                  name="numericTolerance"
                  value={formData.numericTolerance}
                  onChange={handleChange}
                  className="form-input"
                  step="0.01"
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="form-section">
            <div className="section-header">
              <h2 className="section-title">Answer Options</h2>
              <button type="button" onClick={handleAddOption} className="btn btn-secondary btn-sm">
                + Add Option
              </button>
            </div>

            <div className="options-container">
              {formData.options.map((option, index) => (
                <div key={index} className={`option-card ${option.isCorrect ? 'option-correct' : ''}`}>
                  <div className="option-header">
                    <div className="option-number">Option {index + 1}</div>
                    <div className="option-actions">
                      {isSingle ? (
                        <label className="correct-radio">
                          <input
                            type="radio"
                            name="correctOption"
                            checked={option.isCorrect}
                            onChange={() => handleSingleCorrect(index)}
                          />
                          <span className="correct-label">Correct</span>
                        </label>
                      ) : (
                        <label className="correct-checkbox">
                          <input
                            type="checkbox"
                            checked={option.isCorrect}
                            onChange={(e) => handleOptionChange(index, 'isCorrect', e.target.checked)}
                          />
                          <span className="correct-label">Correct</span>
                        </label>
                      )}
                      <button
                        type="button"
                        onClick={() => handleRemoveOption(index)}
                        className="btn-icon btn-danger"
                        disabled={formData.options.length <= 2}
                        title="Remove Option"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                  <div className="option-content">
                    <textarea
                      value={option.text}
                      onChange={(e) => handleOptionChange(index, 'text', e.target.value)}
                      required
                      rows="3"
                      placeholder={`Enter option ${index + 1} text...`}
                      className="form-textarea option-textarea"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="form-section">
          <h2 className="section-title">Explanation (optional)</h2>
          <div className="vqf-rich-field">
            <RichTextEditor
              variant="standard"
              value={formData.explanation}
              onChange={(html) => setFormData((prev) => ({ ...prev, explanation: html }))}
              placeholder="Solution approach or explanation…"
              minHeight={120}
            />
          </div>
        </div>
      </form>
    </VendorQuestionFormPage>
  );
};

export default CreateAptitudeQuestion;

