import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axiosInstance from '../../utils/axios';
import Modal from '../../components/Modal';
import './VendorAdminCommon.css';
import './ClassroomList.css';

const ClassroomList = () => {
  const [classrooms, setClassrooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState({ isOpen: false, title: '', message: '', type: 'info' });
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    fetchClassrooms();
  }, []);

  const showModal = (title, message, type = 'info') => {
    setModal({ isOpen: true, title, message, type });
  };

  const closeModal = () => {
    setModal({ isOpen: false, title: '', message: '', type: 'info' });
  };

  const fetchClassrooms = async () => {
    try {
      setLoading(true);
      console.log('📥 Fetching classrooms...');
      const response = await axiosInstance.get('/vendor-admin/classrooms');
      console.log('✅ Classrooms fetched:', response.data.length);
      setClassrooms(response.data);
    } catch (error) {
      console.error('❌ Error fetching classrooms:', error);
      showModal('Error', error.response?.data?.message || 'Failed to load classrooms.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (classroomId, classroomName) => {
    if (!window.confirm(`Are you sure you want to delete "${classroomName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      setDeletingId(classroomId);
      await axiosInstance.delete(`/vendor-admin/classrooms/${classroomId}`);
      showModal('Success', 'Classroom deleted successfully!', 'success');
      fetchClassrooms();
    } catch (error) {
      console.error('❌ Error deleting classroom:', error);
      showModal('Error', error.response?.data?.message || 'Failed to delete classroom.', 'error');
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return <div className="loading">Loading classrooms...</div>;
  }

  return (
    <div className="container classroom-list">
      <Modal 
        isOpen={modal.isOpen} 
        onClose={closeModal}
        title={modal.title}
        type={modal.type}
      >
        <p>{modal.message}</p>
      </Modal>

      <div className="page-header">
        <h1 className="page-title">Classrooms</h1>
        <Link to="/vendor-admin/classrooms/create" className="btn btn-primary">
          + Create Classroom
        </Link>
      </div>

      {classrooms.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📚</div>
          <h2>No Classrooms Yet</h2>
          <p>Create your first classroom to organize students and assign tests efficiently.</p>
          <Link to="/vendor-admin/classrooms/create" className="btn btn-primary">
            Create Your First Classroom
          </Link>
        </div>
      ) : (
        <div className="classrooms-grid">
          {classrooms.map(classroom => (
            <div key={classroom._id} className="classroom-card">
              <div className="classroom-card-header">
                <div className="classroom-title-section">
                  <h3>{classroom.name}</h3>
                  {classroom.description && (
                    <p className="classroom-description">{classroom.description}</p>
                  )}
                </div>
                <div className="classroom-actions">
                  <Link 
                    to={`/vendor-admin/classrooms/${classroom._id}/edit`}
                    className="btn-icon btn-edit"
                    title="Edit Classroom"
                  >
                    ✏️
                  </Link>
                  <button
                    onClick={() => handleDelete(classroom._id, classroom.name)}
                    className="btn-icon btn-delete"
                    disabled={deletingId === classroom._id}
                    title="Delete Classroom"
                  >
                    {deletingId === classroom._id ? '⏳' : '🗑️'}
                  </button>
                </div>
              </div>

              <div className="classroom-stats">
                <div className="stat-item">
                  <span className="stat-icon">👥</span>
                  <span className="stat-label">Students:</span>
                  <span className="stat-value">{classroom.students?.length || 0}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-icon">📝</span>
                  <span className="stat-label">Tests:</span>
                  <span className="stat-value">{classroom.assignedTests?.length || 0}</span>
                </div>
              </div>

              <div className="classroom-card-footer">
                <Link 
                  to={`/vendor-admin/classrooms/${classroom._id}/students`}
                  className="btn btn-secondary btn-sm"
                >
                  Manage Students
                </Link>
                <Link 
                  to={`/vendor-admin/classrooms/${classroom._id}/tests`}
                  className="btn btn-primary btn-sm"
                >
                  Assign Tests
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ClassroomList;

