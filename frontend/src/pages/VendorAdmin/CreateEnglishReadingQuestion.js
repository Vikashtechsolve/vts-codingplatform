import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import axiosInstance from '../../utils/axios';
import Modal from '../../components/Modal';
import './CreateEnglishQuestion.css';

const GENRES = [
  { value: 'fiction', label: 'Fiction' },
  { value: 'non_fiction', label: 'Non-Fiction' },
  { value: 'editorial', label: 'Editorial' },
  { value: 'scientific', label: 'Scientific' },
  { value: 'business', label: 'Business' },
  { value: 'narrative', label: 'Narrative' },
  { value: 'descriptive', label: 'Descriptive' }
];

const QUESTION_TYPES = [
  { value: 'mcq', label: 'Multiple Choice' },
  { value: 'short_answer', label: 'Short Answer' },
  { value: 'true_false', label: 'True / False' },
  { value: 'inference', label: 'Inference' }
];

const emptySubQuestion = () => ({
  questionText: '',
  questionType: 'mcq',
  options: [{ text: '', isCorrect: false }, { text: '', isCorrect: false }],
  referenceAnswer: '',
  points: 5
});

const CreateEnglishReadingQuestion = () => {
  const { id } = useParams();
  const isEditMode = !!id;
  useAuth();
  const navigate = useNavigate();

  const [passage, setPassage] = useState({ title: '', content: '', source: '', genre: 'non_fiction' });
  const [questions, setQuestions] = useState([emptySubQuestion()]);
  const [difficulty, setDifficulty] = useState('medium');
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState({ isOpen: false, title: '', message: '', type: 'info' });

  const fetchQuestion = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axiosInstance.get(`/questions/english/reading/${id}`);
      const q = res.data;
      setPassage(q.passage || { title: '', content: '', source: '', genre: 'non_fiction' });
      setQuestions(q.questions?.length ? q.questions : [emptySubQuestion()]);
      setDifficulty(q.difficulty || 'medium');
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

  const handlePassageChange = (field, value) => setPassage({ ...passage, [field]: value });

  const handleQuestionChange = (index, field, value) => {
    const newQ = [...questions];
    newQ[index][field] = value;
    setQuestions(newQ);
  };

  const handleOptionChange = (qIdx, oIdx, field, value) => {
    const newQ = [...questions];
    newQ[qIdx].options[oIdx][field] = value;
    setQuestions(newQ);
  };

  const addOption = (qIdx) => {
    const newQ = [...questions];
    newQ[qIdx].options.push({ text: '', isCorrect: false });
    setQuestions(newQ);
  };

  const removeOption = (qIdx, oIdx) => {
    if (questions[qIdx].options.length <= 2) return;
    const newQ = [...questions];
    newQ[qIdx].options = newQ[qIdx].options.filter((_, i) => i !== oIdx);
    setQuestions(newQ);
  };

  const addQuestion = () => setQuestions([...questions, emptySubQuestion()]);

  const removeQuestion = (index) => {
    if (questions.length <= 1) return showModal('Warning', 'At least 1 question required', 'warning');
    setQuestions(questions.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!passage.title.trim() || !passage.content.trim()) return showModal('Error', 'Passage title and content are required', 'error');

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.questionText.trim()) return showModal('Error', `Question ${i + 1} text is required`, 'error');
      if ((q.questionType === 'mcq' || q.questionType === 'true_false')) {
        const opts = q.options.filter(o => o.text.trim());
        if (opts.length < 2) return showModal('Error', `Question ${i + 1} needs at least 2 options`, 'error');
        if (!opts.some(o => o.isCorrect)) return showModal('Error', `Question ${i + 1} needs a correct answer`, 'error');
      }
      if ((q.questionType === 'short_answer' || q.questionType === 'inference') && !q.referenceAnswer.trim()) {
        return showModal('Error', `Question ${i + 1} needs a reference answer`, 'error');
      }
    }

    setLoading(true);
    try {
      const data = { passage, questions, difficulty };
      if (isEditMode) {
        await axiosInstance.put(`/questions/english/reading/${id}`, data);
        showModal('Success', 'Reading passage updated!', 'success');
      } else {
        await axiosInstance.post('/questions/english/reading', data);
        showModal('Success', 'Reading passage created!', 'success');
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
        <h1 className="page-title">{isEditMode ? 'Edit' : 'Create'} Reading Comprehension</h1>
        <button onClick={() => navigate('/vendor-admin/english-questions')} className="btn btn-secondary">Back</button>
      </div>

      <form onSubmit={handleSubmit} className="question-form">
        <div className="form-section">
          <h2 className="section-title">Passage</h2>
          <div className="form-row">
            <div className="form-group">
              <label>Title *</label>
              <input type="text" value={passage.title} onChange={(e) => handlePassageChange('title', e.target.value)} className="form-input" required />
            </div>
            <div className="form-group">
              <label>Genre</label>
              <select value={passage.genre} onChange={(e) => handlePassageChange('genre', e.target.value)} className="form-select">
                {GENRES.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
              </select>
            </div>
          </div>
          <div className="form-group full-width">
            <label>Passage Content *</label>
            <textarea value={passage.content} onChange={(e) => handlePassageChange('content', e.target.value)} rows="12" placeholder="Paste or type the passage here..." className="form-textarea" required />
            <div className="word-count">Words: {passage.content.split(/\s+/).filter(Boolean).length}</div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Source (Optional)</label>
              <input type="text" value={passage.source} onChange={(e) => handlePassageChange('source', e.target.value)} placeholder="e.g., The Hindu, 2024" className="form-input" />
            </div>
            <div className="form-group">
              <label>Difficulty</label>
              <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} className="form-select">
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
          </div>
        </div>

        <div className="form-section">
          <div className="section-header">
            <h2 className="section-title">Questions ({questions.length})</h2>
            <button type="button" onClick={addQuestion} className="btn btn-secondary btn-sm">+ Add Question</button>
          </div>

          {questions.map((q, qIdx) => (
            <div key={qIdx} className="sub-question-card">
              <div className="sub-question-header">
                <h3>Question {qIdx + 1}</h3>
                <button type="button" onClick={() => removeQuestion(qIdx)} className="btn-icon btn-danger" disabled={questions.length <= 1}>x</button>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Type</label>
                  <select value={q.questionType} onChange={(e) => handleQuestionChange(qIdx, 'questionType', e.target.value)} className="form-select">
                    {QUESTION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Points</label>
                  <input type="number" value={q.points} onChange={(e) => handleQuestionChange(qIdx, 'points', parseInt(e.target.value) || 5)} min="1" className="form-input" />
                </div>
              </div>
              <div className="form-group full-width">
                <label>Question Text *</label>
                <textarea value={q.questionText} onChange={(e) => handleQuestionChange(qIdx, 'questionText', e.target.value)} rows="2" className="form-textarea" />
              </div>

              {(q.questionType === 'mcq' || q.questionType === 'true_false') && (
                <div className="sub-options">
                  <div className="sub-options-header">
                    <span>Options</span>
                    {q.questionType === 'mcq' && <button type="button" onClick={() => addOption(qIdx)} className="btn btn-secondary btn-sm">+ Option</button>}
                  </div>
                  {q.options.map((opt, oIdx) => (
                    <div key={oIdx} className="sub-option-row">
                      <input type="text" value={opt.text} onChange={(e) => handleOptionChange(qIdx, oIdx, 'text', e.target.value)} placeholder={`Option ${oIdx + 1}`} className="form-input" />
                      <label className="correct-checkbox">
                        <input type="checkbox" checked={opt.isCorrect} onChange={(e) => handleOptionChange(qIdx, oIdx, 'isCorrect', e.target.checked)} />
                        <span className="correct-label">Correct</span>
                      </label>
                      {q.options.length > 2 && <button type="button" onClick={() => removeOption(qIdx, oIdx)} className="btn-icon btn-danger">x</button>}
                    </div>
                  ))}
                </div>
              )}

              {(q.questionType === 'short_answer' || q.questionType === 'inference') && (
                <div className="form-group full-width">
                  <label>Reference Answer *</label>
                  <textarea value={q.referenceAnswer} onChange={(e) => handleQuestionChange(qIdx, 'referenceAnswer', e.target.value)} rows="3" placeholder="Expected answer for AI evaluation..." className="form-textarea" />
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="form-actions">
          <button type="button" onClick={() => navigate('/vendor-admin/english-questions')} className="btn btn-secondary">Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Saving...' : isEditMode ? 'Update' : 'Create'}</button>
        </div>
      </form>
    </div>
  );
};

export default CreateEnglishReadingQuestion;
