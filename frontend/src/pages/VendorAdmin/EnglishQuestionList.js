import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { FiPlus, FiUpload, FiSearch, FiMessageCircle } from 'react-icons/fi';
import axiosInstance from '../../utils/axios';
import VendorHubPage from '../../components/VendorAdmin/VendorHubPage';
import QuestionHubRow from '../../components/VendorAdmin/QuestionHubRow';
import QuestionTagFilters from '../../components/VendorAdmin/QuestionTagFilters';
import VendorDataSection from '../../components/VendorAdmin/VendorDataSection';
import useQuestionTagRegistry from '../../hooks/useQuestionTagRegistry';
import { useListFetchLoading } from '../../hooks/useListFetchLoading';
import { buildTagFilterOptions, filterQuestionsBySearchAndTag } from '../../utils/tagUtils';
import { QUESTION_FORM_META } from '../../utils/vendorQuestionFormMeta';

const TABS = [
  { key: 'grammar', label: 'Grammar' },
  { key: 'vocabulary', label: 'Vocabulary' },
  { key: 'reading', label: 'Reading' },
  { key: 'essay', label: 'Essay / Email' },
  { key: 'speaking', label: 'Speaking' },
  { key: 'listening', label: 'Listening' },
];

const SUB_TYPE_LABELS = {
  fill_in_blank: 'Fill in the Blank',
  error_detection: 'Error Detection',
  sentence_correction: 'Sentence Correction',
  parajumble: 'Parajumble',
  active_passive: 'Active/Passive',
  direct_indirect: 'Direct/Indirect',
  synonym: 'Synonym',
  antonym: 'Antonym',
  meaning: 'Word Meaning',
  one_word_substitution: 'One Word Sub.',
  idiom_phrase: 'Idioms & Phrases',
  spelling: 'Spelling',
  contextual_usage: 'Contextual Usage',
  essay_general: 'General Essay',
  essay_opinion: 'Opinion Essay',
  essay_argumentative: 'Argumentative',
  email_formal: 'Formal Email',
  email_informal: 'Informal Email',
  letter_formal: 'Formal Letter',
  letter_informal: 'Informal Letter',
  report: 'Report',
  notice: 'Notice',
  read_aloud: 'Read Aloud',
  describe_image: 'Describe Image',
  topic_speaking: 'Topic Speaking',
  situational: 'Situational',
  extempore: 'Extempore',
};

const BULK_SUPPORTED = ['grammar', 'vocabulary', 'essay'];

