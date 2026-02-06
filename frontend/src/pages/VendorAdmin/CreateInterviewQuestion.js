import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import axiosInstance from '../../utils/axios';
import Modal from '../../components/Modal';
import './CreateInterviewQuestion.css';

const defaultRubric = { title: '', description: '', weight: 1 };

const CreateInterviewQuestion = () => {
  const { id } = useParams();
  const location = useLocation();
  const isEditMode = !!id;
  const isGlobal = location.pathname.includes('/super-admin');
  const apiBase = isGlobal ? '/super-admin/interview-questions' : '/interview-questions';
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    question: '',
    interviewType: '',
    topic: '',
    difficulty: 'beginner',
    expectedAnswer: '',
    rubrics: [defaultRubric],
    followUpHints: [''],
    points: 10
  });
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState({ isOpen: false, title: '', message: '', type: 'info' });

  useEffect(() => {
    if (isEditMode) {
      fetchQuestion();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run when id or isEditMode changes
  }, [id, isEditMode]);

  const fetchQuestion = async () => {
    try {
      setLoading(true);
      const response = await axiosInstance.get(`${apiBase}/${id}`);
      const q = response.data;
      setFormData({
        question: q.question || '',
        interviewType: q.interviewType || '',
        topic: q.topic || '',
        difficulty: q.difficulty || 'beginner',
        expectedAnswer: q.expectedAnswer || '',
        rubrics: q.rubrics?.length ? q.rubrics : [defaultRubric],
        followUpHints: q.followUpHints?.length ? q.followUpHints : [''],
        points: q.points || 10
      });
    } catch (error) {
      showModal('Error', error.response?.data?.message || 'Failed to load question', 'error');
    } finally {
      setLoading(false);
    }
  };

  const showModal = (title, message, type = 'info') => {
    setModal({ isOpen: true, title, message, type });
  };

  const closeModal = () => setModal({ isOpen: false, title: '', message: '', type: 'info' });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleRubricChange = (index, field, value) => {
    const updated = [...formData.rubrics];
    updated[index][field] = value;
    setFormData({ ...formData, rubrics: updated });
  };

  const addRubric = () => setFormData({ ...formData, rubrics: [...formData.rubrics, { ...defaultRubric }] });
  const removeRubric = (index) => {
    if (formData.rubrics.length <= 1) return;
    const updated = formData.rubrics.filter((_, i) => i !== index);
    setFormData({ ...formData, rubrics: updated });
  };

  const handleHintChange = (index, value) => {
    const updated = [...formData.followUpHints];
    updated[index] = value;
    setFormData({ ...formData, followUpHints: updated });
  };

  const addHint = () => setFormData({ ...formData, followUpHints: [...formData.followUpHints, ''] });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.question.trim() || !formData.interviewType.trim() || !formData.topic.trim()) {
      showModal('Validation Error', 'Question, type, and topic are required', 'error');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        ...formData,
        rubrics: formData.rubrics.filter(r => r.title.trim()),
        followUpHints: formData.followUpHints.filter(h => h.trim())
      };
      if (isEditMode) {
        await axiosInstance.put(`${apiBase}/${id}`, payload);
        showModal('Success', 'Question updated successfully!', 'success');
      } else {
        await axiosInstance.post(apiBase, payload);
        showModal('Success', 'Question created successfully!', 'success');
      }
      setTimeout(() => {
        navigate(isGlobal ? '/super-admin/interview-questions' : '/vendor-admin/interview-questions');
      }, 1200);
    } catch (error) {
      showModal('Error', error.response?.data?.message || 'Failed to save question', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container create-interview-question">
      <Modal isOpen={modal.isOpen} onClose={closeModal} title={modal.title} type={modal.type}>
        <p>{modal.message}</p>
      </Modal>

      <div className="page-header">
        <h1 className="page-title">{isEditMode ? 'Edit' : 'Create'} Interview Question</h1>
        <button
          className="btn btn-secondary"
          onClick={() => navigate(isGlobal ? '/super-admin/interview-questions' : '/vendor-admin/interview-questions')}
        >
          Back to Questions
        </button>
      </div>

      <form onSubmit={handleSubmit} className="question-form">
        <div className="form-section">
          <h2 className="section-title">Question Details</h2>
          <div className="form-group full-width">
            <label>Question *</label>
            <textarea name="question" value={formData.question} onChange={handleChange} rows="4" />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Interview Type *</label>
              <input name="interviewType" value={formData.interviewType} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label>Topic *</label>
              <input name="topic" value={formData.topic} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label>Difficulty</label>
              <select name="difficulty" value={formData.difficulty} onChange={handleChange}>
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>
          </div>
        </div>

        <div className="form-section">
          <h2 className="section-title">Expected Answer (Optional)</h2>
          <textarea name="expectedAnswer" value={formData.expectedAnswer} onChange={handleChange} rows="3" />
        </div>

        <div className="form-section">
          <div className="section-header">
            <h2 className="section-title">Rubrics</h2>
            <button type="button" className="btn btn-secondary btn-sm" onClick={addRubric}>+ Add Rubric</button>
          </div>
          {formData.rubrics.map((rubric, index) => (
            <div key={index} className="rubric-card">
              <input
                placeholder="Rubric title"
                value={rubric.title}
                onChange={(e) => handleRubricChange(index, 'title', e.target.value)}
              />
              <input
                placeholder="Description"
                value={rubric.description}
                onChange={(e) => handleRubricChange(index, 'description', e.target.value)}
              />
              <input
                type="number"
                min="1"
                value={rubric.weight}
                onChange={(e) => handleRubricChange(index, 'weight', e.target.value)}
              />
              <button type="button" className="btn btn-danger btn-sm" onClick={() => removeRubric(index)}>
                Remove
              </button>
            </div>
          ))}
        </div>

        <div className="form-section">
          <div className="section-header">
            <h2 className="section-title">Follow-up Hints</h2>
            <button type="button" className="btn btn-secondary btn-sm" onClick={addHint}>+ Add Hint</button>
          </div>
          {formData.followUpHints.map((hint, index) => (
            <input
              key={index}
              value={hint}
              onChange={(e) => handleHintChange(index, e.target.value)}
              placeholder={`Hint ${index + 1}`}
            />
          ))}
        </div>

        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Saving...' : 'Save Question'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreateInterviewQuestion;
