import React, { useCallback, useEffect, useState } from 'react';
import {
  FiCheckCircle,
  FiClipboard,
  FiEdit3,
  FiLink,
  FiLoader,
  FiPlus,
  FiSave,
  FiTrash2,
  FiX,
} from 'react-icons/fi';
import axiosInstance from '../../utils/axios';
import CourseBankPicker, { parseCatalogPage } from './CourseBankPicker';
import { SUPER_ADMIN_QUIZ_CATALOG } from '../../constants/courseQuizCatalog';

const TYPE_MAP = {
  coding: 'CodingQuestion',
  mcq: 'MCQQuestion',
  aptitude: 'AptitudeQuestion',
  theory: 'TheoryQuestion',
  sql: 'SQLQuestion',
};

const QUESTION_TYPES = [
  { id: 'mcq', label: 'MCQ' },
  { id: 'coding', label: 'Coding' },
  { id: 'aptitude', label: 'Aptitude' },
  { id: 'theory', label: 'Theory' },
];

const PLATFORM_TABS = SUPER_ADMIN_QUIZ_CATALOG.tabs;

const TEST_TYPE_FILTERS = [
  { id: '', label: 'All types' },
  { id: 'coding', label: 'Coding' },
  { id: 'mcq', label: 'MCQ' },
  { id: 'aptitude', label: 'Aptitude' },
  { id: 'theory', label: 'Theory' },
  { id: 'mixed', label: 'Mixed' },
  { id: 'sql', label: 'SQL' },
  { id: 'english', label: 'English' },
];

const ASSESSMENT_LABELS = {
  test: 'Module test',
  interview: 'Mock interview',
  assignment: 'AI project evaluation',
  system_design: 'System design',
};

const platformItemTitle = (type, item) => {
  if (!item) return 'Assessment';
  if (type === 'interview') return item.title || item.topic || 'Interview';
  return item.title || 'Assessment';
};

const platformItemMeta = (type, item) => {
  if (!item) return '';
  if (type === 'test') {
    const count = item.questionCount ?? item.questions?.length ?? 0;
    return `${count} questions · ${item.duration || '—'} min · ${(item.type || 'mixed').toUpperCase()}`;
  }
  if (type === 'interview') {
    return `${item.interviewType || 'Interview'} · ${item.duration || '—'} min`;
  }
  if (type === 'assignment') {
    return `${item.category || 'Project'} · ${item.totalMarks || '—'} marks · ${item.duration || '—'} min`;
  }
  if (type === 'system_design') {
    return `${item.difficulty || '—'} · ${item.estimatedTime || item.duration || '—'} min`;
  }
  return '';
};

const questionTitle = (q) =>
  q.title || q.question || q.questionText || q.text || 'Untitled question';

const questionMeta = (q, type) => {
  const bits = [type.toUpperCase()];
  if (q.source === 'global') bits.push('Global');
  if (q.source === 'vendor') bits.push('Your bank');
  if (q.difficulty) bits.push(q.difficulty);
  if (q.section) bits.push(q.section);
  if (q.category) bits.push(q.category);
  return bits.join(' · ');
};

const toQuestionRefs = (questions, type) =>
  questions.map((q, i) => ({
    type,
    questionId: q._id,
    questionType: TYPE_MAP[type] || 'MCQQuestion',
    points: q.points || q.maxMarks || 10,
    order: i + 1,
  }));

