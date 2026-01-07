import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axiosInstance from '../../utils/axios';
import './VendorAdminCommon.css';
import './TestList.css';

const TestList = () => {
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTests();
  }, []);

  const fetchTests = async () => {
    try {
      const response = await axiosInstance.get('/tests');
      setTests(response.data);
    } catch (error) {
      console.error('Error fetching tests:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this test?')) {
      try {
        await axiosInstance.delete(`/tests/${id}`);
        fetchTests();
      } catch (error) {
        alert(error.response?.data?.message || 'Error deleting test');
      }
    }
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="container test-list-page">
      <div className="page-header">
        <h1 className="page-title">Tests</h1>
        <Link to="/vendor-admin/tests/create" className="btn btn-primary">
          ➕ Create Test
        </Link>
      </div>

      {tests.length === 0 ? (
        <div className="empty-state-modern">
          <div className="empty-state-icon-modern">📝</div>
          <h2>No Tests Yet</h2>
          <p>Create your first test to get started.</p>
          <Link to="/vendor-admin/tests/create" className="btn btn-primary">
            Create Test
          </Link>
        </div>
      ) : (
        <div className="tests-grid-modern">
          {tests.map(test => (
            <div key={test._id} className="test-card-list">
              <div className="test-card-header-list">
                <div className="test-title-list">
                  <h3>{test.title}</h3>
                  <span className={`test-type-badge-modern ${test.type}`}>
                    {test.type.toUpperCase()}
                  </span>
                </div>
                <span className={`status-badge-modern ${test.isActive ? 'active' : 'inactive'}`}>
                  {test.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
              
              <div className="test-meta-list">
                <div className="test-meta-item-list">
                  <strong>Duration:</strong> {test.duration} min
                </div>
                <div className="test-meta-item-list">
                  <strong>Questions:</strong> {test.questions?.length || 0}
                </div>
              </div>
              
              <div className="test-actions-list">
                <Link to={`/vendor-admin/tests/${test._id}/assign`} className="test-action-btn-list btn-primary">
                  Assign
                </Link>
                <Link to={`/vendor-admin/tests/${test._id}/results`} className="test-action-btn-list btn-secondary">
                  Results
                </Link>
                <button onClick={() => handleDelete(test._id)} className="test-action-btn-list btn-danger">
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TestList;

