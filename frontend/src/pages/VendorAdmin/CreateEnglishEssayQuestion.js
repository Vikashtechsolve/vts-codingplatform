import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import axiosInstance from '../../utils/axios';
import Modal from '../../components/Modal';
import './CreateEnglishQuestion.css';

const WRITING_TYPES = [
  { value: 'essay_general', label: 'General Essay' },
  { value: 'essay_opinion', label: 'Opinion Essay' },
  { value: 'essay_argumentative', label: 'Argumentative Essay' },
  { value: 'email_formal', label: 'Formal Email' },
  { value: 'email_informal', label: 'Informal Email' },
  { value: 'letter_formal', label: 'Formal Letter' },
  { value: 'letter_informal', label: 'Informal Letter' },
  { value: 'report', label: 'Report' },
  { value: 'notice', label: 'Notice' }
];

const FORMAT_TEMPLATES = {
  email_formal: 'To: [Recipient]\nSubject: [Subject]\n\nDear [Name],\n\n[Body]\n\nRegards,\n[Your Name]',
  email_informal: 'Hey [Name],\n\n[Body]\n\nCheers,\n[Your Name]',
  letter_formal: '[Your Address]\n[Date]\n\n[Recipient Address]\n\nDear Sir/Madam,\n\n[Body]\n\nYours faithfully,\n[Your Name]',
  letter_informal: '[Date]\n\nDear [Name],\n\n[Body]\n\nWith love,\n[Your Name]',
  report: 'Title: [Report Title]\nPrepared by: [Name]\nDate: [Date]\n\n1. Introduction\n2. Findings\n3. Recommendations\n4. Conclusion',
  notice: 'NOTICE\n[Organization Name]\nDate: [Date]\n\n[Subject]\n\n[Body]\n\n[Authorized Signatory]'
};

