import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import axiosInstance from '../../utils/axios';
import Modal from '../../components/Modal';
import './CreateEnglishTest.css';

const SECTION_TYPES = [
  { key: 'grammar', label: 'Grammar', qType: 'english_grammar', modelType: 'EnglishGrammarQuestion' },
  { key: 'vocabulary', label: 'Vocabulary', qType: 'english_vocabulary', modelType: 'EnglishVocabularyQuestion' },
  { key: 'reading', label: 'Reading Comprehension', qType: 'english_reading', modelType: 'EnglishReadingQuestion' },
  { key: 'writing', label: 'Essay / Email Writing', qType: 'english_essay', modelType: 'EnglishEssayQuestion' },
  { key: 'listening', label: 'Listening', qType: 'english_listening', modelType: 'EnglishListeningQuestion' },
  { key: 'speaking', label: 'Speaking', qType: 'english_speaking', modelType: 'EnglishSpeakingQuestion' }
];

const CreateEnglishTest = () => {
  useAuth();
  const navigate = useNavigate();
  const { id: testId } = useParams();
  const isEditMode = !!testId;

  const [testInfo, setTestInfo] = useState({
    title: '',
    description: '',
    duration: 60,
    startDate: '',
    endDate: '',
    shuffleQuestions: false,
    showResults: true,
    practiceMode: false
  });

  const [sections, setSections] = useState([]);
  const [questionBanks, setQuestionBanks] = useState({});
  const [activeSectionIdx, setActiveSectionIdx] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fetchingQuestions, setFetchingQuestions] = useState(true);
  const [initialLoad, setInitialLoad] = useState(isEditMode);
  const [modal, setModal] = useState({ isOpen: false, title: '', message: '', type: 'info' });

  useEffect(() => {
    fetchQuestionBanks();
  }, []);

  useEffect(() => {
    if (isEditMode && testId) {
      fetchTest();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [testId, isEditMode]);

  const fetchTest = async () => {
    try {
      setInitialLoad(true);
      const res = await axiosInstance.get(`/tests/${testId}`);
      const test = res.data;
      if (test.type !== 'english') {
        showModal('Error', 'This test is not an English test', 'error');
        navigate('/vendor-admin/tests');
        return;
      }
      setTestInfo({
        title: test.title || '',
        description: test.description || '',
        duration: test.duration || 60,
        startDate: test.startDate ? new Date(test.startDate).toISOString().slice(0, 16) : '',
        endDate: test.endDate ? new Date(test.endDate).toISOString().slice(0, 16) : '',
        shuffleQuestions: test.settings?.shuffleQuestions ?? false,
        showResults: test.settings?.showResults ?? true,
        practiceMode: test.settings?.practiceMode ?? false
      });

      const es = (test.englishSections || []).slice().sort((a, b) => (a.order || 0) - (b.order || 0));
      const questionsBySection = {};
      (test.questions || []).forEach(q => {
        const sid = q.sectionId || 'grammar';
        if (!questionsBySection[sid]) questionsBySection[sid] = [];
        const doc = q.questionId && typeof q.questionId === 'object' ? q.questionId : { _id: q.questionId, questionText: '', word: '', passage: {}, prompt: '', title: '' };
        questionsBySection[sid].push({
          _id: doc._id,
          ...doc,
          _points: q.points
        });
      });

      const builtSections = es.map(sec => {
        const sectionType = sec.sectionType || sec.sectionTitle?.toLowerCase()?.replace(/\s.*$/, '') || 'grammar';
        const selected = (questionsBySection[sectionType] || []).map(q => ({
          ...q,
          points: q._points ?? q.points
        }));
        return {
          sectionType,
          sectionTitle: sec.sectionTitle || (SECTION_TYPES.find(s => s.key === sectionType)?.label) || sectionType,
          duration: sec.duration ?? 15,
          order: sec.order ?? 1,
          instructions: sec.instructions || '',
          selectedQuestions: selected
        };
      });
      setSections(builtSections);
      if (builtSections.length > 0) setActiveSectionIdx(0);
    } catch (err) {
      showModal('Error', err.response?.data?.message || 'Failed to load test', 'error');
      navigate('/vendor-admin/tests');
    } finally {
      setInitialLoad(false);
    }
  };

  const fetchQuestionBanks = async () => {
    try {
      const [grammar, vocabulary, reading, essay, speaking, listening] = await Promise.all([
        axiosInstance.get('/questions/english/grammar'),
        axiosInstance.get('/questions/english/vocabulary'),
        axiosInstance.get('/questions/english/reading'),
        axiosInstance.get('/questions/english/essay'),
        axiosInstance.get('/questions/english/speaking'),
        axiosInstance.get('/questions/english/listening')
      ]);
      setQuestionBanks({
        grammar: grammar.data || [],
        vocabulary: vocabulary.data || [],
        reading: reading.data || [],
        writing: essay.data || [],
        speaking: speaking.data || [],
        listening: listening.data || []
      });
    } catch (error) {
      console.error('Error fetching question banks:', error);
    } finally {
      setFetchingQuestions(false);
    }
  };

  const showModal = (title, message, type = 'info') => setModal({ isOpen: true, title, message, type });
  const closeModal = () => setModal({ isOpen: false, title: '', message: '', type: 'info' });

  const addSection = (sectionKey) => {
    const config = SECTION_TYPES.find(s => s.key === sectionKey);
    if (!config) return;
    if (sections.find(s => s.sectionType === sectionKey)) return showModal('Warning', `${config.label} section already added`, 'warning');
    setSections([...sections, {
      sectionType: sectionKey,
      sectionTitle: config.label,
      duration: 15,
      order: sections.length + 1,
      instructions: '',
      selectedQuestions: []
    }]);
    setActiveSectionIdx(sections.length);
  };

  const removeSection = (idx) => {
    const updated = sections.filter((_, i) => i !== idx).map((s, i) => ({ ...s, order: i + 1 }));
    setSections(updated);
    if (activeSectionIdx === idx) setActiveSectionIdx(null);
    else if (activeSectionIdx > idx) setActiveSectionIdx(activeSectionIdx - 1);
  };

  const moveSection = (idx, direction) => {
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= sections.length) return;
    const updated = [...sections];
    [updated[idx], updated[newIdx]] = [updated[newIdx], updated[idx]];
    updated.forEach((s, i) => s.order = i + 1);
    setSections(updated);
    setActiveSectionIdx(newIdx);
  };

  const updateSection = (idx, field, value) => {
    const updated = [...sections];
    updated[idx][field] = value;
    setSections(updated);
  };

  const toggleQuestion = (sectionIdx, question) => {
    const updated = [...sections];
    const sel = updated[sectionIdx].selectedQuestions;
    const exists = sel.find(q => q._id === question._id);
    if (exists) {
      updated[sectionIdx].selectedQuestions = sel.filter(q => q._id !== question._id);
    } else {
      updated[sectionIdx].selectedQuestions = [...sel, question];
    }
    setSections(updated);
  };

  const getQuestionLabel = (q, type) => {
    if (type === 'grammar') return q.questionText?.substring(0, 60) || 'Grammar Q';
    if (type === 'vocabulary') return q.word || 'Vocabulary Q';
    if (type === 'reading') return q.passage?.title || 'Reading Q';
    if (type === 'writing') return q.prompt?.substring(0, 60) || 'Essay Q';
    if (type === 'speaking') return q.prompt?.substring(0, 60) || 'Speaking Q';
    if (type === 'listening') return q.title || 'Listening Q';
    return 'Question';
  };

  const getQuestionPoints = (q, type) => {
    if (q.points != null && q.points > 0) return q.points;
    if (type === 'reading' || type === 'listening') return q.totalPoints || 0;
    return q.points ?? 10;
  };

  const totalDuration = sections.reduce((sum, s) => sum + (parseInt(s.duration) || 0), 0);
  const totalQuestions = sections.reduce((sum, s) => sum + s.selectedQuestions.length, 0);
  const totalPoints = sections.reduce((sum, s) => {
    return sum + s.selectedQuestions.reduce((qSum, q) => qSum + getQuestionPoints(q, s.sectionType), 0);
  }, 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!testInfo.title.trim()) return showModal('Error', 'Test title is required', 'error');
    if (sections.length === 0) return showModal('Error', 'At least one section is required', 'error');

    for (const s of sections) {
      if (s.selectedQuestions.length === 0) return showModal('Error', `Section "${s.sectionTitle}" has no questions`, 'error');
    }

    setLoading(true);
    try {
      let orderCounter = 1;
      const questions = [];
      const englishSections = [];

      sections.forEach(s => {
        const config = SECTION_TYPES.find(st => st.key === s.sectionType);
        englishSections.push({
          sectionType: s.sectionType,
          sectionTitle: s.sectionTitle,
          duration: parseInt(s.duration) || 15,
          order: s.order,
          instructions: s.instructions
        });

        s.selectedQuestions.forEach(q => {
          questions.push({
            type: config.qType,
            questionId: q._id,
            questionType: config.modelType,
            points: getQuestionPoints(q, s.sectionType),
            order: orderCounter++,
            sectionId: s.sectionType
          });
        });
      });

      const testData = {
        title: testInfo.title.trim(),
        description: testInfo.description.trim(),
        type: 'english',
        duration: totalDuration || parseInt(testInfo.duration) || 60,
        questions,
        englishSections,
        startDate: testInfo.startDate || undefined,
        endDate: testInfo.endDate || undefined,
        settings: {
          shuffleQuestions: testInfo.shuffleQuestions,
          showResults: testInfo.showResults,
          practiceMode: testInfo.practiceMode
        }
      };

      if (isEditMode && testId) {
        await axiosInstance.put(`/tests/${testId}`, testData);
        showModal('Success', 'English test updated successfully!', 'success');
      } else {
        await axiosInstance.post('/tests', testData);
        showModal('Success', 'English test created successfully!', 'success');
      }
      setTimeout(() => navigate('/vendor-admin/tests'), 1500);
    } catch (error) {
      showModal('Error', error.response?.data?.message || (isEditMode ? 'Error updating test' : 'Error creating test'), 'error');
    } finally {
      setLoading(false);
    }
  };

  if (initialLoad) {
    return <div className="loading">Loading test...</div>;
  }

  return (
    <div className="container create-english-test">
      <Modal isOpen={modal.isOpen} onClose={closeModal} title={modal.title} type={modal.type}>
        <p>{modal.message}</p>
      </Modal>

      <div className="page-header">
        <h1 className="page-title">{isEditMode ? 'Edit English Test' : 'Create English Test'}</h1>
        <button onClick={() => navigate('/vendor-admin/tests')} className="btn btn-secondary">Back to Tests</button>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="test-builder-layout">
          <div className="test-builder-main">
            <div className="form-section">
              <h2 className="section-title">Test Information</h2>
              <div className="form-group">
                <label>Test Title *</label>
                <input type="text" value={testInfo.title} onChange={(e) => setTestInfo({ ...testInfo, title: e.target.value })} placeholder="e.g., English Proficiency Test - Batch 2026" className="form-input" required />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea value={testInfo.description} onChange={(e) => setTestInfo({ ...testInfo, description: e.target.value })} rows="3" placeholder="Brief description of the test..." className="form-textarea" />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Start Date</label>
                  <input type="datetime-local" value={testInfo.startDate} onChange={(e) => setTestInfo({ ...testInfo, startDate: e.target.value })} className="form-input" />
                </div>
                <div className="form-group">
                  <label>End Date</label>
                  <input type="datetime-local" value={testInfo.endDate} onChange={(e) => setTestInfo({ ...testInfo, endDate: e.target.value })} className="form-input" />
                </div>
              </div>
              <div className="form-row">
                <label className="checkbox-inline"><input type="checkbox" checked={testInfo.shuffleQuestions} onChange={(e) => setTestInfo({ ...testInfo, shuffleQuestions: e.target.checked })} /><span>Shuffle Questions</span></label>
                <label className="checkbox-inline"><input type="checkbox" checked={testInfo.showResults} onChange={(e) => setTestInfo({ ...testInfo, showResults: e.target.checked })} /><span>Show Results to Students</span></label>
                <label className="checkbox-inline"><input type="checkbox" checked={testInfo.practiceMode} onChange={(e) => setTestInfo({ ...testInfo, practiceMode: e.target.checked })} /><span>Practice Mode (no time limit, instant feedback)</span></label>
              </div>
            </div>

            <div className="form-section">
              <h2 className="section-title">Sections</h2>
              <div className="add-sections-bar">
                {SECTION_TYPES.map(st => (
                  <button key={st.key} type="button" onClick={() => addSection(st.key)} className={`add-section-btn ${sections.find(s => s.sectionType === st.key) ? 'added' : ''}`} disabled={!!sections.find(s => s.sectionType === st.key)}>
                    + {st.label}
                  </button>
                ))}
              </div>

              {sections.length === 0 ? (
                <div className="empty-sections">Click a section button above to add sections to your test.</div>
              ) : (
                <div className="sections-list">
                  {sections.map((s, idx) => (
                    <div key={s.sectionType} className={`section-card ${activeSectionIdx === idx ? 'active' : ''}`} onClick={() => setActiveSectionIdx(idx)}>
                      <div className="section-card-header">
                        <div className="section-card-info">
                          <span className="section-order">{s.order}</span>
                          <span className="section-name">{s.sectionTitle}</span>
                          <span className="section-meta">{s.selectedQuestions.length} Q | {s.duration} min</span>
                        </div>
                        <div className="section-card-actions">
                          <button type="button" onClick={(e) => { e.stopPropagation(); moveSection(idx, -1); }} disabled={idx === 0} className="btn-icon-sm">^</button>
                          <button type="button" onClick={(e) => { e.stopPropagation(); moveSection(idx, 1); }} disabled={idx === sections.length - 1} className="btn-icon-sm">v</button>
                          <button type="button" onClick={(e) => { e.stopPropagation(); removeSection(idx); }} className="btn-icon-sm btn-danger">x</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {activeSectionIdx !== null && sections[activeSectionIdx] && (
              <div className="form-section section-editor">
                <h2 className="section-title">Configure: {sections[activeSectionIdx].sectionTitle}</h2>
                <div className="form-row">
                  <div className="form-group">
                    <label>Section Title</label>
                    <input type="text" value={sections[activeSectionIdx].sectionTitle} onChange={(e) => updateSection(activeSectionIdx, 'sectionTitle', e.target.value)} className="form-input" />
                  </div>
                  <div className="form-group">
                    <label>Duration (minutes)</label>
                    <input type="number" value={sections[activeSectionIdx].duration} onChange={(e) => updateSection(activeSectionIdx, 'duration', e.target.value)} min="1" className="form-input" />
                  </div>
                </div>
                <div className="form-group">
                  <label>Section Instructions</label>
                  <textarea value={sections[activeSectionIdx].instructions} onChange={(e) => updateSection(activeSectionIdx, 'instructions', e.target.value)} rows="2" placeholder="Instructions shown before this section starts..." className="form-textarea" />
                </div>

                <h3 className="subsection-title">Select Questions ({sections[activeSectionIdx].selectedQuestions.length} selected)</h3>
                {fetchingQuestions ? (
                  <p>Loading questions...</p>
                ) : (
                  <div className="question-picker">
                    {(questionBanks[sections[activeSectionIdx].sectionType] || []).length === 0 ? (
                      <div className="empty-questions">No questions available. <a href={`/vendor-admin/english-questions/${sections[activeSectionIdx].sectionType}/create`}>Create one</a></div>
                    ) : (
                      (questionBanks[sections[activeSectionIdx].sectionType] || []).map(q => {
                        const selected = sections[activeSectionIdx].selectedQuestions.find(sq => sq._id === q._id);
                        return (
                          <div key={q._id} className={`question-pick-item ${selected ? 'selected' : ''}`} onClick={() => toggleQuestion(activeSectionIdx, q)}>
                            <div className="pick-checkbox">{selected ? '✓' : ''}</div>
                            <div className="pick-info">
                              <span className="pick-title">{getQuestionLabel(q, sections[activeSectionIdx].sectionType)}</span>
                              <span className="pick-meta">{q.difficulty} | {getQuestionPoints(q, sections[activeSectionIdx].sectionType)} pts</span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="test-builder-sidebar">
            <div className="sidebar-card">
              <h3>Test Summary</h3>
              <div className="summary-item"><span>Sections</span><strong>{sections.length}</strong></div>
              <div className="summary-item"><span>Questions</span><strong>{totalQuestions}</strong></div>
              <div className="summary-item"><span>Total Points</span><strong>{totalPoints}</strong></div>
              <div className="summary-item"><span>Total Duration</span><strong>{totalDuration} min</strong></div>
              <hr />
              {sections.map(s => (
                <div key={s.sectionType} className="summary-section">
                  <span>{s.sectionTitle}</span>
                  <span>{s.selectedQuestions.length}Q / {s.duration}m</span>
                </div>
              ))}
            </div>
            <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
              {loading ? (isEditMode ? 'Updating...' : 'Creating...') : (isEditMode ? 'Update English Test' : 'Create English Test')}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default CreateEnglishTest;
