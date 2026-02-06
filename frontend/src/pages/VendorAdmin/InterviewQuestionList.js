import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axiosInstance from '../../utils/axios';
import './VendorAdminCommon.css';
import './InterviewQuestionList.css';

const InterviewQuestionList = () => {
  const [myQuestions, setMyQuestions] = useState([]);
  const [globalQuestions, setGlobalQuestions] = useState([]);
  const [activeTab, setActiveTab] = useState('my');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchQuestions();
  }, []);

  const fetchQuestions = async () => {
    try {
      const response = await axiosInstance.get('/interview-questions');
      const questions = response.data || [];
      setMyQuestions(questions.filter(q => q.source === 'vendor'));
      setGlobalQuestions(questions.filter(q => q.source === 'global'));
    } catch (error) {
      console.error('Error fetching interview questions:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  const questions = activeTab === 'my' ? myQuestions : globalQuestions;

  return (
    <div className="container interview-question-list">
      <div className="page-header">
        <h1 className="page-title">Interview Questions</h1>
        {activeTab === 'my' && (
          <Link to="/vendor-admin/interview-questions/create" className="btn btn-primary">
            ➕ Create Interview Question
          </Link>
        )}
      </div>

      <div className="tabs-container-modern">
        <button
          onClick={() => setActiveTab('my')}
          className={`tab-button-modern ${activeTab === 'my' ? 'active' : ''}`}
        >
          My Questions ({myQuestions.length})
        </button>
        <button
          onClick={() => setActiveTab('global')}
          className={`tab-button-modern ${activeTab === 'global' ? 'active' : ''}`}
        >
          Global Questions ({globalQuestions.length})
        </button>
      </div>

      <div className="question-table-card">
        {questions.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🎤</div>
            <h2>No Interview Questions</h2>
            <p>Create questions to build your interview bank.</p>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Question</th>
                <th>Type</th>
                <th>Topic</th>
                <th>Difficulty</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {questions.map(q => (
                <tr key={q._id}>
                  <td>{q.question}</td>
                  <td>{q.interviewType}</td>
                  <td>{q.topic}</td>
                  <td>{q.difficulty}</td>
                  <td>
                    {activeTab === 'my' ? (
                      <Link to={`/vendor-admin/interview-questions/edit/${q._id}`} className="btn btn-sm btn-secondary">
                        Edit
                      </Link>
                    ) : (
                      <span className="read-only-badge">Read-only</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default InterviewQuestionList;
