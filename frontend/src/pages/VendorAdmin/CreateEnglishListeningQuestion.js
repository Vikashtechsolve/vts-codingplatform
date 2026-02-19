import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import axiosInstance from '../../utils/axios';
import Modal from '../../components/Modal';
import './CreateEnglishQuestion.css';

const QUESTION_TYPES = [
  { value: 'mcq', label: 'Multiple Choice' },
  { value: 'fill_in_blank', label: 'Fill in the Blank' },
  { value: 'short_answer', label: 'Short Answer' },
  { value: 'true_false', label: 'True / False' }
];

const emptySubQuestion = () => ({
  questionText: '',
  questionType: 'mcq',
  options: [{ text: '', isCorrect: false }, { text: '', isCorrect: false }],
  correctAnswer: '',
  points: 5
});

const CreateEnglishListeningQuestion = () => {
  const { id } = useParams();
  const isEditMode = !!id;
  useAuth();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    title: '',
    audioTranscript: '',
    audioDuration: '',
    maxReplays: 2,
    questionDelay: 0,
    difficulty: 'medium'
  });
  const [questions, setQuestions] = useState([emptySubQuestion()]);
  const [audioFile, setAudioFile] = useState(null);
  const [audioPreview, setAudioPreview] = useState('');
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState({ isOpen: false, title: '', message: '', type: 'info' });

  const fetchQuestion = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axiosInstance.get(`/questions/english/listening/${id}`);
      const q = res.data;
      setFormData({
        title: q.title || '',
        audioTranscript: q.audioTranscript || '',
        audioDuration: q.audioDuration || '',
        maxReplays: q.maxReplays ?? 2,
        questionDelay: q.questionDelay ?? 0,
        difficulty: q.difficulty || 'medium'
      });
      setQuestions(q.questions?.length ? q.questions : [emptySubQuestion()]);
      if (q.audioUrl) setAudioPreview(q.audioUrl);
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

  const handleAudioChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setAudioFile(file);
      setAudioPreview(URL.createObjectURL(file));
    }
  };

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
    if (questions.length <= 1) return;
    setQuestions(questions.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) return showModal('Error', 'Title is required', 'error');
    if (!audioFile && !audioPreview) return showModal('Error', 'Audio file is required', 'error');

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.questionText.trim()) return showModal('Error', `Question ${i + 1} text required`, 'error');
      if (q.questionType === 'mcq' || q.questionType === 'true_false') {
        const opts = q.options.filter(o => o.text.trim());
        if (opts.length < 2) return showModal('Error', `Question ${i + 1} needs 2+ options`, 'error');
        if (!opts.some(o => o.isCorrect)) return showModal('Error', `Question ${i + 1} needs a correct option`, 'error');
      }
    }

    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('title', formData.title);
      fd.append('audioTranscript', formData.audioTranscript);
      fd.append('audioDuration', formData.audioDuration);
      fd.append('maxReplays', formData.maxReplays);
      fd.append('questionDelay', formData.questionDelay);
      fd.append('difficulty', formData.difficulty);
      fd.append('questions', JSON.stringify(questions));
      if (audioFile) fd.append('audio', audioFile);

      const config = { headers: { 'Content-Type': 'multipart/form-data' } };
      if (isEditMode) {
        await axiosInstance.put(`/questions/english/listening/${id}`, fd, config);
        showModal('Success', 'Question updated!', 'success');
      } else {
        await axiosInstance.post('/questions/english/listening', fd, config);
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
        <h1 className="page-title">{isEditMode ? 'Edit' : 'Create'} Listening Question</h1>
        <button onClick={() => navigate('/vendor-admin/english-questions')} className="btn btn-secondary">Back</button>
      </div>

      <form onSubmit={handleSubmit} className="question-form">
        <div className="form-section">
          <h2 className="section-title">Audio Details</h2>
          <div className="form-row">
            <div className="form-group">
              <label>Title *</label>
              <input type="text" name="title" value={formData.title} onChange={handleChange} placeholder="e.g., Business Meeting Dialogue" className="form-input" required />
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
            <label>Audio File * (MP3, WAV, OGG, WebM)</label>
            <input type="file" accept="audio/*" onChange={handleAudioChange} className="form-input" />
            {audioPreview && (
              <div className="audio-preview">
                <audio controls src={audioPreview} />
              </div>
            )}
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Duration (seconds)</label>
              <input type="number" name="audioDuration" value={formData.audioDuration} onChange={handleChange} min="0" className="form-input" placeholder="Auto-detected if left blank" />
            </div>
            <div className="form-group">
              <label>Max Replays</label>
              <input type="number" name="maxReplays" value={formData.maxReplays} onChange={handleChange} min="0" max="10" className="form-input" />
            </div>
            <div className="form-group">
              <label>Question Delay (sec after audio)</label>
              <input type="number" name="questionDelay" value={formData.questionDelay} onChange={handleChange} min="0" className="form-input" />
            </div>
          </div>
          <div className="form-group full-width">
            <label>Audio Transcript (hidden from students, used for AI evaluation)</label>
            <textarea name="audioTranscript" value={formData.audioTranscript} onChange={handleChange} rows="5" placeholder="Full transcript of the audio..." className="form-textarea" />
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

              {(q.questionType === 'fill_in_blank' || q.questionType === 'short_answer') && (
                <div className="form-group full-width">
                  <label>Correct Answer</label>
                  <input type="text" value={q.correctAnswer} onChange={(e) => handleQuestionChange(qIdx, 'correctAnswer', e.target.value)} placeholder="Expected answer" className="form-input" />
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="form-actions">
          <button type="button" onClick={() => navigate('/vendor-admin/english-questions')} className="btn btn-secondary">Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Saving...' : isEditMode ? 'Update' : 'Create Question'}</button>
        </div>
      </form>
    </div>
  );
};

export default CreateEnglishListeningQuestion;
