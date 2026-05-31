import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  FiPlus,
  FiUsers,
  FiFileText,
  FiEdit2,
  FiTrash2,
  FiGrid,
} from 'react-icons/fi';
import axiosInstance from '../../utils/axios';
import Modal from '../../components/Modal';
import VendorHubPage from '../../components/VendorAdmin/VendorHubPage';

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
      const response = await axiosInstance.get('/vendor-admin/classrooms');
      setClassrooms(response.data || []);
    } catch (error) {
      console.error('Error fetching classrooms:', error);
      showModal('Error', error.response?.data?.message || 'Failed to load classrooms.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (classroomId, classroomName) => {
    if (
      !window.confirm(
        `Delete "${classroomName}"? Students will be unlinked from this classroom. This cannot be undone.`
      )
    ) {
      return;
    }

    try {
      setDeletingId(classroomId);
      await axiosInstance.delete(`/vendor-admin/classrooms/${classroomId}`);
      showModal('Deleted', 'Classroom removed successfully.', 'success');
      fetchClassrooms();
    } catch (error) {
      console.error('Error deleting classroom:', error);
      showModal('Error', error.response?.data?.message || 'Failed to delete classroom.', 'error');
    } finally {
      setDeletingId(null);
    }
  };

  const totalStudents = classrooms.reduce((s, c) => s + (c.students?.length || 0), 0);
  const totalAssigned = classrooms.reduce(
    (s, c) => s + (c.assignedTests?.length || 0) + (c.assignedInterviews?.length || 0),
    0
  );

  return (
    <VendorHubPage
      className="vh-classrooms-page"
      loading={loading}
      eyebrow="Organization"
      title="Classrooms"
      subtitle="Group students into batches, manage rosters, and assign tests or interviews per classroom."
      accent="#0891b2"
      actions={
        <Link to="/vendor-admin/classrooms/create" className="vh-btn vh-btn--primary">
          <FiPlus /> Create classroom
        </Link>
      }
    >
      <Modal isOpen={modal.isOpen} onClose={closeModal} title={modal.title} type={modal.type}>
        <p>{modal.message}</p>
      </Modal>

      <div className="vh-stats">
        <div className="vh-stat vh-stat--accent">
          <span className="vh-stat-label">Classrooms</span>
          <span className="vh-stat-value">{classrooms.length}</span>
        </div>
        <div className="vh-stat">
          <span className="vh-stat-label">Students enrolled</span>
          <span className="vh-stat-value">{totalStudents}</span>
        </div>
        <div className="vh-stat">
          <span className="vh-stat-label">Test assignments</span>
          <span className="vh-stat-value">{totalAssigned}</span>
        </div>
      </div>

      {classrooms.length === 0 ? (
        <div className="vh-panel">
          <div className="vh-empty">
            <div className="vh-empty-icon"><FiGrid /></div>
            <h2>No classrooms yet</h2>
            <p>Create a classroom to organize students and assign assessments in bulk.</p>
            <Link to="/vendor-admin/classrooms/create" className="vh-btn vh-btn--primary">
              <FiPlus /> Create your first classroom
            </Link>
          </div>
        </div>
      ) : (
        <div className="vh-classroom-grid">
          {classrooms.map((classroom) => {
            const studentCount = classroom.students?.length || 0;
            const assignCount =
              (classroom.assignedTests?.length || 0) +
              (classroom.assignedInterviews?.length || 0);

            return (
              <article key={classroom._id} className="vh-classroom-card">
                <div className="vh-classroom-card-accent" />
                <div className="vh-classroom-card-body">
                  <div className="vh-classroom-card-top">
                    <div>
                      <h3>{classroom.name}</h3>
                      {classroom.description ? (
                        <p className="vh-cell-muted" style={{ margin: 0, lineHeight: 1.5 }}>
                          {classroom.description}
                        </p>
                      ) : (
                        <p className="vh-cell-muted" style={{ margin: 0 }}>No description</p>
                      )}
                    </div>
                    <div className="vh-classroom-card-actions">
                      <Link
                        to={`/vendor-admin/classrooms/${classroom._id}/edit`}
                        className="vh-btn vh-btn--icon vh-btn--ghost"
                        title="Edit"
                      >
                        <FiEdit2 />
                      </Link>
                      <button
                        type="button"
                        className="vh-btn vh-btn--icon vh-btn--danger"
                        title="Delete"
                        disabled={deletingId === classroom._id}
                        onClick={() => handleDelete(classroom._id, classroom.name)}
                      >
                        <FiTrash2 />
                      </button>
                    </div>
                  </div>

                  <div className="vh-classroom-meta">
                    <span className="vh-classroom-meta-item">
                      <FiUsers /> <strong>{studentCount}</strong> students
                    </span>
                    <span className="vh-classroom-meta-item">
                      <FiFileText /> <strong>{assignCount}</strong> assigned
                    </span>
                  </div>

                  <div className="vh-classroom-card-foot">
                    <Link
                      to={`/vendor-admin/classrooms/${classroom._id}/students`}
                      className="vh-btn vh-btn--secondary vh-btn--sm"
                    >
                      <FiUsers /> Manage students
                    </Link>
                    <Link
                      to={`/vendor-admin/classrooms/${classroom._id}/tests`}
                      className="vh-btn vh-btn--primary vh-btn--sm"
                    >
                      Assign tests
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </VendorHubPage>
  );
};

export default ClassroomList;
