import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import axiosInstance from '../../utils/axios';
import Modal from '../../components/Modal';
import './CreateEnglishQuestion.css';

const SUB_TYPES = [
  { value: 'synonym', label: 'Synonym' },
  { value: 'antonym', label: 'Antonym' },
  { value: 'meaning', label: 'Word Meaning' },
  { value: 'one_word_substitution', label: 'One Word Substitution' },
  { value: 'idiom_phrase', label: 'Idioms & Phrases' },
  { value: 'spelling', label: 'Spelling' },
  { value: 'contextual_usage', label: 'Contextual Usage' }
];

const CreateEnglishVocabularyQuestion = () => {
  const { id } = useParams();
  const isEditMode = !!id;
  useAuth();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    word: '',
    subType: 'synonym',
    contextSentence: '',
    options: [
      { text: '', isCorrect: false },
      { text: '', isCorrect: false },
      { text: '', isCorrect: false },
      { text: '', isCorrect: false }
    ],
    explanation: '',
    difficulty: 'medium',
    points: 10
  });
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState({ isOpen: false, title: '', message: '', type: 'info' });

  const fetchQuestion = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axiosInstance.get(`/questions/english/vocabulary/${id}`);
      const q = res.data;
      setFormData({
        word: q.word || '',
        subType: q.subType || 'synonym',
        contextSentence: q.contextSentence || '',
        options: q.options?.length ? q.options : [{ text: '', isCorrect: false }, { text: '', isCorrect: false }, { text: '', isCorrect: false }, { text: '', isCorrect: false }],
        explanation: q.explanation || '',
        difficulty: q.difficulty || 'medium',
        points: q.points || 10
      });
    } catch (error) {
      showModal('Error', 'Failed to load question', 'error');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (isEditMode && id) fetchQuestion();
  }, [id, isEditMode, fetchQuestion]);

  const showModal = (title, message, type = 'info') => setModal({ isOpen: true, title, message, type });
  const closeModal = () => setModal({ isOpen: false, title: '', message: '', type: 'info' });
  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleOptionChange = (index, field, value) => {
    const newOptions = [...formData.options];
    newOptions[index][field] = value;
    setFormData({ ...formData, options: newOptions });
  };

  const handleAddOption = () => setFormData({ ...formData, options: [...formData.options, { text: '', isCorrect: false }] });

  const handleRemoveOption = (index) => {
    if (formData.options.length <= 2) return showModal('Warning', 'At least 2 options required', 'warning');
    setFormData({ ...formData, options: formData.options.filter((_, i) => i !== index) });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.word.trim()) return showModal('Error', 'Word is required', 'error');
    const validOpts = formData.options.filter(o => o.text.trim());
    if (validOpts.length < 2) return showModal('Error', 'At least 2 options required', 'error');
    if (!validOpts.some(o => o.isCorrect)) return showModal('Error', 'Mark at least one correct option', 'error');

    setLoading(true);
    try {
      const data = { ...formData, options: validOpts };
      if (isEditMode) {
        await axiosInstance.put(`/questions/english/vocabulary/${id}`, data);
        showModal('Success', 'Question updated!', 'success');
      } else {
        await axiosInstance.post('/questions/english/vocabulary', data);
        showModal('Success', 'Question created!', 'success');
      }
      setTimeout(() => navigate('/vendor-admin/english-questions'), 1500);
    } catch (error) {
      showModal('Error', error.response?.data?.message || 'Error saving question', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container create-english-question">
      <Modal isOpen={modal.isOpen} onClose={closeModal} title={modal.title} type={modal.type}>
        <p>{modal.message}</p>
      </Modal>

      <div className="page-header">
        <h1 className="page-title">{isEditMode ? 'Edit' : 'Create'} Vocabulary Question</h1>
        <button onClick={() => navigate('/vendor-admin/english-questions')} className="btn btn-secondary">Back to Questions</button>
      </div>

      <form onSubmit={handleSubmit} className="question-form">
        <div className="form-section">
          <h2 className="section-title">Word Details</h2>
          <div className="form-row">
            <div className="form-group">
              <label>Word / Phrase *</label>
              <input type="text" name="word" value={formData.word} onChange={handleChange} placeholder="e.g., Benevolent" className="form-input" required />
            </div>
            <div className="form-group">
              <label>Question Type *</label>
              <select name="subType" value={formData.subType} onChange={handleChange} className="form-select">
                {SUB_TYPES.map(st => <option key={st.value} value={st.value}>{st.label}</option>)}
              </select>
            </div>
          </div>
          <div className="form-group full-width">
            <label>Context Sentence (Optional)</label>
            <input type="text" name="contextSentence" value={formData.contextSentence} onChange={handleChange} placeholder="e.g., The benevolent king helped his people." className="form-input" />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Difficulty</label>
              <select name="difficulty" value={formData.difficulty} onChange={handleChange} className="form-select">
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
            <div className="form-group">
              <label>Points</label>
              <input type="number" name="points" value={formData.points} onChange={handleChange} min="1" className="form-input" />
            </div>
          </div>
        </div>

        <div className="form-section">
          <div className="section-header">
            <h2 className="section-title">Answer Options</h2>
            <button type="button" onClick={handleAddOption} className="btn btn-secondary btn-sm">+ Add Option</button>
          </div>
          <div className="options-container">
            {formData.options.map((option, index) => (
              <div key={index} className={`option-card ${option.isCorrect ? 'option-correct' : ''}`}>
                <div className="option-header">
                  <div className="option-number">Option {index + 1}</div>
                  <div className="option-actions">
                    <label className="correct-checkbox">
                      <input type="checkbox" checked={option.isCorrect} onChange={(e) => handleOptionChange(index, 'isCorrect', e.target.checked)} />
                      <span className="correct-label">Correct</span>
                    </label>
                    <button type="button" onClick={() => handleRemoveOption(index)} className="btn-icon btn-danger" disabled={formData.options.length <= 2}>x</button>
                  </div>
                </div>
                <input type="text" value={option.text} onChange={(e) => handleOptionChange(index, 'text', e.target.value)} placeholder={`Option ${index + 1}`} className="form-input" />
              </div>
            ))}
          </div>
        </div>

        <div className="form-section">
          <h2 className="section-title">Explanation (Optional)</h2>
          <div className="form-group">
            <textarea name="explanation" value={formData.explanation} onChange={handleChange} rows="3" placeholder="Explain the correct answer..." className="form-textarea" />
          </div>
        </div>

        <div className="form-actions">
          <button type="button" onClick={() => navigate('/vendor-admin/english-questions')} className="btn btn-secondary">Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Saving...' : isEditMode ? 'Update' : 'Create Question'}</button>
        </div>
      </form>
    </div>
  );
};

export default CreateEnglishVocabularyQuestion;
