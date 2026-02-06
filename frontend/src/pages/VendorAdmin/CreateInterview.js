import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axiosInstance from '../../utils/axios';
import './CreateInterview.css';

const CreateInterview = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    interviewType: '',
    topic: '',
    difficulty: 'beginner',
    duration: 20,
    questionCount: 6,
    questions: [],
    settings: {
      allowFollowUps: true,
      maxFollowUps: 2,
      adaptiveDifficulty: true,
      allowMultipleAttempts: false,
      showResults: true
    }
  });
  const [questions, setQuestions] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [questionSource, setQuestionSource] = useState('my');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchQuestions();
  }, []);

  useEffect(() => {
    const term = searchTerm.toLowerCase();
    const sourceFiltered = questions.filter(q =>
      questionSource === 'my' ? q.source === 'vendor' : q.source === 'global'
    );
    setFiltered(sourceFiltered.filter(q =>
      q.question.toLowerCase().includes(term) ||
      q.topic?.toLowerCase().includes(term) ||
      q.interviewType?.toLowerCase().includes(term)
    ));
  }, [questions, searchTerm, questionSource]);

  const fetchQuestions = async () => {
    try {
      const response = await axiosInstance.get('/interview-questions');
      setQuestions(response.data || []);
      setFiltered(response.data || []);
    } catch (error) {
      console.error('Error fetching interview questions:', error);
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const toggleSetting = (key) => {
    setFormData({
      ...formData,
      settings: { ...formData.settings, [key]: !formData.settings[key] }
    });
  };

  const handleAddQuestion = (questionId) => {
    if (formData.questions.some(q => q.questionId === questionId)) return;
    const order = formData.questions.length + 1;
    setFormData({
      ...formData,
      questions: [...formData.questions, { questionId, order }]
    });
  };

  const handleRemoveQuestion = (index) => {
    const updated = formData.questions.filter((_, i) => i !== index);
    setFormData({ ...formData, questions: updated });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const payload = {
        ...formData,
        questions: formData.questions
      };
      await axiosInstance.post('/interviews', payload);
      navigate('/vendor-admin/interviews');
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to create interview');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container create-interview">
      <div className="page-header">
        <h1 className="page-title">Create Interview Test</h1>
        <Link to="/vendor-admin/interviews" className="btn btn-secondary">
          Back to Interviews
        </Link>
      </div>

      {error && <div className="error">{error}</div>}

      <form onSubmit={handleSubmit} className="interview-form">
        <div className="form-section">
          <h2>Interview Details</h2>
          <input name="title" placeholder="Interview Title" value={formData.title} onChange={handleChange} required />
          <textarea name="description" placeholder="Description" value={formData.description} onChange={handleChange} rows="3" />
          <div className="form-row">
            <input name="interviewType" placeholder="Interview Type" value={formData.interviewType} onChange={handleChange} required />
            <input name="topic" placeholder="Topic" value={formData.topic} onChange={handleChange} required />
            <select name="difficulty" value={formData.difficulty} onChange={handleChange}>
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
          </div>
          <div className="form-row">
            <input type="number" name="duration" value={formData.duration} onChange={handleChange} min="5" />
            <input type="number" name="questionCount" value={formData.questionCount} onChange={handleChange} min="1" />
          </div>
        </div>

        <div className="form-section">
          <h2>Settings</h2>
          <div className="toggle-row">
            <label><input type="checkbox" checked={formData.settings.allowFollowUps} onChange={() => toggleSetting('allowFollowUps')} /> Allow follow-ups</label>
            <label><input type="checkbox" checked={formData.settings.adaptiveDifficulty} onChange={() => toggleSetting('adaptiveDifficulty')} /> Adaptive difficulty</label>
            <label><input type="checkbox" checked={formData.settings.allowMultipleAttempts} onChange={() => toggleSetting('allowMultipleAttempts')} /> Multiple attempts</label>
            <label><input type="checkbox" checked={formData.settings.showResults} onChange={() => toggleSetting('showResults')} /> Show results</label>
          </div>
        </div>

        <div className="form-section">
          <div className="section-header">
            <h2>Choose Questions</h2>
            <p className="form-hint">Add your own or global questions. Leave empty to let AI choose questions dynamically by type, topic, and difficulty.</p>
            <div className="btn-group">
              <button type="button" className={`btn ${questionSource === 'my' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setQuestionSource('my')}>My</button>
              <button type="button" className={`btn ${questionSource === 'global' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setQuestionSource('global')}>Global</button>
            </div>
          </div>
          <input
            className="search-input"
            placeholder="Search questions..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <div className="question-grid">
            {filtered.map(q => (
              <div key={q._id} className="question-card">
                <h4>{q.question}</h4>
                <p>{q.interviewType} · {q.topic} · {q.difficulty}</p>
                <button type="button" className="btn btn-primary btn-sm" onClick={() => handleAddQuestion(q._id)}>
                  Add Question
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="form-section">
          <h2>Selected Questions</h2>
          {formData.questions.length === 0 ? (
            <p>No questions selected yet.</p>
          ) : (
            <ul className="selected-list">
              {formData.questions.map((q, idx) => (
                <li key={idx}>
                  Question {idx + 1}
                  <button type="button" className="btn btn-danger btn-sm" onClick={() => handleRemoveQuestion(idx)}>
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? 'Creating...' : 'Create Interview'}
        </button>
      </form>
    </div>
  );
};

export default CreateInterview;
