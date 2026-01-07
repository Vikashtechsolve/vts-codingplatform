import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axiosInstance from '../../utils/axios';
import '../VendorAdmin/VendorAdminCommon.css';

const GlobalQuestions = () => {
  const [codingQuestions, setCodingQuestions] = useState([]);
  const [mcqQuestions, setMcqQuestions] = useState([]);
  const [activeTab, setActiveTab] = useState('coding');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchQuestions();
  }, []);

  const fetchQuestions = async () => {
    try {
      const [codingRes, mcqRes] = await Promise.all([
        axiosInstance.get('/super-admin/global-questions/coding'),
        axiosInstance.get('/super-admin/global-questions/mcq')
      ]);
      setCodingQuestions(codingRes.data);
      setMcqQuestions(mcqRes.data);
    } catch (error) {
      console.error('Error fetching global questions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id, type) => {
    if (!window.confirm('Are you sure you want to delete this global question?')) {
      return;
    }

    try {
      await axiosInstance.delete(`/super-admin/global-questions/${type}/${id}`);
      fetchQuestions();
      alert('Question deleted successfully!');
    } catch (error) {
      alert(error.response?.data?.message || 'Error deleting question');
    }
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="container">
      <div className="page-header">
        <h1 className="page-title">Global Question Bank</h1>
        <div className="btn-group">
          <Link to="/super-admin/global-questions/coding/create" className="btn btn-primary">
            Create Global Coding Question
          </Link>
          <Link to="/super-admin/global-questions/mcq/create" className="btn btn-primary">
            Create Global MCQ Question
          </Link>
        </div>
      </div>

      <div className="btn-group" style={{ marginBottom: '25px' }}>
        <button
          onClick={() => setActiveTab('coding')}
          className={`btn ${activeTab === 'coding' ? 'btn-primary' : 'btn-secondary'}`}
        >
          Coding Questions ({codingQuestions.length})
        </button>
        <button
          onClick={() => setActiveTab('mcq')}
          className={`btn ${activeTab === 'mcq' ? 'btn-primary' : 'btn-secondary'}`}
        >
          MCQ Questions ({mcqQuestions.length})
        </button>
      </div>

      {activeTab === 'coding' && (
        <div className="card">
          <div className="card-header">
            <h2>Global Coding Questions</h2>
          </div>
          {codingQuestions.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">💻</div>
              <h2>No Global Coding Questions Yet</h2>
              <p>Create global questions that all vendors can use.</p>
              <Link to="/super-admin/global-questions/coding/create" className="btn btn-primary">
                Create Global Coding Question
              </Link>
            </div>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Created By</th>
                    <th>Difficulty</th>
                    <th>Languages</th>
                    <th>Test Cases</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {codingQuestions.map(q => (
                    <tr key={q._id}>
                      <td>{q.title}</td>
                      <td>{q.createdBy?.name || 'N/A'}</td>
                      <td><span className="status-badge active">{q.difficulty}</span></td>
                      <td>{q.allowedLanguages?.join(', ') || 'N/A'}</td>
                      <td>{q.testCases?.length || 0}</td>
                      <td>
                        <div className="btn-group">
                          <Link 
                            to={`/super-admin/global-questions/coding/edit/${q._id}`}
                            className="btn btn-sm btn-secondary"
                          >
                            Edit
                          </Link>
                          <button
                            onClick={() => handleDelete(q._id, 'coding')}
                            className="btn btn-sm btn-danger"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'mcq' && (
        <div className="card">
          <div className="card-header">
            <h2>Global MCQ Questions</h2>
          </div>
          {mcqQuestions.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">❓</div>
              <h2>No Global MCQ Questions Yet</h2>
              <p>Create global questions that all vendors can use.</p>
              <Link to="/super-admin/global-questions/mcq/create" className="btn btn-primary">
                Create Global MCQ Question
              </Link>
            </div>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Question</th>
                    <th>Created By</th>
                    <th>Difficulty</th>
                    <th>Options</th>
                    <th>Points</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {mcqQuestions.map(q => (
                    <tr key={q._id}>
                      <td>{q.question}</td>
                      <td>{q.createdBy?.name || 'N/A'}</td>
                      <td><span className="status-badge active">{q.difficulty}</span></td>
                      <td>{q.options?.length || 0}</td>
                      <td>{q.points}</td>
                      <td>
                        <div className="btn-group">
                          <Link 
                            to={`/super-admin/global-questions/mcq/edit/${q._id}`}
                            className="btn btn-sm btn-secondary"
                          >
                            Edit
                          </Link>
                          <button
                            onClick={() => handleDelete(q._id, 'mcq')}
                            className="btn btn-sm btn-danger"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default GlobalQuestions;

