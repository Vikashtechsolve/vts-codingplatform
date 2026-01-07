import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axiosInstance from '../../utils/axios';
import Modal from '../../components/Modal';
import './AssignTestToClassroom.css';

const AssignTestToClassroom = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [classroom, setClassroom] = useState(null);
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState({ isOpen: false, title: '', message: '', type: 'info' });
  const [assigningTestId, setAssigningTestId] = useState(null);

  useEffect(() => {
    fetchData();
  }, [id]);

  const showModal = (title, message, type = 'info') => {
    setModal({ isOpen: true, title, message, type });
  };

  const closeModal = () => {
    setModal({ isOpen: false, title: '', message: '', type: 'info' });
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const [classroomRes, testsRes] = await Promise.all([
        axiosInstance.get(`/vendor-admin/classrooms/${id}`),
        axiosInstance.get('/vendor-admin/tests')
      ]);

      setClassroom(classroomRes.data);
      setTests(testsRes.data);
    } catch (error) {
      console.error('❌ Error fetching data:', error);
      showModal('Error', error.response?.data?.message || 'Failed to load data.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleAssignTest = async (testId) => {
    if (!window.confirm(`Assign this test to all students in "${classroom.name}"?`)) {
      return;
    }

    try {
      setAssigningTestId(testId);
      const response = await axiosInstance.post(`/vendor-admin/classrooms/${id}/tests/${testId}`);
      showModal('Success', response.data.message || 'Test assigned successfully!', 'success');
      fetchData();
    } catch (error) {
      console.error('❌ Error assigning test:', error);
      showModal('Error', error.response?.data?.message || 'Failed to assign test.', 'error');
    } finally {
      setAssigningTestId(null);
    }
  };

  const handleRemoveTest = async (testId) => {
    if (!window.confirm('Remove this test from the classroom?')) {
      return;
    }

    try {
      await axiosInstance.delete(`/vendor-admin/classrooms/${id}/tests/${testId}`);
      showModal('Success', 'Test removed successfully!', 'success');
      fetchData();
    } catch (error) {
      console.error('❌ Error removing test:', error);
      showModal('Error', error.response?.data?.message || 'Failed to remove test.', 'error');
    }
  };

  if (loading && !classroom) {
    return <div className="loading">Loading...</div>;
  }

  if (!classroom) {
    return (
      <div className="container">
        <div className="error" style={{ padding: '20px', textAlign: 'center' }}>
          <h3>Classroom Not Found</h3>
          <p>Unable to load classroom data.</p>
          <Link to="/vendor-admin/classrooms" className="btn btn-primary">
            Back to Classrooms
          </Link>
        </div>
      </div>
    );
  }

  const assignedTestIds = classroom.assignedTests?.map(at => at.testId._id || at.testId.toString()) || [];
  const availableTests = tests.filter(t => !assignedTestIds.includes(t._id.toString()));
  const assignedTests = tests.filter(t => assignedTestIds.includes(t._id.toString()));

  return (
    <div className="container assign-test-classroom">
      <Modal 
        isOpen={modal.isOpen} 
        onClose={closeModal}
        title={modal.title}
        type={modal.type}
      >
        <p>{modal.message}</p>
      </Modal>

      <div className="page-header">
        <div>
          <h1 className="page-title">Assign Tests to {classroom.name}</h1>
          <p className="page-subtitle">
            {classroom.students?.length || 0} student(s) in this classroom
          </p>
        </div>
        <Link to="/vendor-admin/classrooms" className="btn btn-secondary">
          Back to Classrooms
        </Link>
      </div>

      <div className="content-grid">
        {/* Assigned Tests */}
        <div className="section-card">
          <div className="section-header">
            <h2>Assigned Tests ({assignedTests.length})</h2>
          </div>

          {assignedTests.length > 0 ? (
            <div className="tests-list">
              {assignedTests.map(test => {
                const assignment = classroom.assignedTests.find(
                  at => (at.testId._id || at.testId.toString()) === test._id.toString()
                );
                return (
                  <div key={test._id} className="test-item assigned">
                    <div className="test-info">
                      <h4>{test.title}</h4>
                      <div className="test-meta">
                        <span className="test-type">{test.type}</span>
                        <span className="test-duration">{test.duration} min</span>
                      </div>
                      {assignment && (
                        <div className="assignment-date">
                          Assigned: {new Date(assignment.assignedAt).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => handleRemoveTest(test._id)}
                      className="btn-icon btn-danger"
                      title="Remove test"
                    >
                      ×
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="empty-state-small">
              <p>No tests assigned to this classroom yet.</p>
            </div>
          )}
        </div>

        {/* Available Tests */}
        <div className="section-card">
          <div className="section-header">
            <h2>Available Tests ({availableTests.length})</h2>
          </div>

          {availableTests.length > 0 ? (
            <div className="tests-list">
              {availableTests.map(test => (
                <div key={test._id} className="test-item">
                  <div className="test-info">
                    <h4>{test.title}</h4>
                    <div className="test-meta">
                      <span className="test-type">{test.type}</span>
                      <span className="test-duration">{test.duration} min</span>
                    </div>
                    {test.description && (
                      <p className="test-description">{test.description.substring(0, 100)}...</p>
                    )}
                  </div>
                  <button
                    onClick={() => handleAssignTest(test._id)}
                    className="btn btn-primary btn-sm"
                    disabled={assigningTestId === test._id || classroom.students?.length === 0}
                    title={classroom.students?.length === 0 ? 'Add students first' : 'Assign to classroom'}
                  >
                    {assigningTestId === test._id ? 'Assigning...' : 'Assign'}
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state-small">
              <p>All tests are already assigned to this classroom.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AssignTestToClassroom;

