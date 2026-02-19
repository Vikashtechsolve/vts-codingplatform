import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import axiosInstance from '../../utils/axios';
import Modal from '../../components/Modal';
import './CreateEnglishQuestion.css';

const SPEAKING_TYPES = [
  { value: 'read_aloud', label: 'Read Aloud' },
  { value: 'describe_image', label: 'Describe Image' },
  { value: 'topic_speaking', label: 'Topic Speaking' },
  { value: 'situational', label: 'Situational Response' },
  { value: 'extempore', label: 'Extempore' }
];

const CreateEnglishSpeakingQuestion = () => {
  const { id } = useParams();
  const isEditMode = !!id;
  useAuth();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    prompt: '',
    speakingType: 'topic_speaking',
    referenceText: '',
    preparationTime: 30,
    speakingTime: { min: 30, max: 120 },
    maxAttempts: 2,
    evaluationWeights: { pronunciation: 0.25, fluency: 0.25, coherence: 0.20, vocabulary: 0.15, grammar: 0.15 },
    difficulty: 'medium',
    points: 20
  });
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState({ isOpen: false, title: '', message: '', type: 'info' });

  const fetchQuestion = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axiosInstance.get(`/questions/english/speaking/${id}`);
      const q = res.data;
      setFormData({
        prompt: q.prompt || '',
        speakingType: q.speakingType || 'topic_speaking',
        referenceText: q.referenceText || '',
        preparationTime: q.preparationTime || 30,
        speakingTime: q.speakingTime || { min: 30, max: 120 },
        maxAttempts: q.maxAttempts || 2,
        evaluationWeights: q.evaluationWeights || { pronunciation: 0.25, fluency: 0.25, coherence: 0.20, vocabulary: 0.15, grammar: 0.15 },
        difficulty: q.difficulty || 'medium',
        points: q.points || 20
      });
      if (q.imageUrl) setImagePreview(q.imageUrl);
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

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleWeightChange = (key, value) => {
    setFormData({ ...formData, evaluationWeights: { ...formData.evaluationWeights, [key]: parseFloat(value) || 0 } });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.prompt.trim()) return showModal('Error', 'Prompt is required', 'error');
    if (formData.speakingType === 'read_aloud' && !formData.referenceText.trim()) return showModal('Error', 'Reference text required for Read Aloud', 'error');

    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('prompt', formData.prompt);
      fd.append('speakingType', formData.speakingType);
      fd.append('referenceText', formData.referenceText);
      fd.append('preparationTime', formData.preparationTime);
      fd.append('speakingTime', JSON.stringify(formData.speakingTime));
      fd.append('maxAttempts', formData.maxAttempts);
      fd.append('evaluationWeights', JSON.stringify(formData.evaluationWeights));
      fd.append('difficulty', formData.difficulty);
      fd.append('points', formData.points);
      if (imageFile) fd.append('image', imageFile);

      const config = { headers: { 'Content-Type': 'multipart/form-data' } };
      if (isEditMode) {
        await axiosInstance.put(`/questions/english/speaking/${id}`, fd, config);
        showModal('Success', 'Question updated!', 'success');
      } else {
        await axiosInstance.post('/questions/english/speaking', fd, config);
        showModal('Success', 'Question created!', 'success');
      }
      setTimeout(() => navigate('/vendor-admin/english-questions'), 1500);
    } catch (error) {
      showModal('Error', error.response?.data?.message || 'Error saving', 'error');
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
        <h1 className="page-title">{isEditMode ? 'Edit' : 'Create'} Speaking Question</h1>
        <button onClick={() => navigate('/vendor-admin/english-questions')} className="btn btn-secondary">Back</button>
      </div>

      <form onSubmit={handleSubmit} className="question-form">
        <div className="form-section">
          <h2 className="section-title">Speaking Prompt</h2>
          <div className="form-row">
            <div className="form-group">
              <label>Speaking Type *</label>
              <select name="speakingType" value={formData.speakingType} onChange={handleChange} className="form-select">
                {SPEAKING_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
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
            <textarea name="prompt" value={formData.prompt} onChange={handleChange} rows="4" placeholder="e.g., Describe your favorite place to visit and why you like it." className="form-textarea" required />
          </div>

          {formData.speakingType === 'read_aloud' && (
            <div className="form-group full-width">
              <label>Reference Text (text to read aloud) *</label>
              <textarea name="referenceText" value={formData.referenceText} onChange={handleChange} rows="6" placeholder="The passage that the student will read aloud..." className="form-textarea" />
            </div>
          )}

          {formData.speakingType === 'describe_image' && (
            <div className="form-group full-width">
              <label>Image</label>
              <input type="file" accept="image/*" onChange={handleImageChange} className="form-input" />
              {imagePreview && <img src={imagePreview} alt="Preview" className="image-preview" />}
            </div>
          )}
        </div>

        <div className="form-section">
          <h2 className="section-title">Timing & Attempts</h2>
          <div className="form-row">
            <div className="form-group">
              <label>Preparation Time (seconds)</label>
              <input type="number" name="preparationTime" value={formData.preparationTime} onChange={handleChange} min="0" className="form-input" />
            </div>
            <div className="form-group">
              <label>Min Speaking Time (sec)</label>
              <input type="number" value={formData.speakingTime.min} onChange={(e) => setFormData({ ...formData, speakingTime: { ...formData.speakingTime, min: parseInt(e.target.value) || 0 } })} min="0" className="form-input" />
            </div>
            <div className="form-group">
              <label>Max Speaking Time (sec)</label>
              <input type="number" value={formData.speakingTime.max} onChange={(e) => setFormData({ ...formData, speakingTime: { ...formData.speakingTime, max: parseInt(e.target.value) || 120 } })} min="1" className="form-input" />
            </div>
            <div className="form-group">
              <label>Max Attempts</label>
              <input type="number" name="maxAttempts" value={formData.maxAttempts} onChange={handleChange} min="1" max="5" className="form-input" />
            </div>
            <div className="form-group">
              <label>Points</label>
              <input type="number" name="points" value={formData.points} onChange={handleChange} min="1" className="form-input" />
            </div>
          </div>
        </div>

        <div className="form-section">
          <h2 className="section-title">Evaluation Weights</h2>
          <div className="weights-grid">
            {Object.entries(formData.evaluationWeights).map(([key, val]) => (
              <div key={key} className="weight-item">
                <label>{key.charAt(0).toUpperCase() + key.slice(1)}</label>
                <input type="number" value={val} onChange={(e) => handleWeightChange(key, e.target.value)} step="0.05" min="0" max="1" className="form-input" />
              </div>
            ))}
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

export default CreateEnglishSpeakingQuestion;
