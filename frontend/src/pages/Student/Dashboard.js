import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axiosInstance from '../../utils/axios';
import './Dashboard.css';

const StudentDashboard = () => {
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTests();
  }, []);

  const fetchTests = async () => {
    try {
      setLoading(true);
      console.log('📥 Fetching assigned tests...');
      const response = await axiosInstance.get('/students/tests');
      console.log('✅ Tests fetched:', response.data?.length || 0);
      setTests(response.data || []);
    } catch (error) {
      console.error('❌ Error fetching tests:', error);
      alert('Error loading tests. Please refresh the page.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="container student-dashboard">
      <h1 className="page-title">My Tests</h1>

      {tests.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📝</div>
          <h2>No Tests Assigned</h2>
          <p>No tests assigned yet.</p>
          <p>Your instructor will assign tests to you.</p>
        </div>
      ) : (
        <div className="tests-grid">
          {tests.map(test => (
            <div key={test._id} className="test-card-modern">
              <div className="test-card-header">
                <div className="test-title-section">
                  <h3>{test.title}</h3>
                  <span className={`test-type-badge-modern ${test.type}`}>
                    {test.type}
                  </span>
                </div>
              </div>
              
              <div className="test-meta">
                <div className="test-meta-item">
                  <strong>Duration:</strong> {test.duration} min
                </div>
              </div>
              
              <div className="test-status-section">
                <span className={`status-badge-modern ${test.enrollmentStatus || 'assigned'}`}>
                  {test.enrollmentStatus || 'assigned'}
                </span>
                {(test.enrollmentStatus === 'assigned' || !test.enrollmentStatus) && (
                  <Link 
                    to={`/student/test/${test._id}`} 
                    className="test-action-btn btn-primary"
                  >
                    Start Test →
                  </Link>
                )}
                {test.enrollmentStatus === 'in_progress' && (
                  <Link 
                    to={`/student/test/${test._id}`} 
                    className="test-action-btn btn-secondary"
                  >
                    Continue →
                  </Link>
                )}
                {test.enrollmentStatus === 'completed' && (
                  <Link 
                    to={test.resultId ? `/student/result/${test.resultId}` : `/student/result/test/${test._id}`} 
                    className="test-action-btn btn-secondary"
                  >
                    View Result →
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default StudentDashboard;

