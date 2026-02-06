import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, useLocation, Link } from 'react-router-dom';
import axiosInstance from '../../utils/axios';
import './VendorAdminCommon.css';
import './CreateAptitudeQuestion.css';

const defaultConfig = {
  similarityWeight: 0.5,
  conceptWeight: 0.3,
  depthWeight: 0.2,
  strictness: 'moderate'
};

const CreateTheoryQuestion = () => {
  const { id } = useParams();
  const location = useLocation();
  const isGlobal = location.pathname.includes('/super-admin/');
  const navigate = useNavigate();

  const [subjects, setSubjects] = useState([]);
  const [topics, setTopics] = useState([]);
  const [newSubject, setNewSubject] = useState('');
  const [newTopic, setNewTopic] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    questionText: '',
    subjectId: '',
    topicId: '',
    difficulty: 'medium',
    maxMarks: 10,
    expectedAnswerLength: 150,
    referenceAnswer: '',
    keywords: '',
    evaluationRubric: '',
    tags: '',
    evaluationConfig: { ...defaultConfig }
  });

  useEffect(() => {
    fetchSubjects();
  }, []);

  useEffect(() => {
    if (formData.subjectId) {
      fetchTopics(formData.subjectId);
    } else {
      setTopics([]);
    }
  }, [formData.subjectId]);

  useEffect(() => {
    if (id) {
      fetchQuestion();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run when id changes
  }, [id]);

  const fetchSubjects = async () => {
    try {
      const response = await axiosInstance.get('/subjects');
      setSubjects(response.data || []);
    } catch (err) {
      setSubjects([]);
    }
  };

  const fetchTopics = async (subjectId) => {
    try {
      const response = await axiosInstance.get(`/topics?subjectId=${subjectId}`);
      setTopics(response.data || []);
    } catch (err) {
      setTopics([]);
    }
  };

  const fetchQuestion = async () => {
    try {
      setLoading(true);
      const endpoint = isGlobal ? `/super-admin/global-questions/theory/${id}` : `/questions/theory/${id}`;
      const response = await axiosInstance.get(endpoint);
      const data = response.data;
      setFormData({
        questionText: data.questionText || '',
        subjectId: data.subjectId?._id || data.subjectId || '',
        topicId: data.topicId?._id || data.topicId || '',
        difficulty: data.difficulty || 'medium',
        maxMarks: data.maxMarks || 10,
        expectedAnswerLength: data.expectedAnswerLength || 150,
        referenceAnswer: data.referenceAnswer || '',
        keywords: (data.keywords || []).join(', '),
        evaluationRubric: data.evaluationRubric || '',
        tags: (data.tags || []).join(', '),
        evaluationConfig: {
          similarityWeight: data.evaluationConfig?.similarityWeight ?? 0.5,
          conceptWeight: data.evaluationConfig?.conceptWeight ?? 0.3,
          depthWeight: data.evaluationConfig?.depthWeight ?? 0.2,
          strictness: data.evaluationConfig?.strictness || 'moderate'
        }
      });
    } catch (err) {
      setError('Failed to load question');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleConfigChange = (e) => {
    setFormData(prev => ({
      ...prev,
      evaluationConfig: {
        ...prev.evaluationConfig,
        [e.target.name]: e.target.name === 'strictness' ? e.target.value : Number(e.target.value)
      }
    }));
  };

  const handleCreateSubject = async () => {
    if (!newSubject.trim()) return;
    try {
      const response = await axiosInstance.post('/subjects', { name: newSubject.trim() });
      setSubjects(prev => [response.data, ...prev]);
      setFormData(prev => ({ ...prev, subjectId: response.data._id, topicId: '' }));
      setNewSubject('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create subject');
    }
  };

  const handleCreateTopic = async () => {
    if (!newTopic.trim() || !formData.subjectId) return;
    try {
      const response = await axiosInstance.post('/topics', {
        name: newTopic.trim(),
        subjectId: formData.subjectId
      });
      setTopics(prev => [response.data, ...prev]);
      setFormData(prev => ({ ...prev, topicId: response.data._id }));
      setNewTopic('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create topic');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const payload = {
        questionText: formData.questionText,
        subjectId: formData.subjectId,
        topicId: formData.topicId || undefined,
        difficulty: formData.difficulty,
        maxMarks: Number(formData.maxMarks) || 10,
        expectedAnswerLength: Number(formData.expectedAnswerLength) || 150,
        referenceAnswer: formData.referenceAnswer,
        keywords: formData.keywords.split(',').map(k => k.trim()).filter(Boolean),
        evaluationRubric: formData.evaluationRubric,
        evaluationConfig: formData.evaluationConfig,
        tags: formData.tags.split(',').map(t => t.trim()).filter(Boolean)
      };
      const endpoint = isGlobal ? '/super-admin/global-questions/theory' : '/questions/theory';
      if (id) {
        await axiosInstance.put(`${endpoint}/${id}`, payload);
      } else {
        await axiosInstance.post(endpoint, payload);
      }
      navigate(isGlobal ? '/super-admin/global-questions' : '/vendor-admin/questions');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save question');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="container">
      <div className="page-header">
        <h1 className="page-title">{id ? 'Edit' : 'Create'} Theory Question</h1>
        <Link to={isGlobal ? '/super-admin/global-questions' : '/vendor-admin/questions'} className="btn btn-secondary">
          Back to Questions
        </Link>
      </div>

      {error && (
        <div className="error" style={{ marginBottom: '20px' }}>
          {error}
        </div>
      )}

      <div className="card">
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Question Text *</label>
            <textarea
              name="questionText"
              value={formData.questionText}
              onChange={handleChange}
              rows="4"
              required
              placeholder="Describe the question to be evaluated..."
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Subject *</label>
              <select name="subjectId" value={formData.subjectId} onChange={handleChange} required>
                <option value="">Select Subject</option>
                {subjects.map(subject => (
                  <option key={subject._id} value={subject._id}>{subject.name}</option>
                ))}
              </select>
              <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                <input
                  type="text"
                  value={newSubject}
                  onChange={(e) => setNewSubject(e.target.value)}
                  placeholder="Add new subject"
                />
                <button type="button" className="btn btn-secondary" onClick={handleCreateSubject}>
                  Add
                </button>
              </div>
            </div>

            <div className="form-group">
              <label>Topic</label>
              <select name="topicId" value={formData.topicId} onChange={handleChange}>
                <option value="">Select Topic</option>
                {topics.map(topic => (
                  <option key={topic._id} value={topic._id}>{topic.name}</option>
                ))}
              </select>
              <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                <input
                  type="text"
                  value={newTopic}
                  onChange={(e) => setNewTopic(e.target.value)}
                  placeholder="Add new topic"
                  disabled={!formData.subjectId}
                />
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleCreateTopic}
                  disabled={!formData.subjectId}
                >
                  Add
                </button>
              </div>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Difficulty</label>
              <select name="difficulty" value={formData.difficulty} onChange={handleChange}>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
            <div className="form-group">
              <label>Max Marks</label>
              <input
                type="number"
                name="maxMarks"
                min="1"
                value={formData.maxMarks}
                onChange={handleChange}
              />
            </div>
            <div className="form-group">
              <label>Expected Answer Length (words)</label>
              <input
                type="number"
                name="expectedAnswerLength"
                min="50"
                value={formData.expectedAnswerLength}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="form-group">
            <label>Reference Answer *</label>
            <textarea
              name="referenceAnswer"
              value={formData.referenceAnswer}
              onChange={handleChange}
              rows="6"
              required
              placeholder="Provide the ideal/reference answer"
            />
          </div>

          <div className="form-group">
            <label>Keywords (comma-separated)</label>
            <input
              type="text"
              name="keywords"
              value={formData.keywords}
              onChange={handleChange}
              placeholder="e.g., deadlock, mutual exclusion, hold and wait"
            />
          </div>

          <div className="form-group">
            <label>Evaluation Rubric (optional)</label>
            <textarea
              name="evaluationRubric"
              value={formData.evaluationRubric}
              onChange={handleChange}
              rows="4"
              placeholder="Provide detailed rubric or expectations"
            />
          </div>

          <div className="form-group">
            <label>Tags (comma-separated)</label>
            <input
              type="text"
              name="tags"
              value={formData.tags}
              onChange={handleChange}
              placeholder="OS, scheduling, theory"
            />
          </div>

          <div className="card" style={{ marginTop: '20px' }}>
            <h3 style={{ marginBottom: '15px' }}>Evaluation Rules</h3>
            <div className="form-row">
              <div className="form-group">
                <label>Similarity Weight</label>
                <input
                  type="number"
                  name="similarityWeight"
                  step="0.05"
                  min="0"
                  max="1"
                  value={formData.evaluationConfig.similarityWeight}
                  onChange={handleConfigChange}
                />
              </div>
              <div className="form-group">
                <label>Concept Coverage Weight</label>
                <input
                  type="number"
                  name="conceptWeight"
                  step="0.05"
                  min="0"
                  max="1"
                  value={formData.evaluationConfig.conceptWeight}
                  onChange={handleConfigChange}
                />
              </div>
              <div className="form-group">
                <label>Depth Weight</label>
                <input
                  type="number"
                  name="depthWeight"
                  step="0.05"
                  min="0"
                  max="1"
                  value={formData.evaluationConfig.depthWeight}
                  onChange={handleConfigChange}
                />
              </div>
              <div className="form-group">
                <label>Strictness</label>
                <select name="strictness" value={formData.evaluationConfig.strictness} onChange={handleConfigChange}>
                  <option value="lenient">Lenient</option>
                  <option value="moderate">Moderate</option>
                  <option value="strict">Strict</option>
                </select>
              </div>
            </div>
          </div>

          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={() => navigate(-1)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving...' : (id ? 'Update Question' : 'Create Question')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateTheoryQuestion;

