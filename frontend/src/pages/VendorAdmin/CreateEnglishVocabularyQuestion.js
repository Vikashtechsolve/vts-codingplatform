import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import axiosInstance from '../../utils/axios';
import RichTextEditor from '../../components/RichTextEditor';
import { EnglishFormModal, EnglishQuestionFormShell } from '../../components/VendorAdmin/EnglishQuestionFormShell';
import TagInput from '../../components/TagInput';
import { useEnglishQuestionFormRoutes } from '../../hooks/useEnglishQuestionFormRoutes';
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
  const { sectionEndpoint, backTo } = useEnglishQuestionFormRoutes('vocabulary');

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
    points: 10,
    tags: []
  });
  const [pageLoading, setPageLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [modal, setModal] = useState({ isOpen: false, title: '', message: '', type: 'info' });

  const fetchQuestion = useCallback(async () => {
    try {
      setPageLoading(true);
      const res = await axiosInstance.get(`${sectionEndpoint}/${id}`);
      const q = res.data;
      setFormData({
        word: q.word || '',
        subType: q.subType || 'synonym',
        contextSentence: q.contextSentence || '',
        options: q.options?.length ? q.options : [{ text: '', isCorrect: false }, { text: '', isCorrect: false }, { text: '', isCorrect: false }, { text: '', isCorrect: false }],
        explanation: q.explanation || '',
        difficulty: q.difficulty || 'medium',
        points: q.points || 10,
        tags: q.tags || []
      });
    } catch (error) {
      showModal('Error', 'Failed to load question', 'error');
    } finally {
      setPageLoading(false);
    }
  }, [id, sectionEndpoint]);

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

    setSaving(true);
    try {
      const data = { ...formData, options: validOpts };
      if (isEditMode) {
        await axiosInstance.put(`${sectionEndpoint}/${id}`, data);
        showModal('Success', 'Question updated!', 'success');
      } else {
        await axiosInstance.post(sectionEndpoint, data);
        showModal('Success', 'Question created!', 'success');
      }
      setTimeout(() => navigate(backTo), 1500);
    } catch (error) {
      showModal('Error', error.response?.data?.message || 'Error saving question', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <EnglishQuestionFormShell
      subtype="Vocabulary"
      title={isEditMode ? 'Edit vocabulary question' : 'Create vocabulary question'}
      subtitle="Synonyms, antonyms, meanings, idioms, spelling, and contextual usage."
      pageLoading={pageLoading}
      modal={<EnglishFormModal modal={modal} onClose={closeModal} />}
      formId="english-vocab-form"
      onCancel={() => navigate(backTo)}
      saving={saving}
      isEditMode={isEditMode}
    >
      <form id="english-vocab-form" onSubmit={handleSubmit} className="question-form">
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
          <div className="vqf-rich-field">
            <label>Context sentence (optional)</label>
            <RichTextEditor
              variant="standard"
              value={formData.contextSentence}
              onChange={(html) => setFormData((prev) => ({ ...prev, contextSentence: html }))}
              placeholder="Sentence showing how the word is used…"
              minHeight={80}
            />
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
            <TagInput
              label="Tags"
              value={formData.tags}
              onChange={(tags) => setFormData((prev) => ({ ...prev, tags }))}
            />
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
          <h2 className="section-title">Explanation (optional)</h2>
          <div className="vqf-rich-field">
            <RichTextEditor
              variant="standard"
              value={formData.explanation}
              onChange={(html) => setFormData((prev) => ({ ...prev, explanation: html }))}
              placeholder="Explain the correct answer…"
              minHeight={100}
            />
          </div>
        </div>
      </form>
    </EnglishQuestionFormShell>
  );
};

export default CreateEnglishVocabularyQuestion;
