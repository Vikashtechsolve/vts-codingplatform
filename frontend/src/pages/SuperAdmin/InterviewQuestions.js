import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axiosInstance from '../../utils/axios';
import '../VendorAdmin/VendorAdminCommon.css';

const InterviewQuestions = () => {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchQuestions();
  }, []);

  const fetchQuestions = async () => {
    try {
      const response = await axiosInstance.get('/super-admin/interview-questions');
      setQuestions(response.data || []);
    } catch (error) {
      console.error('Error fetching interview questions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this interview question?')) return;
    try {
      await axiosInstance.delete(`/super-admin/interview-questions/${id}`);
      fetchQuestions();
    } catch (error) {
      alert(error.response?.data?.message || 'Error deleting question');
    }
  };

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div className="container">
      <div className="page-header">
        <h1 className="page-title">Interview Question Bank</h1>
        <Link to="/super-admin/interview-questions/create" className="btn btn-primary">
          Create Interview Question
        </Link>
      </div>

      {questions.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🎤</div>
          <h2>No Interview Questions</h2>
          <p>Create global interview questions for all vendors.</p>
        </div>
      ) : (
        <div className="table-container">
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
                    <Link to={`/super-admin/interview-questions/edit/${q._id}`} className="btn btn-sm btn-secondary">
                      Edit
                    </Link>
                    <button onClick={() => handleDelete(q._id)} className="btn btn-sm btn-danger">
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default InterviewQuestions;
