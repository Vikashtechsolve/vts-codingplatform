import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axiosInstance from '../../utils/axios';
import './VendorAdminCommon.css';
import './EnglishQuestionList.css';

const TABS = [
  { key: 'grammar', label: 'Grammar', icon: 'Aa' },
  { key: 'vocabulary', label: 'Vocabulary', icon: 'Ab' },
  { key: 'reading', label: 'Reading', icon: 'Rc' },
  { key: 'essay', label: 'Essay / Email', icon: 'Es' },
  { key: 'speaking', label: 'Speaking', icon: 'Sp' },
  { key: 'listening', label: 'Listening', icon: 'Li' }
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
  extempore: 'Extempore'
};

const DIFFICULTY_COLORS = { easy: '#28a745', medium: '#ffc107', hard: '#dc3545' };

const BULK_SUPPORTED = ['grammar', 'vocabulary', 'essay'];

const EnglishQuestionList = () => {
  const [activeTab, setActiveTab] = useState('grammar');
  const [sourceTab, setSourceTab] = useState('my');
  const [questions, setQuestions] = useState({});
  const [loading, setLoading] = useState(true);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkFile, setBulkFile] = useState(null);
  const [bulkResult, setBulkResult] = useState(null);
  const [bulkImporting, setBulkImporting] = useState(false);

  useEffect(() => {
    fetchAllQuestions();
  }, []);

  const fetchAllQuestions = async () => {
    try {
      const [grammar, vocabulary, reading, essay, speaking, listening] = await Promise.all([
        axiosInstance.get('/questions/english/grammar'),
        axiosInstance.get('/questions/english/vocabulary'),
        axiosInstance.get('/questions/english/reading'),
        axiosInstance.get('/questions/english/essay'),
        axiosInstance.get('/questions/english/speaking'),
        axiosInstance.get('/questions/english/listening')
      ]);
      setQuestions({
        grammar: grammar.data || [],
        vocabulary: vocabulary.data || [],
        reading: reading.data || [],
        essay: essay.data || [],
        speaking: speaking.data || [],
        listening: listening.data || []
      });
    } catch (error) {
      console.error('Error fetching English questions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (type, id) => {
    if (!window.confirm('Are you sure you want to delete this question?')) return;
    try {
      await axiosInstance.delete(`/questions/english/${type}/${id}`);
      fetchAllQuestions();
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
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setBulkResult(response.data);
      fetchAllQuestions();
    } catch (error) {
      setBulkResult({ message: error.response?.data?.message || 'Import failed', errors: [{ error: error.message }] });
    } finally {
      setBulkImporting(false);
    }
  };

  const currentQuestions = (questions[activeTab] || []).filter(q => sourceTab === 'my' ? q.source === 'vendor' : q.source === 'global');

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
    if (type === 'reading') return `${q.questions?.length || 0} questions | ${q.passage?.wordCount || 0} words`;
    if (type === 'essay') return SUB_TYPE_LABELS[q.writingType] || q.writingType;
    if (type === 'speaking') return SUB_TYPE_LABELS[q.speakingType] || q.speakingType;
    if (type === 'listening') return `${q.questions?.length || 0} questions | ${q.maxReplays || 0} replays`;
    return '';
  };

  const getPoints = (q, type) => {
    if (type === 'reading' || type === 'listening') return q.totalPoints || 0;
    return q.points || 0;
  };

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div className="container english-question-list">
      <div className="page-header">
        <h1 className="page-title">English Questions</h1>
        <div className="header-actions">
          {BULK_SUPPORTED.includes(activeTab) && (
            <button className="btn btn-secondary" onClick={() => { setShowBulkModal(true); setBulkFile(null); setBulkResult(null); }}>
              Import CSV/JSON
            </button>
          )}
          <Link to={`/vendor-admin/english-questions/${activeTab}/create`} className="btn btn-primary">
            + Create {TABS.find(t => t.key === activeTab)?.label} Question
          </Link>
        </div>
      </div>

      <div className="question-type-tabs">
        {TABS.map(tab => (
          <button key={tab.key} className={`type-tab ${activeTab === tab.key ? 'active' : ''}`} onClick={() => setActiveTab(tab.key)}>
            <span className="tab-icon">{tab.icon}</span>
            <span className="tab-label">{tab.label}</span>
            <span className="tab-count">{(questions[tab.key] || []).filter(q => sourceTab === 'my' ? q.source === 'vendor' : q.source === 'global').length}</span>
          </button>
        ))}
      </div>

      <div className="source-tabs">
        <button className={`source-tab ${sourceTab === 'my' ? 'active' : ''}`} onClick={() => setSourceTab('my')}>My Questions</button>
        <button className={`source-tab ${sourceTab === 'global' ? 'active' : ''}`} onClick={() => setSourceTab('global')}>Global Questions</button>
      </div>

      {currentQuestions.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">{TABS.find(t => t.key === activeTab)?.icon}</div>
          <h2>No {TABS.find(t => t.key === activeTab)?.label} Questions</h2>
          <p>{sourceTab === 'my' ? 'Create your first question to get started.' : 'No global questions available.'}</p>
          {sourceTab === 'my' && (
            <Link to={`/vendor-admin/english-questions/${activeTab}/create`} className="btn btn-primary">Create Question</Link>
          )}
        </div>
      ) : (
        <div className="questions-grid">
          {currentQuestions.map(q => (
            <div key={q._id} className="question-card-eng">
              <div className="qcard-header">
                <span className="qcard-type-badge">{getQuestionMeta(q, activeTab)}</span>
                <span className="qcard-difficulty" style={{ color: DIFFICULTY_COLORS[q.difficulty] }}>{q.difficulty}</span>
              </div>
              <div className="qcard-body">
                <h3 className="qcard-title">{getQuestionTitle(q, activeTab)}</h3>
              </div>
              <div className="qcard-footer">
                <span className="qcard-points">{getPoints(q, activeTab)} pts</span>
                <div className="qcard-actions">
                  {q.source === 'vendor' && (
                    <>
                      <Link to={`/vendor-admin/english-questions/${activeTab}/edit/${q._id}`} className="btn btn-secondary btn-sm">Edit</Link>
                      <button onClick={() => handleDelete(activeTab, q._id)} className="btn btn-danger btn-sm">Delete</button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showBulkModal && (
        <div className="modal-overlay" onClick={() => setShowBulkModal(false)}>
          <div className="bulk-import-modal" onClick={e => e.stopPropagation()}>
            <h2>Bulk Import {TABS.find(t => t.key === activeTab)?.label} Questions</h2>
            <p className="bulk-info">Upload a <strong>.csv</strong> or <strong>.json</strong> file with question data.</p>

            {activeTab === 'grammar' && (
              <div className="bulk-format-guide">
                <strong>CSV columns:</strong> questionText, subType, difficulty, options (pipe-separated or JSON), correctAnswer (index), explanation, isSubjective, blankSentence, grammarCategory
              </div>
            )}
            {activeTab === 'vocabulary' && (
              <div className="bulk-format-guide">
                <strong>CSV columns:</strong> word, subType, difficulty, options (pipe-separated or JSON), correctAnswer (index), explanation, contextSentence
              </div>
            )}
            {activeTab === 'essay' && (
              <div className="bulk-format-guide">
                <strong>CSV columns:</strong> prompt, writingType, instructions, wordLimitMin, wordLimitMax, timeLimit, difficulty
              </div>
            )}

            <div className="bulk-file-input">
              <input
                type="file"
                accept=".csv,.json"
                onChange={e => setBulkFile(e.target.files?.[0] || null)}
              />
            </div>

            {bulkResult && (
              <div className={`bulk-result ${bulkResult.created > 0 ? 'success' : 'error'}`}>
                <p>{bulkResult.message}</p>
                {bulkResult.errors && bulkResult.errors.length > 0 && (
                  <div className="bulk-errors">
                    {bulkResult.errors.slice(0, 10).map((e, i) => (
                      <div key={i} className="bulk-error-item">Row {e.row}: {e.error}</div>
                    ))}
                    {bulkResult.errors.length > 10 && <p>...and {bulkResult.errors.length - 10} more errors</p>}
                  </div>
                )}
              </div>
            )}

            <div className="bulk-actions">
              <button className="btn btn-secondary" onClick={() => setShowBulkModal(false)}>Close</button>
              <button className="btn btn-primary" disabled={!bulkFile || bulkImporting} onClick={handleBulkImport}>
                {bulkImporting ? 'Importing...' : 'Import'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EnglishQuestionList;
