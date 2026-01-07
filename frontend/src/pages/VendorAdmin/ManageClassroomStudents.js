import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axiosInstance from '../../utils/axios';
import Modal from '../../components/Modal';
import './VendorAdminCommon.css';
import './ManageClassroomStudents.css';

const ManageClassroomStudents = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [classroom, setClassroom] = useState(null);
  const [allStudents, setAllStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState({ isOpen: false, title: '', message: '', type: 'info' });
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [removingId, setRemovingId] = useState(null);
  const [showBulkForm, setShowBulkForm] = useState(false);
  const [bulkData, setBulkData] = useState('');

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
      const [classroomRes, studentsRes] = await Promise.all([
        axiosInstance.get(`/vendor-admin/classrooms/${id}`),
        axiosInstance.get('/vendor-admin/students')
      ]);

      setClassroom(classroomRes.data);
      setAllStudents(studentsRes.data);
    } catch (error) {
      console.error('❌ Error fetching data:', error);
      showModal('Error', error.response?.data?.message || 'Failed to load data.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleStudentToggle = (studentId) => {
    setSelectedStudents(prev => 
      prev.includes(studentId)
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    );
  };

  const handleAddStudents = async () => {
    if (selectedStudents.length === 0) {
      showModal('Warning', 'Please select at least one student to add', 'warning');
      return;
    }

    try {
      setLoading(true);
      await axiosInstance.post(`/vendor-admin/classrooms/${id}/students`, {
        studentIds: selectedStudents
      });
      showModal('Success', `${selectedStudents.length} student(s) added successfully!`, 'success');
      setSelectedStudents([]);
      fetchData();
    } catch (error) {
      console.error('❌ Error adding students:', error);
      showModal('Error', error.response?.data?.message || 'Failed to add students.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveStudent = async (studentId) => {
    try {
      setRemovingId(studentId);
      await axiosInstance.delete(`/vendor-admin/classrooms/${id}/students/${studentId}`);
      showModal('Success', 'Student removed successfully!', 'success');
      fetchData();
    } catch (error) {
      console.error('❌ Error removing student:', error);
      showModal('Error', error.response?.data?.message || 'Failed to remove student.', 'error');
    } finally {
      setRemovingId(null);
    }
  };

  const handleBulkAdd = async () => {
    if (!bulkData.trim()) {
      showModal('Warning', 'Please enter student data', 'warning');
      return;
    }

    try {
      setLoading(true);
      const lines = bulkData.split('\n').filter(line => line.trim());
      const students = lines.map(line => {
        const parts = line.split(',').map(s => s.trim());
        if (parts.length >= 2) {
          return {
            name: parts[0],
            email: parts[1],
            password: parts[2] || 'student123'
          };
        }
        return null;
      }).filter(s => s !== null);

      if (students.length === 0) {
        showModal('Error', 'Invalid format. Use: Name,Email,Password (one per line)', 'error');
        setLoading(false);
        return;
      }

      const response = await axiosInstance.post(`/vendor-admin/classrooms/${id}/students/bulk`, {
        students
      });

      const message = `Added: ${response.data.added.length}\n` +
        (response.data.created.length > 0 ? `Created: ${response.data.created.length}\n` : '') +
        (response.data.skipped.length > 0 ? `Skipped: ${response.data.skipped.length}` : '');
      
      showModal('Success', message, 'success');
      setBulkData('');
      setShowBulkForm(false);
      fetchData();
    } catch (error) {
      console.error('❌ Error bulk adding students:', error);
      showModal('Error', error.response?.data?.message || 'Failed to add students.', 'error');
    } finally {
      setLoading(false);
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

  const classroomStudentIds = classroom.students?.map(s => s._id || s.toString()) || [];
  const availableStudents = allStudents.filter(s => !classroomStudentIds.includes(s._id.toString()));

  return (
    <div className="container manage-classroom-students">
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
          <h1 className="page-title">{classroom.name}</h1>
          {classroom.description && (
            <p className="page-subtitle">{classroom.description}</p>
          )}
        </div>
        <Link to="/vendor-admin/classrooms" className="btn btn-secondary">
          Back to Classrooms
        </Link>
      </div>

      <div className="content-grid">
        {/* Current Students Section */}
        <div className="section-card">
          <div className="section-header">
            <h2>Current Students ({classroom.students?.length || 0})</h2>
          </div>

          {classroom.students && classroom.students.length > 0 ? (
            <div className="students-list">
              {classroom.students.map(student => (
                <div key={student._id || student} className="student-item">
                  <div className="student-info">
                    <span className="student-name">{student.name || 'Loading...'}</span>
                    <span className="student-email">{student.email || ''}</span>
                  </div>
                  <button
                    onClick={() => handleRemoveStudent(student._id || student)}
                    className="btn-icon btn-danger"
                    disabled={removingId === (student._id || student)}
                    title="Remove from classroom"
                  >
                    {removingId === (student._id || student) ? '⏳' : '×'}
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state-small">
              <p>No students in this classroom yet.</p>
            </div>
          )}
        </div>

        {/* Add Students Section */}
        <div className="section-card">
          <div className="section-header">
            <h2>Add Students</h2>
            <div className="btn-group">
              <button
                onClick={() => setShowBulkForm(!showBulkForm)}
                className="btn btn-secondary btn-sm"
              >
                {showBulkForm ? 'Cancel Bulk' : 'Bulk Import'}
              </button>
            </div>
          </div>

          {showBulkForm ? (
            <div style={{ marginTop: '20px' }}>
              <div className="form-group">
                <label>Bulk Import Students</label>
                <textarea
                  className="form-textarea"
                  value={bulkData}
                  onChange={(e) => setBulkData(e.target.value)}
                  placeholder="Format: Name,Email,Password (one per line)&#10;John Doe,john@example.com,password123&#10;Jane Smith,jane@example.com"
                  rows="8"
                />
                <small style={{ color: 'var(--text-secondary)', fontSize: '0.9em', display: 'block', marginTop: '8px' }}>
                  Format: Name,Email,Password (one per line). Password is optional (default: student123)
                </small>
              </div>
              <div className="form-actions">
                <button
                  onClick={handleBulkAdd}
                  className="btn btn-primary"
                  disabled={loading || !bulkData.trim()}
                >
                  {loading ? 'Adding...' : 'Add Students'}
                </button>
              </div>
            </div>
          ) : (
            <>
              {selectedStudents.length > 0 && (
                <div style={{ marginBottom: '15px', padding: '10px', background: 'var(--bg-primary)', borderRadius: '8px' }}>
                  <span className="selected-count">{selectedStudents.length} selected</span>
                </div>
              )}

              {availableStudents.length > 0 ? (
                <>
                  <div className="students-list">
                    {availableStudents.map(student => (
                      <label key={student._id} className="student-item checkbox-item">
                        <input
                          type="checkbox"
                          checked={selectedStudents.includes(student._id)}
                          onChange={() => handleStudentToggle(student._id)}
                        />
                        <div className="student-info">
                          <span className="student-name">{student.name}</span>
                          <span className="student-email">{student.email}</span>
                        </div>
                      </label>
                    ))}
                  </div>
                  <div className="section-actions">
                    <button
                      onClick={handleAddStudents}
                      className="btn btn-primary"
                      disabled={selectedStudents.length === 0 || loading}
                    >
                      {loading ? 'Adding...' : `Add ${selectedStudents.length || ''} Student(s)`}
                    </button>
                  </div>
                </>
              ) : (
                <div className="empty-state-small">
                  <p>All students are already in this classroom.</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ManageClassroomStudents;