const CourseModuleQuizPanel = ({
  module,
  moduleAssessment,
  moduleTest,
  loadingTest,
  onLoadTest,
  onAttachPlatformAssessment,
  onCreateModuleQuiz,
  onClearAssessment,
  onUpdateQuiz,
  onRemoveQuestion,
  onAddQuestions,
  savingQuiz,
  quizCatalog = SUPER_ADMIN_QUIZ_CATALOG,
}) => {
  const catalogTabs = quizCatalog?.tabs?.length ? quizCatalog.tabs : PLATFORM_TABS;
  const questionSources = quizCatalog?.questionSources || null;
  const assessmentType = moduleAssessment?.type || null;
  const hasAssessment = !!assessmentType;
  const isTestAssessment = assessmentType === 'test';
  const [manageOpen, setManageOpen] = useState(false);
  const [manageTab, setManageTab] = useState('overview');
  const [setupMode, setSetupMode] = useState('library');
  const [editTitle, setEditTitle] = useState('');
  const [editDuration, setEditDuration] = useState(30);
  const [platformTab, setPlatformTab] = useState('test');
  const [testTypeFilter, setTestTypeFilter] = useState('');
  const [selectedCatalogItem, setSelectedCatalogItem] = useState(null);
  const [bankType, setBankType] = useState('mcq');
  const [pickedQuestions, setPickedQuestions] = useState([]);
  const [quizTitle, setQuizTitle] = useState('');
  const [quizDuration, setQuizDuration] = useState(30);
  const [questionSource, setQuestionSource] = useState(
    quizCatalog?.defaultQuestionSource || 'all'
  );

  useEffect(() => {
    setManageOpen(false);
    setManageTab('overview');
    setSetupMode('library');
    setSelectedCatalogItem(null);
    setPickedQuestions([]);
    setQuizTitle('');
    setQuizDuration(30);
    setTestTypeFilter('');
    setPlatformTab('test');
    setQuestionSource(quizCatalog?.defaultQuestionSource || 'all');
  }, [module._id, quizCatalog?.defaultQuestionSource]);

  useEffect(() => {
    if (moduleTest) {
      setEditTitle(moduleTest.title || '');
      setEditDuration(moduleTest.duration || 30);
    }
  }, [moduleTest]);

  const fetchCatalogPage = useCallback(
    async ({ page, search, limit }) => {
      const tab = catalogTabs.find((t) => t.id === platformTab) || catalogTabs[0];
      const params = { page, limit, search };
      if (platformTab === 'test' && testTypeFilter) params.type = testTypeFilter;
      const { data } = await axiosInstance.get(tab.path, { params });
      return parseCatalogPage(data);
    },
    [catalogTabs, platformTab, testTypeFilter]
  );

  const fetchQuestionPage = useCallback(
    async ({ page, search, limit }) => {
      const path = quizCatalog.questionsPath
        ? quizCatalog.questionsPath(bankType)
        : `/super-admin/global-questions/${bankType}`;
      const params = { page, limit, search };
      if (questionSources) params.source = questionSource;
      const { data } = await axiosInstance.get(path, { params });
      return parseCatalogPage(data);
    },
    [bankType, questionSource, questionSources, quizCatalog]
  );

  const openManage = () => {
    setManageOpen(true);
    if (isTestAssessment) onLoadTest?.();
  };

  const existingQuestionIds = (moduleTest?.questions || [])
    .filter((q) => q.type === bankType)
    .map((q) => q.questionId);

  const togglePickedQuestion = (question) => {
    setPickedQuestions((prev) => {
      const exists = prev.some((p) => String(p._id) === String(question._id));
      return exists ? prev.filter((p) => String(p._id) !== String(question._id)) : [...prev, question];
    });
  };

  const handleSaveSettings = (e) => {
    e.preventDefault();
    if (!editTitle.trim()) return;
    onUpdateQuiz({
      title: editTitle.trim(),
      duration: Number(editDuration) || 30,
    });
  };

  const handleCreateQuiz = () => {
    if (!pickedQuestions.length) return;
    onCreateModuleQuiz({
      title: quizTitle.trim() || `${module.title || 'Module'} Quiz`,
      type: bankType,
      duration: Number(quizDuration) || 30,
      questions: toQuestionRefs(pickedQuestions, bankType),
    });
  };

  const handleAddQuestions = () => {
    if (!pickedQuestions.length) return;
    onAddQuestions(toQuestionRefs(pickedQuestions, bankType));
    setPickedQuestions([]);
  };

  const configuredTitle = isTestAssessment
    ? moduleTest?.title || moduleAssessment?.item?.title || 'Module test'
    : platformItemTitle(assessmentType, moduleAssessment?.item);
  const configuredMeta = isTestAssessment
    ? loadingTest
      ? 'Loading…'
      : `${moduleTest?.questions?.length || 0} questions · ${moduleTest?.duration || '—'} min`
    : platformItemMeta(assessmentType, moduleAssessment?.item);

  if (!manageOpen) {
    return (
      <div className={`sa-quiz-summary ${hasAssessment ? 'is-configured' : ''}`}>
        <div className="sa-quiz-summary-main">
          <div className="sa-quiz-summary-icon">
            {hasAssessment ? <FiCheckCircle size={22} /> : <FiClipboard size={22} />}
          </div>
          <div className="sa-quiz-summary-text">
            {hasAssessment ? (
              <>
                <strong>{configuredTitle}</strong>
                <span>
                  {ASSESSMENT_LABELS[assessmentType] || 'Module assessment'}
                  {configuredMeta ? ` · ${configuredMeta}` : ''}
                </span>
              </>
            ) : (
              <>
                <strong>No module assessment</strong>
                <span>Attach a platform test or build a quiz from the question bank.</span>
              </>
            )}
          </div>
        </div>
        <button type="button" className="vh-btn vh-btn--primary vh-btn--sm" onClick={openManage}>
          {hasAssessment ? (
            <>
              <FiEdit3 size={14} /> Manage assessment
            </>
          ) : (
            <>
              <FiPlus size={14} /> Set up assessment
            </>
          )}
        </button>
      </div>
    );
  }

  return (
    <div className="sa-quiz-manager">
      <div className="sa-quiz-manager-head">
        <div>
          <h4 className="sa-quiz-manager-title">Module assessment</h4>
          <p className="sa-quiz-manager-desc">
            Search and select from the library. Large banks load a page at a time.
          </p>
        </div>
        <button
          type="button"
          className="sa-quiz-manager-close"
          aria-label="Close assessment manager"
          onClick={() => setManageOpen(false)}
        >
          <FiX size={18} />
        </button>
      </div>

      {hasAssessment && !isTestAssessment ? (
        <div className="sa-quiz-manager-panel">
          <div className="sa-platform-linked-card">
            <span className="sa-platform-linked-kicker">
              {ASSESSMENT_LABELS[assessmentType] || 'Assessment'}
            </span>
            <strong>{configuredTitle}</strong>
            <p>{platformItemMeta(assessmentType, moduleAssessment?.item)}</p>
          </div>
          <div className="sa-quiz-manager-actions">
            <button
              type="button"
              className="vh-btn vh-btn--ghost vh-btn--sm sa-quiz-danger-btn"
              onClick={onClearAssessment}
              disabled={savingQuiz}
            >
              <FiTrash2 size={14} /> Remove assessment
            </button>
          </div>
        </div>
      ) : hasAssessment && isTestAssessment ? (
        <>
          <div className="sa-quiz-manager-tabs">
            {[
              { id: 'overview', label: 'Settings' },
              { id: 'questions', label: 'Questions' },
              { id: 'add', label: 'Add questions' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`sa-quiz-manager-tab ${manageTab === tab.id ? 'is-active' : ''}`}
                onClick={() => setManageTab(tab.id)}
              >
                {tab.label}
                {tab.id === 'questions' && moduleTest?.questions?.length
                  ? ` (${moduleTest.questions.length})`
                  : ''}
              </button>
            ))}
          </div>

          {loadingTest && !moduleTest ? (
            <div className="sa-quiz-manager-loading">
              <FiLoader className="sa-spin" size={22} />
              Loading quiz…
            </div>
          ) : (
            <>
              {manageTab === 'overview' && (
                <form className="sa-quiz-manager-panel" onSubmit={handleSaveSettings}>
                  <div className="vh-form-grid vh-form-grid--2">
                    <div className="vh-field">
                      <label htmlFor="quiz-edit-title">Quiz title</label>
                      <input
                        id="quiz-edit-title"
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        maxLength={120}
                        required
                      />
                    </div>
                    <div className="vh-field">
                      <label htmlFor="quiz-edit-duration">Duration (minutes)</label>
                      <input
                        id="quiz-edit-duration"
                        type="number"
                        min="5"
                        value={editDuration}
                        onChange={(e) => setEditDuration(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="sa-quiz-manager-actions">
                    <button
                      type="submit"
                      className="vh-btn vh-btn--primary vh-btn--sm"
                      disabled={savingQuiz || !editTitle.trim()}
                    >
                      <FiSave size={14} />
                      {savingQuiz ? 'Saving…' : 'Save settings'}
                    </button>
                    <button
                      type="button"
                      className="vh-btn vh-btn--ghost vh-btn--sm sa-quiz-danger-btn"
                      onClick={onClearAssessment}
                      disabled={savingQuiz}
                    >
                      <FiTrash2 size={14} /> Remove quiz
                    </button>
                  </div>
                </form>
              )}

              {manageTab === 'questions' && (
                <div className="sa-quiz-manager-panel">
                  {!moduleTest?.questions?.length ? (
                    <p className="sa-quiz-empty">No questions in this quiz yet.</p>
                  ) : (
                    <ul className="sa-quiz-question-list">
                      {moduleTest.questions.map((q, idx) => (
                        <li key={`${q.type}-${q.questionId}`} className="sa-quiz-question-row">
                          <span className="sa-quiz-question-num">{idx + 1}</span>
                          <div className="sa-quiz-question-body">
                            <strong title={q.label}>{q.label}</strong>
                            <span>
                              {q.type.toUpperCase()} · {q.points || 10} pts
                            </span>
                          </div>
                          <button
                            type="button"
                            className="sa-quiz-question-remove"
                            title="Remove question"
                            disabled={savingQuiz || moduleTest.questions.length <= 1}
                            onClick={() => onRemoveQuestion(idx)}
                          >
                            <FiTrash2 size={14} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="sa-quiz-hint">At least one question is required. Use Add questions to grow the quiz.</p>
                </div>
              )}

              {manageTab === 'add' && (
                <div className="sa-quiz-manager-panel sa-quiz-picker-panel">
                  <div className="vh-form-grid vh-form-grid--2">
                    <div className="vh-field">
                    <label htmlFor="bank-type-add">Question type</label>
                    <select
                      id="bank-type-add"
                      value={bankType}
                      onChange={(e) => {
                        setBankType(e.target.value);
                        setPickedQuestions([]);
                      }}
                    >
                      {QUESTION_TYPES.map((type) => (
                        <option key={type.id} value={type.id}>
                          {type.label}
                        </option>
                      ))}
                    </select>
                    </div>
                    {questionSources ? (
                      <div className="vh-field">
                        <label htmlFor="question-source-add">Question bank</label>
                        <select
                          id="question-source-add"
                          value={questionSource}
                          onChange={(e) => {
                            setQuestionSource(e.target.value);
                            setPickedQuestions([]);
                          }}
                        >
                          {questionSources.map((opt) => (
                            <option key={opt.id} value={opt.id}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : null}
                  </div>
                  <CourseBankPicker
                    fetchPage={fetchQuestionPage}
                    reloadKey={`${bankType}-${questionSource}-add`}
                    getTitle={questionTitle}
                    getMeta={(q) => questionMeta(q, bankType)}
                    selectedIds={pickedQuestions.map((q) => q._id)}
                    excludeIds={existingQuestionIds}
                    onToggle={togglePickedQuestion}
                    searchPlaceholder="Search questions"
                    emptyLabel="No questions match this search."
                  />
                  {pickedQuestions.length ? (
                    <div className="sa-picker-selected">
                      <span>{pickedQuestions.length} selected</span>
                      <button
                        type="button"
                        className="vh-btn vh-btn--primary vh-btn--sm"
                        disabled={savingQuiz}
                        onClick={handleAddQuestions}
                      >
                        <FiPlus size={14} />
                        Add to quiz
                      </button>
                    </div>
                  ) : null}
                </div>
              )}
            </>
          )}
        </>
      ) : (
        <div className="sa-quiz-setup">
          <div className="sa-segment">
            <button
              type="button"
              className={`sa-segment-btn ${setupMode === 'library' ? 'is-active' : ''}`}
              onClick={() => setSetupMode('library')}
            >
              Attach existing
            </button>
            <button
              type="button"
              className={`sa-segment-btn ${setupMode === 'create' ? 'is-active' : ''}`}
              onClick={() => setSetupMode('create')}
            >
              Build from bank
            </button>
          </div>

          {setupMode === 'library' ? (
            <div className="sa-quiz-setup-panel sa-quiz-picker-panel">
              <div className="sa-platform-tabs">
                {catalogTabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    className={`sa-platform-tab ${platformTab === tab.id ? 'is-active' : ''}`}
                    onClick={() => {
                      setPlatformTab(tab.id);
                      setSelectedCatalogItem(null);
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              {platformTab === 'test' ? (
                <div className="vh-field">
                  <label htmlFor="test-type-filter">Test type</label>
                  <select
                    id="test-type-filter"
                    value={testTypeFilter}
                    onChange={(e) => {
                      setTestTypeFilter(e.target.value);
                      setSelectedCatalogItem(null);
                    }}
                  >
                    {TEST_TYPE_FILTERS.map((opt) => (
                      <option key={opt.id || 'all'} value={opt.id}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
              <CourseBankPicker
                fetchPage={fetchCatalogPage}
                reloadKey={`${platformTab}:${testTypeFilter}`}
                getTitle={(item) => platformItemTitle(platformTab, item)}
                getMeta={(item) => platformItemMeta(platformTab, item)}
                selectedIds={selectedCatalogItem ? [selectedCatalogItem._id] : []}
                onToggle={(item) =>
                  setSelectedCatalogItem((prev) =>
                    prev && String(prev._id) === String(item._id) ? null : item
                  )
                }
                searchPlaceholder={`Search ${catalogTabs.find((t) => t.id === platformTab)?.label.toLowerCase() || 'items'}`}
                emptyLabel="No matching assessments."
              />
              <div className="sa-picker-selected">
                <span>
                  {selectedCatalogItem
                    ? platformItemTitle(platformTab, selectedCatalogItem)
                    : 'Select an assessment from the list'}
                </span>
                <button
                  type="button"
                  className="vh-btn vh-btn--primary vh-btn--sm"
                  disabled={savingQuiz || !selectedCatalogItem}
                  onClick={() =>
                    onAttachPlatformAssessment(platformTab, selectedCatalogItem._id)
                  }
                >
                  <FiLink size={14} /> Attach
                </button>
              </div>
            </div>
          ) : (
            <div className="sa-quiz-setup-panel sa-quiz-picker-panel">
              <div className="vh-form-grid vh-form-grid--2">
                <div className="vh-field">
                  <label htmlFor="quiz-title">Quiz title</label>
                  <input
                    id="quiz-title"
                    type="text"
                    placeholder={`${module.title} Quiz`}
                    value={quizTitle}
                    onChange={(e) => setQuizTitle(e.target.value)}
                  />
                </div>
                <div className="vh-field">
                  <label htmlFor="quiz-duration">Duration (min)</label>
                  <input
                    id="quiz-duration"
                    type="number"
                    min="5"
                    value={quizDuration}
                    onChange={(e) => setQuizDuration(e.target.value)}
                  />
                </div>
              </div>
              <div className="vh-form-grid vh-form-grid--2">
              <div className="vh-field">
                <label htmlFor="bank-type">Question type</label>
                <select
                  id="bank-type"
                  value={bankType}
                  onChange={(e) => {
                    setBankType(e.target.value);
                    setPickedQuestions([]);
                  }}
                >
                  {QUESTION_TYPES.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>
              {questionSources ? (
                <div className="vh-field">
                  <label htmlFor="question-source-create">Question bank</label>
                  <select
                    id="question-source-create"
                    value={questionSource}
                    onChange={(e) => {
                      setQuestionSource(e.target.value);
                      setPickedQuestions([]);
                    }}
                  >
                    {questionSources.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
              </div>
              <CourseBankPicker
                fetchPage={fetchQuestionPage}
                reloadKey={`${bankType}-${questionSource}-create`}
                getTitle={questionTitle}
                getMeta={(q) => questionMeta(q, bankType)}
                selectedIds={pickedQuestions.map((q) => q._id)}
                onToggle={togglePickedQuestion}
                searchPlaceholder="Search questions"
                emptyLabel="No questions match this search."
              />
              {pickedQuestions.length ? (
                <ul className="sa-picker-chips">
                  {pickedQuestions.map((q) => (
                    <li key={q._id}>
                      <span>{questionTitle(q)}</span>
                      <button
                        type="button"
                        aria-label="Remove question"
                        onClick={() => togglePickedQuestion(q)}
                      >
                        <FiX size={12} />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              <button
                type="button"
                className="vh-btn vh-btn--primary vh-btn--sm"
                disabled={savingQuiz || !pickedQuestions.length}
                onClick={handleCreateQuiz}
              >
                Create quiz ({pickedQuestions.length} selected)
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export { TYPE_MAP };
export default CourseModuleQuizPanel;
