import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import axiosInstance from '../../utils/axios';
import Modal from '../../components/Modal';
import VendorTestFormPage from '../../components/VendorAdmin/VendorTestFormPage';
import { getTestFormMeta } from '../../utils/vendorTestFormMeta';
import { FiChevronUp, FiChevronDown, FiTrash2 } from 'react-icons/fi';
import { FiSearch } from 'react-icons/fi';
import { buildTagFilterOptions, filterQuestionsBySearchAndTag, tagSlug } from '../../utils/tagUtils';
import useQuestionTagRegistry from '../../hooks/useQuestionTagRegistry';

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
  const [error, setError] = useState('');
  const [sectionSearch, setSectionSearch] = useState('');
  const [sectionTag, setSectionTag] = useState('');
  const { registryTags } = useQuestionTagRegistry();
  const meta = getTestFormMeta('english', isEditMode);

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
    if (sections.find(s => s.sectionType === sectionKey)) {
      setError(`${config.label} is already in this test.`);
      return;
    }
    setError('');
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

  const activeSectionType = activeSectionIdx !== null && sections[activeSectionIdx]
    ? sections[activeSectionIdx].sectionType
    : null;
  const activeBank = useMemo(
    () => (activeSectionType ? questionBanks[activeSectionType] || [] : []),
    [activeSectionType, questionBanks]
  );
  const activeBankTags = buildTagFilterOptions(
    registryTags,
    activeBank.flatMap((q) => q.tags || [])
  );
  const visibleActiveBank = useMemo(
    () =>
      filterQuestionsBySearchAndTag(activeBank, {
        term: sectionSearch,
        selectedTag: sectionTag,
        textFieldsFor: (q) => [getQuestionLabel(q, activeSectionType || '')],
      }),
    [activeBank, sectionSearch, sectionTag, activeSectionType]
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!testInfo.title.trim()) {
      setError('Test title is required.');
      return;
    }
    if (sections.length === 0) {
      setError('Add at least one section.');
      return;
    }
    for (const s of sections) {
      if (s.selectedQuestions.length === 0) {
        setError(`Section "${s.sectionTitle}" needs at least one question.`);
        return;
      }
    }
    if (testInfo.startDate && testInfo.endDate && new Date(testInfo.endDate) <= new Date(testInfo.startDate)) {
      setError('End date must be after the start date.');
      return;
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

  const stats = [
    { label: 'Sections', value: sections.length, highlight: true },
    { label: 'Questions', value: totalQuestions },
    { label: 'Points', value: totalPoints },
    { label: 'Duration', value: `${totalDuration || testInfo.duration} min` },
  ];

  const footer = (
    <>
      <span className="vtf-footer-meta">
        {sections.length === 0 ? (
          'Add sections to build your English assessment'
        ) : (
          <>
            <strong>{totalQuestions}</strong> questions across <strong>{sections.length}</strong>{' '}
            sections
          </>
        )}
      </span>
      <button type="button" className="va-btn va-btn--secondary" onClick={() => navigate(meta.back)}>
        Cancel
      </button>
      <button
        type="submit"
        form="english-test-form"
        className="va-btn va-btn--primary"
        disabled={loading}
        style={{ '--va-accent': meta.accent }}
      >
        {loading ? 'Saving…' : isEditMode ? 'Update English test' : 'Create English test'}
      </button>
    </>
  );

  return (
    <VendorTestFormPage
      loading={initialLoad}
      backTo={meta.back}
      backLabel="English assessments"
      eyebrow={meta.eyebrow}
      title={meta.title}
      subtitle={meta.subtitle}
      accent={meta.accent}
      error={error}
      stats={stats}
      footer={footer}
      wide
    >
      <Modal isOpen={modal.isOpen} onClose={closeModal} title={modal.title} type={modal.type}>
        <p>{modal.message}</p>
      </Modal>

      <form id="english-test-form" onSubmit={handleSubmit}>
        <div className="vtf-builder">
          <div className="vtf-builder-main">
            <section className="vtf-section">
              <h2 className="vtf-section-title">Test information</h2>
              <div className="vtf-field">
                <label htmlFor="en-title">Title *</label>
                <input
                  id="en-title"
                  type="text"
                  value={testInfo.title}
                  onChange={(e) => setTestInfo({ ...testInfo, title: e.target.value })}
                  placeholder="e.g. English Proficiency — Batch 2026"
                  required
                />
              </div>
              <div className="vtf-field">
                <label htmlFor="en-desc">Description</label>
                <textarea
                  id="en-desc"
                  value={testInfo.description}
                  onChange={(e) => setTestInfo({ ...testInfo, description: e.target.value })}
                  rows={3}
                  placeholder="Brief description for students…"
                />
              </div>
              <div className="vtf-row">
                <div className="vtf-field">
                  <label htmlFor="en-start">Start (optional)</label>
                  <input
                    id="en-start"
                    type="datetime-local"
                    value={testInfo.startDate}
                    onChange={(e) => setTestInfo({ ...testInfo, startDate: e.target.value })}
                  />
                </div>
                <div className="vtf-field">
                  <label htmlFor="en-end">End (optional)</label>
                  <input
                    id="en-end"
                    type="datetime-local"
                    value={testInfo.endDate}
                    onChange={(e) => setTestInfo({ ...testInfo, endDate: e.target.value })}
                  />
                </div>
              </div>
              <div className="vtf-checks">
                <label className="vtf-check">
                  <input
                    type="checkbox"
                    checked={testInfo.shuffleQuestions}
                    onChange={(e) => setTestInfo({ ...testInfo, shuffleQuestions: e.target.checked })}
                  />
                  Shuffle questions
                </label>
                <label className="vtf-check">
                  <input
                    type="checkbox"
                    checked={testInfo.showResults}
                    onChange={(e) => setTestInfo({ ...testInfo, showResults: e.target.checked })}
                  />
                  Show results to students
                </label>
                <label className="vtf-check">
                  <input
                    type="checkbox"
                    checked={testInfo.practiceMode}
                    onChange={(e) => setTestInfo({ ...testInfo, practiceMode: e.target.checked })}
                  />
                  Practice mode
                </label>
              </div>
            </section>

            <section className="vtf-section">
              <h2 className="vtf-section-title">Sections</h2>
              <p className="vtf-section-hint">Add one block per skill area. Each section needs at least one question.</p>
              <div className="vtf-section-chips">
                {SECTION_TYPES.map((st) => {
                  const added = !!sections.find((s) => s.sectionType === st.key);
                  return (
                    <button
                      key={st.key}
                      type="button"
                      onClick={() => addSection(st.key)}
                      className={`vtf-section-chip ${added ? 'added' : ''}`}
                      disabled={added}
                    >
                      + {st.label}
                    </button>
                  );
                })}
              </div>

              {sections.length === 0 ? (
                <div className="vtf-empty">
                  <h3>No sections yet</h3>
                  <p>Choose a section type above to start building your test.</p>
                </div>
              ) : (
                <div className="vtf-section-list">
                  {sections.map((s, idx) => (
                    <div
                      key={s.sectionType}
                      role="button"
                      tabIndex={0}
                      className={`vtf-section-row ${activeSectionIdx === idx ? 'active' : ''}`}
                      onClick={() => setActiveSectionIdx(idx)}
                      onKeyDown={(e) => e.key === 'Enter' && setActiveSectionIdx(idx)}
                    >
                      <div>
                        <strong>
                          {s.order}. {s.sectionTitle}
                        </strong>
                        <div className="vtf-q-meta" style={{ marginTop: 4 }}>
                          {s.selectedQuestions.length} questions · {s.duration} min
                        </div>
                      </div>
                      <div className="vtf-selected-actions" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          className="vtf-icon-btn"
                          disabled={idx === 0}
                          onClick={() => moveSection(idx, -1)}
                          aria-label="Move up"
                        >
                          <FiChevronUp />
                        </button>
                        <button
                          type="button"
                          className="vtf-icon-btn"
                          disabled={idx === sections.length - 1}
                          onClick={() => moveSection(idx, 1)}
                          aria-label="Move down"
                        >
                          <FiChevronDown />
                        </button>
                        <button
                          type="button"
                          className="vtf-icon-btn vtf-icon-btn--danger"
                          onClick={() => removeSection(idx)}
                          aria-label="Remove section"
                        >
                          <FiTrash2 />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {activeSectionIdx !== null && sections[activeSectionIdx] && (
              <section className="vtf-section">
                <h2 className="vtf-section-title">
                  Configure: {sections[activeSectionIdx].sectionTitle}
                </h2>
                <div className="vtf-row">
                  <div className="vtf-field">
                    <label>Section title</label>
                    <input
                      type="text"
                      value={sections[activeSectionIdx].sectionTitle}
                      onChange={(e) =>
                        updateSection(activeSectionIdx, 'sectionTitle', e.target.value)
                      }
                    />
                  </div>
                  <div className="vtf-field">
                    <label>Duration (minutes)</label>
                    <input
                      type="number"
                      min={1}
                      value={sections[activeSectionIdx].duration}
                      onChange={(e) =>
                        updateSection(activeSectionIdx, 'duration', e.target.value)
                      }
                    />
                  </div>
                </div>
                <div className="vtf-field">
                  <label>Instructions</label>
                  <textarea
                    value={sections[activeSectionIdx].instructions}
                    onChange={(e) =>
                      updateSection(activeSectionIdx, 'instructions', e.target.value)
                    }
                    rows={2}
                    placeholder="Shown to students before this section starts…"
                  />
                </div>

                <h3 className="vtf-section-title" style={{ fontSize: '0.95rem' }}>
                  Questions ({sections[activeSectionIdx].selectedQuestions.length} selected)
                </h3>
                <div className="vtf-search">
                  <FiSearch />
                  <input
                    type="search"
                    placeholder="Search by question text or tag…"
                    value={sectionSearch}
                    onChange={(e) => setSectionSearch(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') e.preventDefault();
                    }}
                  />
                </div>
                {activeBankTags.length > 0 && (
                  <div className="vtf-tags-filter-wrap">
                    <button
                      type="button"
                      className={`vtf-tag-chip ${sectionTag === '' ? 'is-active' : ''}`}
                      onClick={() => setSectionTag('')}
                    >
                      All tags
                    </button>
                    {activeBankTags.map((tag) => (
                      <button
                        key={tag.slug}
                        type="button"
                        className={`vtf-tag-chip ${sectionTag === tag.slug ? 'is-active' : ''}`}
                        onClick={() =>
                          setSectionTag(sectionTag === tag.slug ? '' : tag.slug)
                        }
                      >
                        #{tag.label}
                      </button>
                    ))}
                  </div>
                )}
                {fetchingQuestions ? (
                  <p className="vtf-section-hint">Loading question bank…</p>
                ) : activeBank.length === 0 ? (
                  <div className="vtf-empty">
                    <p>
                      No questions in this category.{' '}
                      <a
                        href={`/vendor-admin/english-questions/${sections[activeSectionIdx].sectionType === 'writing' ? 'essay' : sections[activeSectionIdx].sectionType}/create`}
                      >
                        Create one
                      </a>
                    </p>
                  </div>
                ) : (
                  <div className="vtf-pick-list">
                    {visibleActiveBank.map((q) => {
                      const selected = sections[activeSectionIdx].selectedQuestions.find(
                        (sq) => sq._id === q._id
                      );
                      return (
                        <div
                          key={q._id}
                          role="button"
                          tabIndex={0}
                          className={`vtf-pick-item ${selected ? 'selected' : ''}`}
                          onClick={() => toggleQuestion(activeSectionIdx, q)}
                          onKeyDown={(e) => e.key === 'Enter' && toggleQuestion(activeSectionIdx, q)}
                        >
                          <div className="vtf-pick-check">{selected ? '✓' : ''}</div>
                          <div>
                            <strong style={{ fontSize: '0.88rem' }}>
                              {getQuestionLabel(q, sections[activeSectionIdx].sectionType)}
                            </strong>
                            <div className="vtf-q-meta">
                              {q.difficulty} ·{' '}
                              {getQuestionPoints(q, sections[activeSectionIdx].sectionType)} pts
                            </div>
                            {!!q.tags?.length && (
                              <div className="vtf-tags-row">
                                {q.tags.slice(0, 3).map((tag) => {
                                  const slug = tagSlug(tag);
                                  return (
                                    <button
                                      key={slug}
                                      type="button"
                                      className={`vtf-tag-chip ${sectionTag === slug ? 'is-active' : ''}`}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSectionTag(sectionTag === slug ? '' : slug);
                                      }}
                                    >
                                      #{tag}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            )}
          </div>

          <aside className="vtf-builder-aside">
            <div className="vtf-selected-panel vtf-outline-panel">
              <header className="vtf-selected-panel-header">
                <div className="vtf-selected-panel-title-row">
                  <h3>Test outline</h3>
                </div>
                <div className="vtf-selected-panel-badges">
                  <span className="vtf-selected-count-pill">{sections.length} sections</span>
                  <span className="vtf-selected-points-pill">{totalQuestions} questions</span>
                </div>
              </header>
              {sections.length === 0 ? (
                <div className="vtf-selected-empty">
                  <p className="vtf-selected-empty-title">No sections yet</p>
                  <p className="vtf-selected-empty-hint">
                    Add grammar, reading, writing, and more from the sections panel.
                  </p>
                </div>
              ) : (
                <ol className="vtf-outline-stack">
                  {sections.map((s, idx) => (
                    <li
                      key={s.sectionType}
                      className={`vtf-outline-item ${activeSectionIdx === idx ? 'is-active' : ''}`}
                    >
                      <button
                        type="button"
                        className="vtf-outline-item-btn"
                        onClick={() => setActiveSectionIdx(idx)}
                      >
                        <span className="vtf-selected-card-order">{String(idx + 1).padStart(2, '0')}</span>
                        <span className="vtf-outline-item-text">
                          <strong>{s.sectionTitle}</strong>
                          <span>
                            {s.selectedQuestions.length} questions · {s.duration} min
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </aside>
        </div>
      </form>
    </VendorTestFormPage>
  );
};

export default CreateEnglishTest;