const CreateEnglishEssayQuestion = () => {
  const { id } = useParams();
  const isEditMode = !!id;
  useAuth();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    prompt: '',
    writingType: 'essay_general',
    instructions: '',
    wordLimit: { min: 100, max: 500 },
    timeLimit: '',
    sampleResponse: '',
    expectedFormat: '',
    evaluationWeights: {
      grammar: 0.20,
      vocabulary: 0.15,
      coherence: 0.20,
      structure: 0.15,
      tone: 0.15,
      relevance: 0.15
    },
    difficulty: 'medium',
    points: 20
  });
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState({ isOpen: false, title: '', message: '', type: 'info' });

  const fetchQuestion = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axiosInstance.get(`/questions/english/essay/${id}`);
      const q = res.data;
      setFormData({
        prompt: q.prompt || '',
        writingType: q.writingType || 'essay_general',
        instructions: q.instructions || '',
        wordLimit: q.wordLimit || { min: 100, max: 500 },
        timeLimit: q.timeLimit || '',
        sampleResponse: q.sampleResponse || '',
        expectedFormat: q.expectedFormat || '',
        evaluationWeights: q.evaluationWeights || { grammar: 0.20, vocabulary: 0.15, coherence: 0.20, structure: 0.15, tone: 0.15, relevance: 0.15 },
        difficulty: q.difficulty || 'medium',
        points: q.points || 20
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

  const handleWeightChange = (key, value) => {
    setFormData({ ...formData, evaluationWeights: { ...formData.evaluationWeights, [key]: parseFloat(value) || 0 } });
  };

  const handleWritingTypeChange = (value) => {
    const format = FORMAT_TEMPLATES[value] || '';
    setFormData({ ...formData, writingType: value, expectedFormat: format || formData.expectedFormat });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.prompt.trim()) return showModal('Error', 'Prompt is required', 'error');

    setLoading(true);
    try {
      const data = { ...formData, timeLimit: formData.timeLimit ? parseInt(formData.timeLimit) : null };
      if (isEditMode) {
        await axiosInstance.put(`/questions/english/essay/${id}`, data);
        showModal('Success', 'Question updated!', 'success');
      } else {
        await axiosInstance.post('/questions/english/essay', data);
        showModal('Success', 'Question created!', 'success');
      }
      setTimeout(() => navigate('/vendor-admin/english-questions'), 1500);
    } catch (error) {
      showModal('Error', error.response?.data?.message || 'Error saving', 'error');
    } finally {
      setLoading(false);
    }
  };

  const isEmailLetter = ['email_formal', 'email_informal', 'letter_formal', 'letter_informal', 'report', 'notice'].includes(formData.writingType);

  return (
    <div className="container create-english-question">
      <Modal isOpen={modal.isOpen} onClose={closeModal} title={modal.title} type={modal.type}>
        <p>{modal.message}</p>
      </Modal>

      <div className="page-header">
        <h1 className="page-title">{isEditMode ? 'Edit' : 'Create'} {isEmailLetter ? 'Email / Letter' : 'Essay'} Question</h1>
        <button onClick={() => navigate('/vendor-admin/english-questions')} className="btn btn-secondary">Back</button>
      </div>

      <form onSubmit={handleSubmit} className="question-form">
        <div className="form-section">
          <h2 className="section-title">Writing Prompt</h2>
          <div className="form-row">
            <div className="form-group">
              <label>Writing Type *</label>
              <select name="writingType" value={formData.writingType} onChange={(e) => handleWritingTypeChange(e.target.value)} className="form-select">
                {WRITING_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Difficulty</label>
              <select name="difficulty" value={formData.difficulty} onChange={handleChange} className="form-select">
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
          </div>
          <div className="form-group full-width">
            <label>Prompt / Topic *</label>
            <textarea name="prompt" value={formData.prompt} onChange={handleChange} rows="4" placeholder="e.g., Write an essay on the impact of social media on youth..." className="form-textarea" required />
          </div>
          <div className="form-group full-width">
            <label>Instructions (Optional)</label>
            <textarea name="instructions" value={formData.instructions} onChange={handleChange} rows="3" placeholder="Additional instructions for the student..." className="form-textarea" />
          </div>
        </div>

        <div className="form-section">
          <h2 className="section-title">Limits & Settings</h2>
          <div className="form-row">
            <div className="form-group">
              <label>Min Words</label>
              <input type="number" value={formData.wordLimit.min} onChange={(e) => setFormData({ ...formData, wordLimit: { ...formData.wordLimit, min: parseInt(e.target.value) || 0 } })} min="0" className="form-input" />
            </div>
            <div className="form-group">
              <label>Max Words</label>
              <input type="number" value={formData.wordLimit.max} onChange={(e) => setFormData({ ...formData, wordLimit: { ...formData.wordLimit, max: parseInt(e.target.value) || 500 } })} min="1" className="form-input" />
            </div>
            <div className="form-group">
              <label>Time Limit (minutes)</label>
              <input type="number" name="timeLimit" value={formData.timeLimit} onChange={handleChange} placeholder="Optional" min="1" className="form-input" />
            </div>
            <div className="form-group">
              <label>Points</label>
              <input type="number" name="points" value={formData.points} onChange={handleChange} min="1" className="form-input" />
            </div>
          </div>
        </div>

        {isEmailLetter && (
          <div className="form-section">
            <h2 className="section-title">Expected Format Template</h2>
            <div className="form-group full-width">
              <textarea name="expectedFormat" value={formData.expectedFormat} onChange={handleChange} rows="8" placeholder="Format template shown as a guide to the student..." className="form-textarea mono-text" />
            </div>
          </div>
        )}

        <div className="form-section">
          <h2 className="section-title">AI Evaluation Weights</h2>
          <p className="section-desc">Adjust how much each criterion weighs in the AI evaluation (should sum to ~1.0)</p>
          <div className="weights-grid">
            {Object.entries(formData.evaluationWeights).map(([key, val]) => (
              <div key={key} className="weight-item">
                <label>{key.charAt(0).toUpperCase() + key.slice(1)}</label>
                <input type="number" value={val} onChange={(e) => handleWeightChange(key, e.target.value)} step="0.05" min="0" max="1" className="form-input" />
              </div>
            ))}
          </div>
        </div>

        <div className="form-section">
          <h2 className="section-title">Sample Response (Optional)</h2>
          <div className="form-group full-width">
            <textarea name="sampleResponse" value={formData.sampleResponse} onChange={handleChange} rows="8" placeholder="A model answer for AI to reference during evaluation..." className="form-textarea" />
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

export default CreateEnglishEssayQuestion;