const EnglishQuestionList = () => {
  const [activeTab, setActiveTab] = useState('grammar');
  const [sourceTab, setSourceTab] = useState('my');
  const [questions, setQuestions] = useState([]);
  const {
    initialLoading,
    refreshing,
    beginFetch,
    endFetch,
  } = useListFetchLoading();
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkFile, setBulkFile] = useState(null);
  const [bulkResult, setBulkResult] = useState(null);
  const [bulkImporting, setBulkImporting] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedTag, setSelectedTag] = useState('');
  const { registryTags } = useQuestionTagRegistry();

  const meta = QUESTION_FORM_META.english;

  useEffect(() => {
    fetchTabQuestions(activeTab);
  }, [activeTab]);

  const fetchTabQuestions = async (tab) => {
    try {
      beginFetch(false);
      const { data } = await axiosInstance.get(`/questions/english/${tab}`);
      setQuestions(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching English questions:', error);
      setQuestions([]);
    } finally {
      endFetch();
    }
  };

  const handleDelete = async (type, id) => {
    if (!window.confirm('Are you sure you want to delete this question?')) return;
    try {
      await axiosInstance.delete(`/questions/english/${type}/${id}`);
      fetchTabQuestions(activeTab);
    } catch (error) {
      alert(error.response?.data?.message || 'Error deleting question');
    }
  };

  const handleBulkImport = async () => {
    if (!bulkFile) return;
    setBulkImporting(true);
    setBulkResult(null);
    try {
      const formData = new FormData();
      formData.append('file', bulkFile);
      const response = await axiosInstance.post(`/questions/english/bulk-import/${activeTab}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setBulkResult(response.data);
      fetchTabQuestions(activeTab);
    } catch (error) {
      setBulkResult({ message: error.response?.data?.message || 'Import failed', errors: [{ error: error.message }] });
    } finally {
      setBulkImporting(false);
    }
  };

  useEffect(() => {
    setSelectedTag('');
    setSearch('');
  }, [activeTab, sourceTab]);

  const rawQuestions = useMemo(
    () =>
      (Array.isArray(questions) ? questions : []).filter((q) =>
        sourceTab === 'my' ? q.source === 'vendor' : q.source === 'global'
      ),
    [questions, sourceTab]
  );

  const getTextFields = useCallback(
    (q) => {
      if (activeTab === 'grammar') return [q.questionText, q.grammarCategory, q.subType];
      if (activeTab === 'vocabulary') return [q.word, q.subType];
      if (activeTab === 'reading') return [q.passage?.title, q.passage?.text];
      if (activeTab === 'essay') return [q.prompt, q.writingType];
      if (activeTab === 'speaking') return [q.prompt, q.speakingType];
      if (activeTab === 'listening') return [q.title, q.transcript];
      return [];
    },
    [activeTab]
  );

  const availableTags = useMemo(
    () => buildTagFilterOptions(registryTags, rawQuestions.flatMap((q) => q.tags || [])),
    [registryTags, rawQuestions]
  );

  const currentQuestions = useMemo(
    () =>
      filterQuestionsBySearchAndTag(rawQuestions, {
        term: search,
        selectedTag,
        textFieldsFor: getTextFields,
      }),
    [rawQuestions, search, selectedTag, getTextFields]
  );

  const getQuestionTitle = (q, type) => {
    if (type === 'grammar') return q.questionText?.substring(0, 80) || 'No text';
    if (type === 'vocabulary') return q.word || 'No word';
    if (type === 'reading') return q.passage?.title || 'No title';
    if (type === 'essay') return q.prompt?.substring(0, 80) || 'No prompt';
    if (type === 'speaking') return q.prompt?.substring(0, 80) || 'No prompt';
    if (type === 'listening') return q.title || 'No title';
    return 'Unknown';
  };

  const getQuestionMeta = (q, type) => {
    if (type === 'grammar') return SUB_TYPE_LABELS[q.subType] || q.subType;
    if (type === 'vocabulary') return SUB_TYPE_LABELS[q.subType] || q.subType;
    if (type === 'reading') return `${q.questions?.length || 0} questions · ${q.passage?.wordCount || 0} words`;
    if (type === 'essay') return SUB_TYPE_LABELS[q.writingType] || q.writingType;
    if (type === 'speaking') return SUB_TYPE_LABELS[q.speakingType] || q.speakingType;
    if (type === 'listening') return `${q.questions?.length || 0} questions · ${q.maxReplays || 0} replays`;
    return '';
  };

  const getPoints = (q, type) => {
    if (type === 'reading' || type === 'listening') return q.totalPoints || 0;
    return q.points || 0;
  };

  const activeLabel = TABS.find((t) => t.key === activeTab)?.label;

  return (
    <VendorHubPage
      className="veq-page"
      loading={initialLoading}
      eyebrow="Question bank"
      title="English & verbal questions"
      subtitle="Create and manage grammar, vocabulary, reading, writing, speaking, and listening items."
      accent={meta.accent}
      actions={
        <>
          {BULK_SUPPORTED.includes(activeTab) && (
            <button type="button" className="vh-btn vh-btn--secondary" onClick={() => { setShowBulkModal(true); setBulkFile(null); setBulkResult(null); }}>
              <FiUpload /> Import CSV/JSON
            </button>
          )}
          <Link to={`/vendor-admin/english-questions/${activeTab}/create`} className="vh-btn vh-btn--primary">
            <FiPlus /> Create {activeLabel}
          </Link>
        </>
      }
    >
      <div className="veq-type-tabs">
        {TABS.map((tab) => {
          const count =
            activeTab === tab.key
              ? rawQuestions.length
              : null;
          return (
            <button
              key={tab.key}
              type="button"
              className={`veq-type-tab ${activeTab === tab.key ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
              {count != null && <span className="veq-count">{count}</span>}
            </button>
          );
        })}
      </div>

      <div className="veq-source-tabs">
        <button type="button" className={`veq-source-tab ${sourceTab === 'my' ? 'active' : ''}`} onClick={() => setSourceTab('my')}>
          My questions
        </button>
        <button type="button" className={`veq-source-tab ${sourceTab === 'global' ? 'active' : ''}`} onClick={() => setSourceTab('global')}>
          Global questions
        </button>
      </div>

      <div className="vh-toolbar">
        <div className="vh-search">
          <FiSearch />
          <input
            type="search"
            placeholder={`Search ${activeLabel?.toLowerCase() || 'questions'} by text or tag…`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <QuestionTagFilters tags={availableTags} selectedSlug={selectedTag} onSelect={setSelectedTag} />

      <VendorDataSection refreshing={refreshing}>
      {currentQuestions.length === 0 && !refreshing ? (
        <div className="veq-empty">
          <h2>No {activeLabel} questions</h2>
          <p>
            {search || selectedTag
              ? 'Try a different search term or tag filter.'
              : sourceTab === 'my'
                ? 'Create your first question to get started.'
                : 'No global questions available for this type.'}
          </p>
          {sourceTab === 'my' && (
            <Link to={`/vendor-admin/english-questions/${activeTab}/create`} className="vh-btn vh-btn--primary">
              <FiPlus /> Create question
            </Link>
          )}
        </div>
      ) : (
        <div className="vh-panel">
          <div className="vh-panel-body vh-panel-body--flush">
            <ul className="vh-question-list">
              {currentQuestions.map((q) => (
                <QuestionHubRow
                  key={q._id}
                  accent={meta.accent}
                  icon={FiMessageCircle}
                  title={getQuestionTitle(q, activeTab)}
                  tags={q.tags}
                  badges={[
                    {
                      key: 'type',
                      label: getQuestionMeta(q, activeTab),
                      className: 'vh-badge vh-badge--global',
                    },
                    {
                      key: 'difficulty',
                      label: q.difficulty || 'medium',
                      className: `vh-badge vh-badge--${q.difficulty || 'medium'}`,
                    },
                  ]}
                  meta={[{ key: 'pts', label: `${getPoints(q, activeTab)} points` }]}
                  selectedTag={selectedTag}
                  onTagClick={setSelectedTag}
                  actions={
                    q.source === 'vendor' ? (
                      <>
                        <Link
                          to={`/vendor-admin/english-questions/${activeTab}/edit/${q._id}`}
                          className="vh-btn vh-btn--secondary vh-btn--sm"
                        >
                          Edit
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleDelete(activeTab, q._id)}
                          className="vh-btn vh-btn--danger vh-btn--sm"
                        >
                          Delete
                        </button>
                      </>
                    ) : (
                      <span className="vh-badge vh-badge--global">Read-only</span>
                    )
                  }
                />
              ))}
            </ul>
          </div>
        </div>
      )}
      </VendorDataSection>

      {showBulkModal && (
        <div className="modal-overlay" onClick={() => setShowBulkModal(false)} role="presentation">
          <div className="veq-bulk-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-labelledby="bulk-import-title">
            <h2 id="bulk-import-title">Bulk import {activeLabel} questions</h2>
            <p>Upload a <strong>.csv</strong> or <strong>.json</strong> file with question data.</p>

            {activeTab === 'grammar' && (
              <div className="veq-bulk-guide">
                <strong>CSV columns:</strong> questionText, subType, difficulty, options (pipe-separated or JSON), correctAnswer (index), explanation, isSubjective, blankSentence, grammarCategory
              </div>
            )}
            {activeTab === 'vocabulary' && (
              <div className="veq-bulk-guide">
                <strong>CSV columns:</strong> word, subType, difficulty, options (pipe-separated or JSON), correctAnswer (index), explanation, contextSentence
              </div>
            )}
            {activeTab === 'essay' && (
              <div className="veq-bulk-guide">
                <strong>CSV columns:</strong> prompt, writingType, instructions, wordLimitMin, wordLimitMax, timeLimit, difficulty
              </div>
            )}

            <div style={{ margin: '16px 0' }}>
              <input type="file" accept=".csv,.json" onChange={(e) => setBulkFile(e.target.files?.[0] || null)} />
            </div>

            {bulkResult && (
              <div className={`veq-bulk-guide ${bulkResult.created > 0 ? '' : ''}`} style={{ borderColor: bulkResult.created > 0 ? '#86efac' : '#fca5a5' }}>
                <p>{bulkResult.message}</p>
                {bulkResult.errors?.length > 0 && (
                  <div>
                    {bulkResult.errors.slice(0, 10).map((e, i) => (
                      <div key={i}>Row {e.row}: {e.error}</div>
                    ))}
                    {bulkResult.errors.length > 10 && <p>…and {bulkResult.errors.length - 10} more errors</p>}
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
              <button type="button" className="vh-btn vh-btn--secondary" onClick={() => setShowBulkModal(false)}>Close</button>
              <button type="button" className="vh-btn vh-btn--primary" disabled={!bulkFile || bulkImporting} onClick={handleBulkImport}>
                {bulkImporting ? 'Importing…' : 'Import'}
              </button>
            </div>
          </div>
        </div>
      )}
    </VendorHubPage>
  );
};

export default EnglishQuestionList;
