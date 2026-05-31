import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import axiosInstance from '../../utils/axios';
import Modal from '../../components/Modal';
import RichTextEditor from '../../components/RichTextEditor';
import VendorQuestionFormPage from '../../components/VendorAdmin/VendorQuestionFormPage';
import { QUESTION_FORM_META } from '../../utils/vendorQuestionFormMeta';
import { isRichTextEmpty } from '../../utils/richTextUtils';
import TagInput from '../../components/TagInput';
import './CreateMCQQuestion.css';

const CreateMCQQuestion = () => {
  const { id } = useParams();
  const location = useLocation();
  useAuth();
  const isEditMode = !!id;
  const isGlobal = location.pathname.includes('/super-admin/global-questions');
  const apiBase = isGlobal ? '/super-admin/global-questions' : '/questions';
  const [formData, setFormData] = useState({
    question: '',
    options: [
      { text: '', isCorrect: false },
      { text: '', isCorrect: false }
    ],
    explanation: '',
    difficulty: 'medium',
    category: '',
    points: 10,
    tags: []
  });
  const [pageLoading, setPageLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [modal, setModal] = useState({ isOpen: false, title: '', message: '', type: 'info' });
  const navigate = useNavigate();

  useEffect(() => {
    if (isEditMode && id) {
      fetchQuestion();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run when id or isEditMode changes
  }, [id, isEditMode]);

  const fetchQuestion = async () => {
    try {
      setPageLoading(true);
      console.log('📥 Fetching MCQ question for edit:', id);
      const response = await axiosInstance.get(`${apiBase}/mcq/${id}`);
      const q = response.data;
      console.log('✅ MCQ question data received:', q);
      
      setFormData({
        question: q.question || '',
        options: q.options && q.options.length > 0 ? q.options : [{ text: '', isCorrect: false }, { text: '', isCorrect: false }],
        explanation: q.explanation || '',
        difficulty: q.difficulty || 'medium',
        category: q.category || '',
        points: q.points || 10,
        tags: q.tags || []
      });
    } catch (error) {
      console.error('❌ Error fetching MCQ question:', error);
      showModal('Error', `Failed to load question data: ${error.response?.data?.message || error.message}`, 'error');
    } finally {
      setPageLoading(false);
    }
  };

  const meta = QUESTION_FORM_META.mcq;
  const backTo = isGlobal ? '/super-admin/global-questions' : meta.back;

  const showModal = (title, message, type = 'info') => {
    setModal({ isOpen: true, title, message, type });
  };

  const closeModal = () => {
    setModal({ isOpen: false, title: '', message: '', type: 'info' });
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleOptionChange = (index, field, value) => {
    const newOptions = [...formData.options];
    if (field === 'isCorrect') {
      newOptions[index][field] = value;
    } else {
      newOptions[index][field] = value;
    }
    setFormData({ ...formData, options: newOptions });
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
    const newOptions = formData.options.filter((_, i) => i !== index);
    setFormData({ ...formData, options: newOptions });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Client-side validation
    if (isRichTextEmpty(formData.question)) {
      showModal('Validation Error', 'Question text is required', 'error');
      return;
    }
    
    // Filter out empty options
    const validOptions = formData.options.filter(opt => opt.text.trim());
    if (validOptions.length < 2) {
      showModal('Validation Error', 'At least 2 options are required', 'error');
      return;
    }
    
    const hasCorrectAnswer = validOptions.some(opt => opt.isCorrect);
    if (!hasCorrectAnswer) {
      showModal('Validation Error', 'Please mark at least one option as correct', 'error');
      return;
    }

    setSaving(true);

    try {
      const questionData = {
        ...formData,
        options: validOptions
      };
      
      if (isEditMode) {
        console.log('📤 Updating MCQ question...');
        await axiosInstance.put(`${apiBase}/mcq/${id}`, questionData);
        console.log('✅ Question updated');
        showModal('Success', 'Question updated successfully!', 'success');
      } else {
        console.log('📤 Creating MCQ question...');
        const response = await axiosInstance.post(`${apiBase}/mcq`, questionData);
        console.log('✅ Question created:', response.data);
        showModal('Success', 'Question created successfully!', 'success');
      }
      
      setTimeout(() => {
        navigate(isGlobal ? '/super-admin/global-questions' : '/vendor-admin/questions');
      }, 1500);
    } catch (error) {
      console.error('❌ Error saving question:', error);
      const errorMsg = error.response?.data?.message || 
                       error.response?.data?.errors?.map(e => e.msg || e.message).join(', ') ||
                       `Error ${isEditMode ? 'updating' : 'creating'} question. Please try again.`;
      showModal('Error', errorMsg, 'error');
    } finally {
      setSaving(false);
    }
  };

  const modalEl = (
    <Modal isOpen={modal.isOpen} onClose={closeModal} title={modal.title} type={modal.type}>
      <p>{modal.message}</p>
    </Modal>
  );

  const formFooter = (
    <div className="form-actions">
      <button type="button" onClick={() => navigate(backTo)} className="btn btn-secondary">Cancel</button>
      <button type="submit" form="mcq-question-form" className="btn btn-primary" disabled={saving}>
        {saving ? 'Saving…' : isEditMode ? 'Update question' : 'Create question'}
      </button>
    </div>
  );

  return (
    <VendorQuestionFormPage
      className="create-mcq-question"
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
      <form id="mcq-question-form" onSubmit={handleSubmit} className="question-form">
        <div className="form-section">
          <h2 className="section-title">Question details</h2>

          <div className="vqf-rich-field">
            <label>Question text *</label>
            <RichTextEditor
              variant="full"
              value={formData.question}
              onChange={(html) => setFormData((prev) => ({ ...prev, question: html }))}
              placeholder="Enter the question — formatting, images, and links supported."
              minHeight={180}
            />
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
            <div className="form-group">
              <label>Category</label>
              <input
                type="text"
                name="category"
                value={formData.category}
                onChange={handleChange}
                placeholder="e.g., Data Structures, Algorithms"
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

        {/* Options Section */}
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
                  <div className="option-number">
                    Option {index + 1}
                  </div>
                  <div className="option-actions">
                    <label className="correct-checkbox">
                      <input
                        type="checkbox"
                        checked={option.isCorrect}
                        onChange={(e) => handleOptionChange(index, 'isCorrect', e.target.checked)}
                      />
                      <span className="correct-label">Correct Answer</span>
                    </label>
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

        <div className="form-section">
          <h2 className="section-title">Explanation (optional)</h2>
          <div className="vqf-rich-field">
            <RichTextEditor
              variant="standard"
              value={formData.explanation}
              onChange={(html) => setFormData((prev) => ({ ...prev, explanation: html }))}
              placeholder="Explain the correct answer for students after submission…"
              minHeight={120}
            />
          </div>
        </div>
      </form>
    </VendorQuestionFormPage>
  );
};

export default CreateMCQQuestion;
