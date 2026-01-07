import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import axiosInstance from '../../utils/axios';
import Modal from '../../components/Modal';
import './CreateMCQQuestion.css';

const CreateMCQQuestion = () => {
  const { id } = useParams();
  const location = useLocation();
  const { user } = useAuth();
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
    points: 10
  });
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState({ isOpen: false, title: '', message: '', type: 'info' });
  const navigate = useNavigate();

  useEffect(() => {
    if (isEditMode && id) {
      fetchQuestion();
    }
  }, [id, isEditMode]);

  const fetchQuestion = async () => {
    try {
      setLoading(true);
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
        points: q.points || 10
      });
    } catch (error) {
      console.error('❌ Error fetching MCQ question:', error);
      showModal('Error', `Failed to load question data: ${error.response?.data?.message || error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

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
    if (!formData.question.trim()) {
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

    setLoading(true);

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
      setLoading(false);
    }
  };

  return (
    <div className="container create-mcq-question">
      <Modal 
        isOpen={modal.isOpen} 
        onClose={closeModal}
        title={modal.title}
        type={modal.type}
      >
        <p>{modal.message}</p>
      </Modal>

      <div className="page-header">
        <h1 className="page-title">Create MCQ Question</h1>
        <button 
          onClick={() => navigate(isGlobal ? '/super-admin/global-questions' : '/vendor-admin/questions')} 
          className="btn btn-secondary"
        >
          Back to Questions
        </button>
      </div>

      <form onSubmit={handleSubmit} className="question-form">
        {/* Basic Information Section */}
        <div className="form-section">
          <h2 className="section-title">Question Details</h2>
          
          <div className="form-row">
            <div className="form-group full-width">
              <label>Question Text *</label>
              <textarea
                name="question"
                value={formData.question}
                onChange={handleChange}
                required
                rows="6"
                placeholder="Enter your question here..."
                className="form-textarea"
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

        {/* Explanation Section */}
        <div className="form-section">
          <h2 className="section-title">Explanation (Optional)</h2>
          <div className="form-group">
            <textarea
              name="explanation"
              value={formData.explanation}
              onChange={handleChange}
              rows="4"
              placeholder="Provide an explanation for the correct answer..."
              className="form-textarea"
            />
          </div>
        </div>

        {/* Submit Button */}
        <div className="form-actions">
          <button type="button" onClick={() => navigate('/vendor-admin/questions')} className="btn btn-secondary">
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Creating...' : 'Create Question'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreateMCQQuestion;
