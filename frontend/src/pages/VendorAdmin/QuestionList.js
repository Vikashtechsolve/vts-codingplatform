import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axiosInstance from '../../utils/axios';
import './VendorAdminCommon.css';
import './QuestionList.css';

const QuestionList = () => {
  const [myCodingQuestions, setMyCodingQuestions] = useState([]);
  const [myMcqQuestions, setMyMcqQuestions] = useState([]);
  const [globalCodingQuestions, setGlobalCodingQuestions] = useState([]);
  const [globalMcqQuestions, setGlobalMcqQuestions] = useState([]);
  const [activeTab, setActiveTab] = useState('my');
  const [questionType, setQuestionType] = useState('coding');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchQuestions();
  }, []);

  const fetchQuestions = async () => {
    try {
      const [codingRes, mcqRes] = await Promise.all([
        axiosInstance.get('/questions/coding'),
        axiosInstance.get('/questions/mcq')
      ]);
      
      // Separate vendor and global questions
      const codingQuestions = codingRes.data || [];
      const mcqQuestions = mcqRes.data || [];
      
      setMyCodingQuestions(codingQuestions.filter(q => q.source === 'vendor'));
      setGlobalCodingQuestions(codingQuestions.filter(q => q.source === 'global'));
      setMyMcqQuestions(mcqQuestions.filter(q => q.source === 'vendor'));
      setGlobalMcqQuestions(mcqQuestions.filter(q => q.source === 'global'));
    } catch (error) {
      console.error('Error fetching questions:', error);
    } finally {
      setLoading(false);
    }
  };

  const getCurrentQuestions = () => {
    if (activeTab === 'my') {
      return questionType === 'coding' ? myCodingQuestions : myMcqQuestions;
    } else {
      return questionType === 'coding' ? globalCodingQuestions : globalMcqQuestions;
    }
  };

  const renderQuestionTable = (questions, type) => {
    if (questions.length === 0) {
      return (
        <div className="empty-state">
          <div className="empty-state-icon">{type === 'coding' ? '💻' : '❓'}</div>
          <h2>No {type === 'coding' ? 'Coding' : 'MCQ'} Questions Yet</h2>
          <p>{activeTab === 'my' ? 'Create your first question to get started.' : 'No global questions available yet.'}</p>
          {activeTab === 'my' && (
            <Link 
              to={`/vendor-admin/questions/${type}/create`} 
              className="btn btn-primary"
            >
              Create {type === 'coding' ? 'Coding' : 'MCQ'} Question
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
              ) : (
                <>
                  <th>Question</th>
                  <th>Difficulty</th>
                  <th>Options</th>
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
                ) : (
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

  return (
    <div className="container question-list-page">
      <div className="page-header">
        <h1 className="page-title">Questions</h1>
        {activeTab === 'my' && (
          <div className="btn-group">
            <Link to="/vendor-admin/questions/coding/create" className="btn btn-primary">
              ➕ Create Coding Question
            </Link>
            <Link to="/vendor-admin/questions/mcq/create" className="btn btn-primary">
              ➕ Create MCQ Question
            </Link>
          </div>
        )}
      </div>

      {/* Source Tabs */}
      <div className="tabs-container-modern">
        <button
          onClick={() => setActiveTab('my')}
          className={`tab-button-modern ${activeTab === 'my' ? 'active' : ''}`}
        >
          🏢 My Questions ({myCodingQuestions.length + myMcqQuestions.length})
        </button>
        <button
          onClick={() => setActiveTab('global')}
          className={`tab-button-modern ${activeTab === 'global' ? 'active' : ''}`}
        >
          🌐 Global Questions ({globalCodingQuestions.length + globalMcqQuestions.length})
        </button>
      </div>

      {/* Question Type Tabs */}
      <div className="tabs-container-modern">
        <button
          onClick={() => setQuestionType('coding')}
          className={`tab-button-modern ${questionType === 'coding' ? 'active' : ''}`}
        >
          💻 Coding Questions ({activeTab === 'my' ? myCodingQuestions.length : globalCodingQuestions.length})
        </button>
        <button
          onClick={() => setQuestionType('mcq')}
          className={`tab-button-modern ${questionType === 'mcq' ? 'active' : ''}`}
        >
          ❓ MCQ Questions ({activeTab === 'my' ? myMcqQuestions.length : globalMcqQuestions.length})
        </button>
      </div>

      <div className="questions-table-card">
        <div className="card-header">
          <h2>
            {activeTab === 'my' ? 'My' : 'Global'} {questionType === 'coding' ? 'Coding' : 'MCQ'} Questions
          </h2>
        </div>
        {renderQuestionTable(getCurrentQuestions(), questionType)}
      </div>
    </div>
  );
};

export default QuestionList;
