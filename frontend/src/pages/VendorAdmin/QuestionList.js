import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axiosInstance from '../../utils/axios';
import './VendorAdminCommon.css';
import './QuestionList.css';

const QuestionList = () => {
  const [myCodingQuestions, setMyCodingQuestions] = useState([]);
  const [myMcqQuestions, setMyMcqQuestions] = useState([]);
  const [myAptitudeQuestions, setMyAptitudeQuestions] = useState([]);
  const [globalCodingQuestions, setGlobalCodingQuestions] = useState([]);
  const [globalMcqQuestions, setGlobalMcqQuestions] = useState([]);
  const [globalAptitudeQuestions, setGlobalAptitudeQuestions] = useState([]);
  const [myTheoryQuestions, setMyTheoryQuestions] = useState([]);
  const [globalTheoryQuestions, setGlobalTheoryQuestions] = useState([]);
  const [activeTab, setActiveTab] = useState('my');
  const [questionType, setQuestionType] = useState('coding');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchQuestions();
  }, []);

  const fetchQuestions = async () => {
    try {
      const [codingRes, mcqRes, aptitudeRes, theoryRes] = await Promise.all([
        axiosInstance.get('/questions/coding'),
        axiosInstance.get('/questions/mcq'),
        axiosInstance.get('/questions/aptitude'),
        axiosInstance.get('/questions/theory')
      ]);
      
      // Separate vendor and global questions
      const codingQuestions = codingRes.data || [];
      const mcqQuestions = mcqRes.data || [];
      const aptitudeQuestions = aptitudeRes.data || [];
      const theoryQuestions = theoryRes.data || [];
      
      setMyCodingQuestions(codingQuestions.filter(q => q.source === 'vendor'));
      setGlobalCodingQuestions(codingQuestions.filter(q => q.source === 'global'));
      setMyMcqQuestions(mcqQuestions.filter(q => q.source === 'vendor'));
      setGlobalMcqQuestions(mcqQuestions.filter(q => q.source === 'global'));
      setMyAptitudeQuestions(aptitudeQuestions.filter(q => q.source === 'vendor'));
      setGlobalAptitudeQuestions(aptitudeQuestions.filter(q => q.source === 'global'));
      setMyTheoryQuestions(theoryQuestions.filter(q => q.source === 'vendor'));
      setGlobalTheoryQuestions(theoryQuestions.filter(q => q.source === 'global'));
    } catch (error) {
      console.error('Error fetching questions:', error);
    } finally {
      setLoading(false);
    }
  };

  const getCurrentQuestions = () => {
    if (questionType === 'english') return [];
    if (activeTab === 'my') {
      if (questionType === 'coding') return myCodingQuestions;
      if (questionType === 'mcq') return myMcqQuestions;
      if (questionType === 'theory') return myTheoryQuestions;
      return myAptitudeQuestions;
    } else {
      if (questionType === 'coding') return globalCodingQuestions;
      if (questionType === 'mcq') return globalMcqQuestions;
      if (questionType === 'theory') return globalTheoryQuestions;
      return globalAptitudeQuestions;
    }
  };

  const renderQuestionTable = (questions, type) => {
    if (type === 'english') {
      return (
        <div className="empty-state english-questions-cta">
          <div className="empty-state-icon">🗣️</div>
          <h2>Verbal & English Questions</h2>
          <p>Manage Grammar, Vocabulary, Reading, Essay, Speaking, and Listening questions in one place.</p>
          <Link to="/vendor-admin/english-questions" className="btn btn-primary">
            Manage English Questions
          </Link>
        </div>
      );
    }
    if (questions.length === 0) {
      return (
        <div className="empty-state">
          <div className="empty-state-icon">{type === 'coding' ? '💻' : type === 'mcq' ? '❓' : type === 'theory' ? '📚' : '🧠'}</div>
          <h2>No {type === 'coding' ? 'Coding' : type === 'mcq' ? 'MCQ' : type === 'theory' ? 'Theory' : 'Aptitude'} Questions Yet</h2>
          <p>{activeTab === 'my' ? 'Create your first question to get started.' : 'No global questions available yet.'}</p>
          {activeTab === 'my' && (
            <Link 
              to={`/vendor-admin/questions/${type}/create`} 
              className="btn btn-primary"
            >
              Create {type === 'coding' ? 'Coding' : type === 'mcq' ? 'MCQ' : type === 'theory' ? 'Theory' : 'Aptitude'} Question
            </Link>
          )}
        </div>
      );
    }

    return (
      <div className="table-container">
        <table className="question-table-modern">
          <thead>
            <tr>
              {type === 'coding' ? (
                <>
                  <th>Title</th>
                  <th>Difficulty</th>
                  <th>Languages</th>
                  <th>Test Cases</th>
                  <th>Actions</th>
                </>
              ) : type === 'mcq' ? (
                <>
                  <th>Question</th>
                  <th>Difficulty</th>
                  <th>Options</th>
                  <th>Points</th>
                  <th>Actions</th>
                </>
              ) : type === 'theory' ? (
                <>
                  <th>Question</th>
                  <th>Subject</th>
                  <th>Topic</th>
                  <th>Difficulty</th>
                  <th>Marks</th>
                  <th>Actions</th>
                </>
              ) : (
                <>
                  <th>Question</th>
                  <th>Section</th>
                  <th>Type</th>
                  <th>Difficulty</th>
                  <th>Points</th>
                  <th>Actions</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {questions.map(q => (
              <tr key={q._id}>
                {type === 'coding' ? (
                  <>
                    <td><strong>{q.title}</strong></td>
                    <td><span className={`difficulty-badge-table ${q.difficulty}`}>{q.difficulty}</span></td>
                    <td>
                      <div className="languages-list">
                        {q.allowedLanguages?.map((lang, idx) => (
                          <span key={idx} className="language-tag">{lang}</span>
                        )) || <span>N/A</span>}
                      </div>
                    </td>
                    <td>{q.testCases?.length || 0}</td>
                    <td>
                      {activeTab === 'my' && (
                        <Link 
                          to={`/vendor-admin/questions/coding/edit/${q._id}`}
                          className="btn btn-sm btn-secondary"
                        >
                          Edit
                        </Link>
                      )}
                      {activeTab === 'global' && (
                        <span className="read-only-badge">Read-only</span>
                      )}
                    </td>
                  </>
                ) : type === 'mcq' ? (
                  <>
                    <td><strong>{q.question}</strong></td>
                    <td><span className={`difficulty-badge-table ${q.difficulty}`}>{q.difficulty}</span></td>
                    <td>{q.options?.length || 0}</td>
                    <td><strong>{q.points}</strong></td>
                    <td>
                      {activeTab === 'my' && (
                        <Link 
                          to={`/vendor-admin/questions/mcq/edit/${q._id}`}
                          className="btn btn-sm btn-secondary"
                        >
                          Edit
                        </Link>
                      )}
                      {activeTab === 'global' && (
                        <span className="read-only-badge">Read-only</span>
                      )}
                    </td>
                  </>
                ) : type === 'theory' ? (
                  <>
                    <td><strong>{q.questionText}</strong></td>
                    <td>{q.subjectId?.name || '—'}</td>
                    <td>{q.topicId?.name || '—'}</td>
                    <td><span className={`difficulty-badge-table ${q.difficulty}`}>{q.difficulty}</span></td>
                    <td><strong>{q.maxMarks || 10}</strong></td>
                    <td>
                      {activeTab === 'my' && (
                        <Link
                          to={`/vendor-admin/questions/theory/edit/${q._id}`}
                          className="btn btn-sm btn-secondary"
                        >
                          Edit
                        </Link>
                      )}
                      {activeTab === 'global' && (
                        <span className="read-only-badge">Read-only</span>
                      )}
                    </td>
                  </>
                ) : (
                  <>
                    <td><strong>{q.question}</strong></td>
                    <td>{q.section}</td>
                    <td>{q.questionType}</td>
                    <td><span className={`difficulty-badge-table ${q.difficulty}`}>{q.difficulty}</span></td>
                    <td><strong>{q.points}</strong></td>
                    <td>
                      {activeTab === 'my' && (
                        <Link
                          to={`/vendor-admin/questions/aptitude/edit/${q._id}`}
                          className="btn btn-sm btn-secondary"
                        >
                          Edit
                        </Link>
                      )}
                      {activeTab === 'global' && (
                        <span className="read-only-badge">Read-only</span>
                      )}
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  const createQuestionActions = [
    { to: '/vendor-admin/questions/coding/create', label: 'Coding', icon: '💻' },
    { to: '/vendor-admin/questions/mcq/create', label: 'MCQ', icon: '❓' },
    { to: '/vendor-admin/questions/aptitude/create', label: 'Aptitude', icon: '🧠' },
    { to: '/vendor-admin/questions/theory/create', label: 'Theory', icon: '📚' },
    { to: '/vendor-admin/english-questions', label: 'English & Verbal', icon: '🗣️' },
  ];

  return (
    <div className="container question-list-page">
      <div className="page-header question-list-header">
        <h1 className="page-title">Questions</h1>
      </div>

      {/* Section 1: Create new question - always visible */}
      <div className="questions-page-section create-section">
        <h2 className="section-heading">1. Create new question</h2>
        <p className="section-desc">Choose a type to add a new question. New questions appear under &quot;My Questions&quot;.</p>
        <div className="create-question-row">
          {createQuestionActions.map(({ to, label, icon }) => (
            <Link key={to} to={to} className="create-question-btn" title={`Create ${label} question`}>
              <span className="create-question-icon">{icon}</span>
              <span className="create-question-text">{label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Section 2: View My or Global - source filter */}
      <div className="questions-page-section source-section">
        <h2 className="section-heading">2. View questions from</h2>
        <p className="section-desc">Switch between your questions and shared global questions.</p>
        <div className="tabs-container-modern source-tabs">
          <button
            type="button"
            onClick={() => setActiveTab('my')}
            className={`tab-button-modern ${activeTab === 'my' ? 'active' : ''}`}
            aria-pressed={activeTab === 'my'}
          >
            🏢 My Questions ({myCodingQuestions.length + myMcqQuestions.length + myAptitudeQuestions.length + myTheoryQuestions.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('global')}
            className={`tab-button-modern ${activeTab === 'global' ? 'active' : ''}`}
            aria-pressed={activeTab === 'global'}
          >
            🌐 Global Questions ({globalCodingQuestions.length + globalMcqQuestions.length + globalAptitudeQuestions.length + globalTheoryQuestions.length})
          </button>
        </div>
      </div>

      {/* Section 3: Filter by type */}
      <div className="questions-page-section type-section">
        <h2 className="section-heading">3. Filter by type</h2>
        <p className="section-desc">Select a question type to see the list below.</p>
        <div className="tabs-container-modern type-tabs">
          <button
            type="button"
            onClick={() => setQuestionType('coding')}
            className={`tab-button-modern ${questionType === 'coding' ? 'active' : ''}`}
            aria-pressed={questionType === 'coding'}
          >
            💻 Coding ({activeTab === 'my' ? myCodingQuestions.length : globalCodingQuestions.length})
          </button>
          <button
            type="button"
            onClick={() => setQuestionType('mcq')}
            className={`tab-button-modern ${questionType === 'mcq' ? 'active' : ''}`}
            aria-pressed={questionType === 'mcq'}
          >
            ❓ MCQ ({activeTab === 'my' ? myMcqQuestions.length : globalMcqQuestions.length})
          </button>
          <button
            type="button"
            onClick={() => setQuestionType('aptitude')}
            className={`tab-button-modern ${questionType === 'aptitude' ? 'active' : ''}`}
            aria-pressed={questionType === 'aptitude'}
          >
            🧠 Aptitude ({activeTab === 'my' ? myAptitudeQuestions.length : globalAptitudeQuestions.length})
          </button>
          <button
            type="button"
            onClick={() => setQuestionType('theory')}
            className={`tab-button-modern ${questionType === 'theory' ? 'active' : ''}`}
            aria-pressed={questionType === 'theory'}
          >
            📚 Theory ({activeTab === 'my' ? myTheoryQuestions.length : globalTheoryQuestions.length})
          </button>
          <button
            type="button"
            onClick={() => setQuestionType('english')}
            className={`tab-button-modern ${questionType === 'english' ? 'active' : ''}`}
            aria-pressed={questionType === 'english'}
          >
            🗣️ Verbal & English
          </button>
        </div>
      </div>

      <div className="questions-table-card">
        <div className="card-header">
          <h2>
            {questionType === 'english'
              ? 'Verbal & English Questions'
              : `${activeTab === 'my' ? 'My' : 'Global'} ${questionType === 'coding' ? 'Coding' : questionType === 'mcq' ? 'MCQ' : questionType === 'theory' ? 'Theory' : 'Aptitude'} Questions`}
          </h2>
        </div>
        {renderQuestionTable(getCurrentQuestions(), questionType)}
      </div>
    </div>
  );
};

export default QuestionList;
