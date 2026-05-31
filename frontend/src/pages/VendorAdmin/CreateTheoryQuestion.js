import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import axiosInstance from '../../utils/axios';
import RichTextEditor from '../../components/RichTextEditor';
import VendorQuestionFormPage from '../../components/VendorAdmin/VendorQuestionFormPage';
import TagInput from '../../components/TagInput';
import { normalizeTags } from '../../utils/tagUtils';
import { QUESTION_FORM_META } from '../../utils/vendorQuestionFormMeta';
import { isRichTextEmpty } from '../../utils/richTextUtils';
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
  const [pageLoading, setPageLoading] = useState(false);
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
    tags: [],
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
      setPageLoading(true);
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
        tags: normalizeTags(data.tags || []),
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
      setPageLoading(false);
    }
  };

  const meta = QUESTION_FORM_META.theory;
  const backTo = isGlobal ? '/super-admin/global-questions' : meta.back;

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
    if (isRichTextEmpty(formData.questionText)) {
      setError('Question text is required');
      return;
    }
    if (isRichTextEmpty(formData.referenceAnswer)) {
      setError('Reference answer is required');
      return;
    }
    if (!formData.subjectId) {
      setError('Subject is required');
      return;
    }
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
        tags: normalizeTags(formData.tags)
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

  const formFooter = (
    <div className="form-actions">
      <button type="button" className="btn btn-secondary" onClick={() => navigate(backTo)}>Cancel</button>
      <button type="submit" form="theory-question-form" className="btn btn-primary" disabled={saving}>
        {saving ? 'Saving…' : id ? 'Update question' : 'Create question'}
      </button>
    </div>
  );

  return (
    <VendorQuestionFormPage
      className="create-theory-question"
      loading={pageLoading}
      backTo={backTo}
      backLabel="Back to questions"
      eyebrow={meta.label}
      title={id ? meta.editTitle : meta.createTitle}
      subtitle={meta.subtitle}
      accent={meta.accent}
      isGlobal={isGlobal}
      error={error}
      footer={formFooter}
    >
      <form id="theory-question-form" onSubmit={handleSubmit} className="question-form">
        <div className="form-section">
          <h2 className="section-title">Question</h2>
          <div className="vqf-rich-field">
            <label>Question text *</label>
            <RichTextEditor
              variant="full"
              value={formData.questionText}
              onChange={(html) => setFormData((prev) => ({ ...prev, questionText: html }))}
              placeholder="Describe what the student should answer…"
              minHeight={160}
            />
          </div>
        </div>

        <div className="form-section">
          <h2 className="section-title">Classification</h2>
          <div className="form-row">
            <div className="form-group">
              <label>Subject *</label>
              <select name="subjectId" value={formData.subjectId} onChange={handleChange} className="form-select" required>
                <option value="">Select subject</option>
                {subjects.map(subject => (
                  <option key={subject._id} value={subject._id}>{subject.name}</option>
                ))}
              </select>
              <div className="vqf-inline-add">
                <input
                  type="text"
                  className="form-input"
                  value={newSubject}
                  onChange={(e) => setNewSubject(e.target.value)}
                  placeholder="New subject name"
                />
                <button type="button" className="btn btn-secondary btn-sm" onClick={handleCreateSubject}>Add</button>
              </div>
            </div>

            <div className="form-group">
              <label>Topic</label>
              <select name="topicId" value={formData.topicId} onChange={handleChange} className="form-select">
                <option value="">Select topic</option>
                {topics.map(topic => (
                  <option key={topic._id} value={topic._id}>{topic.name}</option>
                ))}
              </select>
              <div className="vqf-inline-add">
                <input
                  type="text"
                  className="form-input"
                  value={newTopic}
                  onChange={(e) => setNewTopic(e.target.value)}
                  placeholder="New topic name"
                  disabled={!formData.subjectId}
                />
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
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
              <select name="difficulty" value={formData.difficulty} onChange={handleChange} className="form-select">
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
            <div className="form-group">
              <label>Max marks</label>
              <input type="number" name="maxMarks" min="1" className="form-input" value={formData.maxMarks} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label>Expected answer length (words)</label>
              <input type="number" name="expectedAnswerLength" min="50" className="form-input" value={formData.expectedAnswerLength} onChange={handleChange} />
            </div>
          </div>
        </div>

        <div className="form-section">
          <h2 className="section-title">Answer & evaluation</h2>
          <div className="vqf-rich-field">
            <label>Reference answer *</label>
            <RichTextEditor
              variant="full"
              value={formData.referenceAnswer}
              onChange={(html) => setFormData((prev) => ({ ...prev, referenceAnswer: html }))}
              placeholder="Ideal answer used for AI scoring…"
              minHeight={200}
            />
          </div>
          <div className="form-group">
            <label>Keywords (comma-separated)</label>
            <input type="text" name="keywords" className="form-input" value={formData.keywords} onChange={handleChange} placeholder="e.g., deadlock, mutual exclusion" />
          </div>
          <div className="form-group">
            <label>Evaluation rubric (optional)</label>
            <textarea name="evaluationRubric" className="form-textarea" value={formData.evaluationRubric} onChange={handleChange} rows="4" placeholder="Detailed rubric or expectations" />
          </div>
          <TagInput
            label="Tags"
            value={formData.tags}
            onChange={(tags) => setFormData((prev) => ({ ...prev, tags }))}
          />

          <div className="vqf-nested-card">
            <h3>Evaluation rules</h3>
            <div className="form-row">
              <div className="form-group">
                <label>Similarity weight</label>
                <input type="number" name="similarityWeight" className="form-input" step="0.05" min="0" max="1" value={formData.evaluationConfig.similarityWeight} onChange={handleConfigChange} />
              </div>
              <div className="form-group">
                <label>Concept coverage weight</label>
                <input type="number" name="conceptWeight" className="form-input" step="0.05" min="0" max="1" value={formData.evaluationConfig.conceptWeight} onChange={handleConfigChange} />
              </div>
              <div className="form-group">
                <label>Depth weight</label>
                <input type="number" name="depthWeight" className="form-input" step="0.05" min="0" max="1" value={formData.evaluationConfig.depthWeight} onChange={handleConfigChange} />
              </div>
              <div className="form-group">
                <label>Strictness</label>
                <select name="strictness" className="form-select" value={formData.evaluationConfig.strictness} onChange={handleConfigChange}>
                  <option value="lenient">Lenient</option>
                  <option value="moderate">Moderate</option>
                  <option value="strict">Strict</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </form>
    </VendorQuestionFormPage>
  );
};

export default CreateTheoryQuestion;

