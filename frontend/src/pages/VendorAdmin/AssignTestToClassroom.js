import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import axiosInstance from '../../utils/axios';
import Modal from '../../components/Modal';
import './AssignTestToClassroom.css';

const TEST_TYPES = ['all', 'coding', 'mcq', 'aptitude', 'theory', 'mixed', 'interview'];

const AssignTestToClassroom = () => {
  const { id } = useParams();
  const [classroom, setClassroom] = useState(null);
  const [tests, setTests] = useState([]);
  const [interviews, setInterviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState({ isOpen: false, title: '', message: '', type: 'info' });
  const [assigningId, setAssigningId] = useState(null);
  const [testTypeFilter, setTestTypeFilter] = useState('all');

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run when classroom id changes
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
      const [classroomRes, testsRes, interviewsRes] = await Promise.all([
        axiosInstance.get(`/vendor-admin/classrooms/${id}`),
        axiosInstance.get('/vendor-admin/tests'),
        axiosInstance.get('/interviews').catch(() => ({ data: [] }))
      ]);

      setClassroom(classroomRes.data);
      setTests(Array.isArray(testsRes.data) ? testsRes.data : []);
      setInterviews(Array.isArray(interviewsRes?.data) ? interviewsRes.data : []);
    } catch (error) {
      console.error('❌ Error fetching data:', error);
      showModal('Error', error.response?.data?.message || 'Failed to load data.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleAssign = async (item) => {
    if (!window.confirm(`Assign this test to all students in "${classroom.name}"?`)) return;
    const isInterview = item.kind === 'interview';
    try {
      setAssigningId(item._id);
      if (isInterview) {
        const response = await axiosInstance.post(`/vendor-admin/classrooms/${id}/interviews/${item._id}`);
        showModal('Success', response.data.message || 'Test assigned successfully!', 'success');
      } else {
        const response = await axiosInstance.post(`/vendor-admin/classrooms/${id}/tests/${item._id}`);
        showModal('Success', response.data.message || 'Test assigned successfully!', 'success');
      }
      fetchData();
    } catch (error) {
      showModal('Error', error.response?.data?.message || 'Failed to assign test.', 'error');
    } finally {
      setAssigningId(null);
    }
  };

  const handleRemove = async (item) => {
    if (!window.confirm('Remove this test from the classroom?')) return;
    const isInterview = item.kind === 'interview';
    try {
      if (isInterview) {
        await axiosInstance.delete(`/vendor-admin/classrooms/${id}/interviews/${item._id}`);
      } else {
        await axiosInstance.delete(`/vendor-admin/classrooms/${id}/tests/${item._id}`);
      }
      showModal('Success', 'Test removed successfully!', 'success');
      fetchData();
    } catch (error) {
      showModal('Error', error.response?.data?.message || 'Failed to remove test.', 'error');
    }
  };

  const assignedTestIds = useMemo(
    () => classroom?.assignedTests?.map(at => (at.testId?._id || at.testId)?.toString()).filter(Boolean) || [],
    [classroom?.assignedTests]
  );
  const assignedInterviewIds = useMemo(
    () => (classroom?.assignedInterviews || []).map(ai => (ai.interviewId?._id || ai.interviewId)?.toString()).filter(Boolean),
    [classroom?.assignedInterviews]
  );

  const assignedItems = useMemo(() => {
    const testItems = tests.filter(t => assignedTestIds.includes(t._id.toString())).map(t => ({ ...t, kind: 'test' }));
    const interviewItems = interviews
      .filter(i => assignedInterviewIds.includes(i._id.toString()))
      .map(i => ({ _id: i._id, title: i.title, type: 'interview', kind: 'interview', duration: i.duration, topic: i.topic, interviewType: i.interviewType }));
    return [...testItems, ...interviewItems];
  }, [tests, interviews, assignedTestIds, assignedInterviewIds]);

  const availableItems = useMemo(() => {
    const testItems = tests.filter(t => !assignedTestIds.includes(t._id.toString())).map(t => ({ ...t, kind: 'test' }));
    const interviewItems = interviews
      .filter(i => !assignedInterviewIds.includes(i._id.toString()))
      .map(i => ({ _id: i._id, title: i.title, type: 'interview', kind: 'interview', duration: i.duration, topic: i.topic, interviewType: i.interviewType, description: i.description }));
    return [...testItems, ...interviewItems];
  }, [tests, interviews, assignedTestIds, assignedInterviewIds]);

  const filteredAssigned = useMemo(() => {
    if (testTypeFilter === 'all') return assignedItems;
    return assignedItems.filter(t => t.type === testTypeFilter);
  }, [assignedItems, testTypeFilter]);

  const filteredAvailable = useMemo(() => {
    if (testTypeFilter === 'all') return availableItems;
    return availableItems.filter(t => t.type === testTypeFilter);
  }, [availableItems, testTypeFilter]);

  const getAssignment = (item) => {
    if (item.kind === 'interview') {
      return (classroom?.assignedInterviews || []).find(
        ai => (ai.interviewId?._id || ai.interviewId)?.toString() === item._id.toString()
      );
    }
    return classroom?.assignedTests?.find(
      at => (at.testId?._id || at.testId)?.toString() === item._id.toString()
    );
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

  return (
    <div className="container assign-test-classroom">
      <Modal isOpen={modal.isOpen} onClose={closeModal} title={modal.title} type={modal.type}>
        <p>{modal.message}</p>
      </Modal>

      <div className="page-header">
        <div>
          <h1 className="page-title">Assign Tests to {classroom.name}</h1>
          <p className="page-subtitle">
            {classroom.students?.length || 0} student(s) · Assign any test type
          </p>
        </div>
        <Link to="/vendor-admin/classrooms" className="btn btn-secondary">
          Back to Classrooms
        </Link>
      </div>

      <div className="assign-section">
        <div className="test-type-filters">
          {TEST_TYPES.map(type => (
            <button
              key={type}
              type="button"
              className={`filter-chip ${testTypeFilter === type ? 'active' : ''}`}
              onClick={() => setTestTypeFilter(type)}
            >
              {type === 'all' ? 'All types' : type === 'interview' ? 'Interview' : type.charAt(0).toUpperCase() + type.slice(1)}
            </button>
          ))}
        </div>

        <div className="content-grid">
          <div className="section-card">
            <div className="section-header">
              <h2>Assigned Tests ({filteredAssigned.length})</h2>
            </div>

            {filteredAssigned.length > 0 ? (
              <div className="tests-list">
                {filteredAssigned.map(item => {
                  const assignment = getAssignment(item);
                  return (
                    <div key={item._id} className="test-item assigned">
                      <div className="test-info">
                        <h4>{item.title}</h4>
                        <div className="test-meta">
                          <span className={`test-type-badge ${item.type}`}>{item.type}</span>
                          <span className="test-duration">{item.duration} min</span>
                        </div>
                        {item.kind === 'interview' && item.topic && (
                          <p className="test-description">Topic: {item.topic}</p>
                        )}
                        {assignment && (
                          <div className="assignment-date">
                            Assigned: {new Date(assignment.assignedAt).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => handleRemove(item)}
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
                <p>{testTypeFilter === 'all' ? 'No tests assigned yet.' : `No ${testTypeFilter} tests assigned.`}</p>
              </div>
            )}
          </div>

          <div className="section-card">
            <div className="section-header">
              <h2>Available Tests ({filteredAvailable.length})</h2>
            </div>

            {filteredAvailable.length > 0 ? (
              <div className="tests-list">
                {filteredAvailable.map(item => (
                  <div key={item._id} className="test-item">
                    <div className="test-info">
                      <h4>{item.title}</h4>
                      <div className="test-meta">
                        <span className={`test-type-badge ${item.type}`}>{item.type}</span>
                        <span className="test-duration">{item.duration} min</span>
                      </div>
                      {(item.description || (item.kind === 'interview' && item.topic)) && (
                        <p className="test-description">
                          {item.kind === 'interview' && item.topic ? `Topic: ${item.topic}` : (item.description || '').substring(0, 80) + (item.description?.length > 80 ? '...' : '')}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => handleAssign(item)}
                      className="btn btn-primary btn-sm"
                      disabled={assigningId === item._id || !classroom.students?.length}
                      title={!classroom.students?.length ? 'Add students first' : 'Assign to classroom'}
                    >
                      {assigningId === item._id ? 'Assigning...' : 'Assign'}
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state-small">
                <p>
                  {testTypeFilter === 'all'
                    ? 'All tests are already assigned.'
                    : `No available ${testTypeFilter} tests, or all are assigned.`}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AssignTestToClassroom;
