import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import axiosInstance from '../../utils/axios';
import Modal from '../../components/Modal';
import RichTextEditor from '../../components/RichTextEditor';
import VendorQuestionFormPage from '../../components/VendorAdmin/VendorQuestionFormPage';
import { QUESTION_FORM_META } from '../../utils/vendorQuestionFormMeta';
import { isRichTextEmpty } from '../../utils/richTextUtils';
import TagInput from '../../components/TagInput';
import './CreateEnglishQuestion.css';

const SUB_TYPES = [
  { value: 'fill_in_blank', label: 'Fill in the Blank' },
  { value: 'error_detection', label: 'Error Detection' },
  { value: 'sentence_correction', label: 'Sentence Correction' },
  { value: 'parajumble', label: 'Parajumble' },
  { value: 'active_passive', label: 'Active / Passive Voice' },
  { value: 'direct_indirect', label: 'Direct / Indirect Speech' }
];

const GRAMMAR_CATEGORIES = [
  'Tenses', 'Articles', 'Prepositions', 'Modals', 'Subject-Verb Agreement',
  'Conjunctions', 'Pronouns', 'Adjectives & Adverbs', 'Conditionals',
  'Reported Speech', 'Voice', 'Punctuation', 'Sentence Structure', 'Other'
];

const CreateEnglishGrammarQuestion = () => {
  const { id } = useParams();
  const isEditMode = !!id;
  useAuth();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    questionText: '',
    subType: 'fill_in_blank',
    blankSentence: '',
    sentences: ['', ''],
    correctOrder: [],
    options: [
      { text: '', isCorrect: false },
      { text: '', isCorrect: false }
    ],
    correctAnswer: '',
    isSubjective: false,
    explanation: '',
    grammarCategory: '',
    difficulty: 'medium',
    points: 10,
    tags: []
  });
  const [pageLoading, setPageLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const meta = QUESTION_FORM_META.english;
  const backTo = meta.back;
  const [modal, setModal] = useState({ isOpen: false, title: '', message: '', type: 'info' });

  const fetchQuestion = useCallback(async () => {
    try {
      setPageLoading(true);
      const res = await axiosInstance.get(`/questions/english/grammar/${id}`);
      const q = res.data;
      setFormData({
        questionText: q.questionText || '',
        subType: q.subType || 'fill_in_blank',
        blankSentence: q.blankSentence || '',
        sentences: q.sentences?.length ? q.sentences : ['', ''],
        correctOrder: q.correctOrder || [],
        options: q.options?.length ? q.options : [{ text: '', isCorrect: false }, { text: '', isCorrect: false }],
        correctAnswer: q.correctAnswer || '',
        isSubjective: q.isSubjective || false,
        explanation: q.explanation || '',
        grammarCategory: q.grammarCategory || '',
        difficulty: q.difficulty || 'medium',
        points: q.points || 10,
        tags: q.tags || []
      });
    } catch (error) {
      showModal('Error', 'Failed to load question', 'error');
    } finally {
      setPageLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (isEditMode && id) fetchQuestion();
  }, [id, isEditMode, fetchQuestion]);

  const showModal = (title, message, type = 'info') => setModal({ isOpen: true, title, message, type });
  const closeModal = () => setModal({ isOpen: false, title: '', message: '', type: 'info' });

  const handleChange = (e) => {
    const { name, value } = e.target;
    const next = { ...formData, [name]: value };
    if (name === 'subType' && value === 'fill_in_blank') next.isSubjective = false;
    setFormData(next);
  };

  const handleOptionChange = (index, field, value) => {
    const newOptions = [...formData.options];
    newOptions[index][field] = value;
    setFormData({ ...formData, options: newOptions });
  };

  const handleAddOption = () => setFormData({ ...formData, options: [...formData.options, { text: '', isCorrect: false }] });

  const handleRemoveOption = (index) => {
    if (formData.options.length <= 2) return showModal('Warning', 'At least 2 options are required', 'warning');
    setFormData({ ...formData, options: formData.options.filter((_, i) => i !== index) });
  };

  const handleSentenceChange = (index, value) => {
    const newSentences = [...formData.sentences];
    newSentences[index] = value;
    setFormData({ ...formData, sentences: newSentences });
  };

  const handleAddSentence = () => setFormData({ ...formData, sentences: [...formData.sentences, ''] });

  const handleRemoveSentence = (index) => {
    if (formData.sentences.length <= 2) return showModal('Warning', 'At least 2 sentences are required', 'warning');
    setFormData({ ...formData, sentences: formData.sentences.filter((_, i) => i !== index) });
  };

  const handleCorrectOrderChange = (value) => {
    const order = value.split(',').map(n => parseInt(n.trim(), 10)).filter(n => !isNaN(n));
    setFormData({ ...formData, correctOrder: order });
  };

  const needsOptions = ['error_detection', 'active_passive', 'direct_indirect'].includes(formData.subType);
  const needsSentences = formData.subType === 'parajumble';
  const needsBlankSentence = formData.subType === 'fill_in_blank';
  const needsCorrectAnswer = ['fill_in_blank', 'sentence_correction'].includes(formData.subType) || formData.isSubjective;
  const showSubjectiveCheckbox = formData.subType === 'sentence_correction';

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.questionText.trim()) return showModal('Error', 'Question text is required', 'error');

    if (needsOptions) {
      const validOpts = formData.options.filter(o => o.text.trim());
      if (validOpts.length < 2) return showModal('Error', 'At least 2 options are required', 'error');
      if (!validOpts.some(o => o.isCorrect)) return showModal('Error', 'Mark at least one option as correct', 'error');
    }

    if (needsSentences) {
      const validSentences = formData.sentences.filter(s => s.trim());
      if (validSentences.length < 2) return showModal('Error', 'At least 2 sentences required for parajumble', 'error');
      if (formData.correctOrder.length !== validSentences.length) return showModal('Error', 'Correct order must match number of sentences', 'error');
    }

    if (needsCorrectAnswer && !formData.correctAnswer?.trim()) {
      const label = formData.subType === 'fill_in_blank' ? 'Fill in the blank' : 'Sentence correction';
      return showModal('Error', `Correct answer is required for ${label}`, 'error');
    }

    if (isRichTextEmpty(formData.questionText)) {
      return showModal('Error', 'Question / instruction text is required', 'error');
    }

    setSaving(true);
    try {
      const data = {
        ...formData,
        tags: formData.tags,
        options: needsOptions ? formData.options.filter(o => o.text.trim()) : [],
        sentences: needsSentences ? formData.sentences.filter(s => s.trim()) : []
      };

      if (isEditMode) {
        await axiosInstance.put(`/questions/english/grammar/${id}`, data);
        showModal('Success', 'Question updated!', 'success');
      } else {
        await axiosInstance.post('/questions/english/grammar', data);
        showModal('Success', 'Question created!', 'success');
      }
      setTimeout(() => navigate('/vendor-admin/english-questions'), 1500);
    } catch (error) {
      showModal('Error', error.response?.data?.message || 'Error saving question', 'error');
    } finally {
      setSaving(false);
    }
  };

  const modalEl = (
    <Modal isOpen={modal.isOpen} onClose={closeModal} title={modal.title} type={modal.type}>
      <p>{modal.message}</p>
    </Modal>
  );

  const formFooter = (
    <div className="form-actions">
      <button type="button" onClick={() => navigate(backTo)} className="btn btn-secondary">Cancel</button>
      <button type="submit" form="english-grammar-form" className="btn btn-primary" disabled={saving}>
        {saving ? 'Saving…' : isEditMode ? 'Update question' : 'Create question'}
      </button>
    </div>
  );

  return (
    <VendorQuestionFormPage
      className="create-english-question"
      loading={pageLoading}
      backTo={backTo}
      backLabel="Back to English questions"
      eyebrow={`${meta.label} · Grammar`}
      title={isEditMode ? 'Edit grammar question' : 'Create grammar question'}
      subtitle="Fill-in-blank, error detection, parajumble, and related grammar items."
      accent={meta.accent}
      modal={modalEl}
      footer={formFooter}
    >
      <form id="english-grammar-form" onSubmit={handleSubmit} className="question-form">
        <div className="form-section">
          <h2 className="section-title">Question details</h2>
          <div className="form-row">
            <div className="form-group">
              <label>Sub-Type *</label>
              <select name="subType" value={formData.subType} onChange={handleChange} className="form-select">
                {SUB_TYPES.map(st => <option key={st.value} value={st.value}>{st.label}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Grammar Category</label>
              <select name="grammarCategory" value={formData.grammarCategory} onChange={handleChange} className="form-select">
                <option value="">Select Category</option>
                {GRAMMAR_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div className="vqf-rich-field">
            <label>Question / instruction text *</label>
            <RichTextEditor
              variant="full"
              value={formData.questionText}
              onChange={(html) => setFormData((prev) => ({ ...prev, questionText: html }))}
              placeholder="e.g., Choose the correct option to fill in the blank"
              minHeight={140}
            />
          </div>

          {needsBlankSentence && (
            <div className="form-group full-width">
              <label>Sentence with Blank (use ___ for blank) *</label>
              <input type="text" name="blankSentence" value={formData.blankSentence} onChange={handleChange} placeholder="e.g., She ___ to school every day." className="form-input" />
            </div>
          )}

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
            {showSubjectiveCheckbox && (
              <div className="form-group">
                <label className="checkbox-label-inline">
                  <input type="checkbox" checked={formData.isSubjective} onChange={(e) => setFormData({ ...formData, isSubjective: e.target.checked })} />
                  <span>Subjective (AI Evaluated)</span>
                </label>
              </div>
            )}
          </div>
        </div>

        {needsSentences && (
          <div className="form-section">
            <div className="section-header">
              <h2 className="section-title">Sentences to Rearrange</h2>
              <button type="button" onClick={handleAddSentence} className="btn btn-secondary btn-sm">+ Add Sentence</button>
            </div>
            {formData.sentences.map((sentence, i) => (
              <div key={i} className="sentence-row">
                <span className="sentence-number">{i + 1}.</span>
                <input type="text" value={sentence} onChange={(e) => handleSentenceChange(i, e.target.value)} placeholder={`Sentence ${i + 1}`} className="form-input" />
                <button type="button" onClick={() => handleRemoveSentence(i)} className="btn-icon btn-danger" disabled={formData.sentences.length <= 2}>x</button>
              </div>
            ))}
            <div className="form-group" style={{ marginTop: '15px' }}>
              <label>Correct Order (comma-separated, e.g., 3,1,4,2)</label>
              <input type="text" value={formData.correctOrder.join(',')} onChange={(e) => handleCorrectOrderChange(e.target.value)} placeholder="e.g., 3,1,4,2" className="form-input" />
            </div>
          </div>
        )}

        {needsOptions && (
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
                  <textarea value={option.text} onChange={(e) => handleOptionChange(index, 'text', e.target.value)} rows="2" placeholder={`Option ${index + 1}`} className="form-textarea" />
                </div>
              ))}
            </div>
          </div>
        )}

        {needsCorrectAnswer && (
          <div className="form-section">
            <h2 className="section-title">Correct Answer (exact match for evaluation)</h2>
            <div className="form-group">
              {formData.subType === 'fill_in_blank' ? (
                <input type="text" name="correctAnswer" value={formData.correctAnswer} onChange={handleChange} placeholder="e.g., goes" className="form-input" />
              ) : (
                <textarea name="correctAnswer" value={formData.correctAnswer} onChange={handleChange} rows="3" placeholder="Enter the correct sentence..." className="form-textarea" />
              )}
            </div>
          </div>
        )}

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
    </VendorQuestionFormPage>
  );
};

export default CreateEnglishGrammarQuestion;
