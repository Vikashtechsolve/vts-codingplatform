import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axiosInstance from '../../utils/axios';
import './VendorAdminCommon.css';
import './StudentManagement.css';

const StudentManagement = () => {
  const [students, setStudents] = useState([]);
  const [allStudents, setAllStudents] = useState([]);
  const [classrooms, setClassrooms] = useState([]);
  const [selectedClassroom, setSelectedClassroom] = useState('all');
  const [loading, setLoading] = useState(true);
  const [showBulkForm, setShowBulkForm] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [bulkData, setBulkData] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: 'student123'
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchStudents();
  }, []);

  const fetchStudents = async () => {
    try {
      setLoading(true);
      console.log('📥 Fetching students...');
      const [studentsRes, classroomsRes] = await Promise.all([
        axiosInstance.get('/vendor-admin/students'),
        axiosInstance.get('/vendor-admin/classrooms')
      ]);
      console.log('✅ Students fetched:', studentsRes.data?.length || 0);
      const fetchedStudents = studentsRes.data || [];
      setAllStudents(fetchedStudents);
      setClassrooms(classroomsRes.data || []);
      
      // Apply current filter
      if (selectedClassroom === 'all') {
        setStudents(fetchedStudents);
      } else {
        const filtered = fetchedStudents.filter(student => {
          if (!student.classrooms || student.classrooms.length === 0) {
            return false;
          }
          return student.classrooms.some(c => {
            const classroomId = c.id || c._id || c;
            return String(classroomId) === String(selectedClassroom);
          });
        });
        setStudents(filtered);
      }
    } catch (error) {
      console.error('❌ Error fetching students:', error);
      setError('Failed to load students. Please refresh the page.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedClassroom === 'all') {
      setStudents(allStudents);
    } else {
      const filtered = allStudents.filter(student => {
        if (!student.classrooms || student.classrooms.length === 0) {
          return false;
        }
        return student.classrooms.some(c => {
          const classroomId = c.id || c._id || c;
          return String(classroomId) === String(selectedClassroom);
        });
      });
      console.log('🔍 Filtering students:', {
        selectedClassroom,
        totalStudents: allStudents.length,
        filteredCount: filtered.length,
        sampleStudent: allStudents[0]?.classrooms
      });
      setStudents(filtered);
    }
  }, [selectedClassroom, allStudents]);

  const handleAddStudent = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSubmitting(true);

    try {
      const trimmedData = {
        name: formData.name.trim(),
        email: formData.email.trim(),
        password: formData.password.trim() || 'student123'
      };

      if (!trimmedData.name || !trimmedData.email) {
        setError('Name and email are required');
        setSubmitting(false);
        return;
      }

      console.log('📤 Adding student:', trimmedData);
      const response = await axiosInstance.post('/vendor-admin/students/enroll', {
        students: [trimmedData]
      });
      
      console.log('✅ Student added response:', response.data);
      
      if (response.data.enrolled && response.data.enrolled.length > 0) {
        setSuccess(`Student "${trimmedData.name}" enrolled successfully!`);
        setFormData({ name: '', email: '', password: 'student123' });
        
        // Immediately refresh the list
        await fetchStudents();
        
        // Close form after a short delay
        setTimeout(() => {
          setShowAddForm(false);
          setSuccess('');
        }, 2000);
      } else if (response.data.skipped && response.data.skipped.length > 0) {
        setError('Student with this email already exists');
      } else {
        setError('Failed to enroll student. Please try again.');
      }
    } catch (error) {
      console.error('❌ Error adding student:', error);
      const errorMsg = error.response?.data?.message || 
                       error.response?.data?.error ||
                       'Error enrolling student';
      setError(errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleBulkEnroll = async () => {
    try {
      const lines = bulkData.split('\n').filter(line => line.trim());
      const students = lines.map(line => {
        const [name, email, password] = line.split(',').map(s => s.trim());
        return { name, email, password: password || 'student123' };
      });

      await axiosInstance.post('/vendor-admin/students/enroll', { students });
      setShowBulkForm(false);
      setBulkData('');
      fetchStudents();
      alert('Students enrolled successfully!');
    } catch (error) {
      alert(error.response?.data?.message || 'Error enrolling students');
    }
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="container">
      <div className="page-header">
        <h1 className="page-title">Student Management</h1>
        <div className="btn-group">
          <button onClick={() => setShowAddForm(!showAddForm)} className="btn btn-primary">
            {showAddForm ? 'Cancel' : 'Add Student'}
          </button>
          <button onClick={() => setShowBulkForm(!showBulkForm)} className="btn btn-secondary">
            {showBulkForm ? 'Cancel' : 'Bulk Enroll'}
          </button>
        </div>
      </div>

      {/* Classroom Filter */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <div className="form-group">
          <label>Filter by Classroom</label>
          <select
            className="form-select"
            value={selectedClassroom}
            onChange={(e) => setSelectedClassroom(e.target.value)}
          >
            <option value="all">All Students ({allStudents.length})</option>
            {classrooms.map(classroom => {
              const count = allStudents.filter(s => {
                if (!s.classrooms || s.classrooms.length === 0) return false;
                return s.classrooms.some(c => {
                  const classroomId = c.id || c._id || c;
                  return String(classroomId) === String(classroom._id);
                });
              }).length;
              return (
                <option key={classroom._id} value={String(classroom._id)}>
                  {classroom.name} ({count})
                </option>
              );
            })}
          </select>
        </div>
      </div>

      {showAddForm && (
        <div className="form-card-modern">
          <h2>Add New Student</h2>
          {error && (
            <div className="error-message" style={{ whiteSpace: 'pre-line' }}>
              {error}
            </div>
          )}
          {success && (
            <div className="success-message" style={{ whiteSpace: 'pre-line' }}>
              {success}
            </div>
          )}
          <form onSubmit={handleAddStudent}>
            <div className="form-group">
              <label>Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                placeholder="Student name"
              />
            </div>
            <div className="form-group">
              <label>Email *</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
                placeholder="student@example.com"
              />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input
                type="text"
                className="form-input"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="Default: student123"
              />
              <small style={{ color: 'var(--text-secondary)', fontSize: '0.9em' }}>Leave empty or use default: student123</small>
            </div>
            <div className="form-actions">
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? 'Adding...' : 'Add Student'}
              </button>
            </div>
          </form>
        </div>
      )}

      {showBulkForm && (
        <div className="form-card-modern">
          <h2>Bulk Enroll Students</h2>
          <p>Format: Name,Email,Password (one per line)</p>
          <textarea
            value={bulkData}
            onChange={(e) => setBulkData(e.target.value)}
            placeholder="John Doe,john@example.com,password123&#10;Jane Smith,jane@example.com,password456"
            style={{ minHeight: '200px', marginBottom: '20px' }}
          />
          <button onClick={handleBulkEnroll} className="btn btn-primary">
            Enroll Students
          </button>
        </div>
      )}

      <div className="students-table-card">
        <div className="card-header">
          <h2>All Students</h2>
          <button onClick={fetchStudents} className="btn btn-secondary btn-sm">
            🔄 Refresh
          </button>
        </div>
        {students.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">👥</div>
            <h2>
              {selectedClassroom === 'all' 
                ? 'No Students Enrolled Yet' 
                : 'No Students in This Classroom'}
            </h2>
            <p>
              {selectedClassroom === 'all'
                ? 'Click "Add Student" to enroll your first student.'
                : 'This classroom has no students assigned yet.'}
            </p>
            {selectedClassroom === 'all' && (
              <button onClick={() => setShowAddForm(true)} className="btn btn-primary">
                Add Student
              </button>
            )}
          </div>
        ) : (
          <div className="table-container">
            <table className="student-table-modern">
              <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Classrooms</th>
                <th>Enrolled Tests</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
              </thead>
              <tbody>
                {students.map(student => (
                  <tr key={student._id}>
                    <td><strong>{student.name}</strong></td>
                    <td>{student.email}</td>
                    <td>
                      {student.classrooms && student.classrooms.length > 0 ? (
                        <div className="classroom-badges">
                          {student.classrooms.map((classroom, idx) => (
                            <span key={idx} className="classroom-badge-item">
                              {classroom.name}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-secondary)' }}>No classroom</span>
                      )}
                    </td>
                    <td><strong>{student.enrolledTests?.length || 0}</strong></td>
                    <td>
                      <span className={`status-badge ${student.isActive ? 'active' : 'inactive'}`}>
                        {student.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <Link 
                        to={`/vendor-admin/students/${student._id}/analysis`}
                        className="btn btn-sm btn-primary"
                      >
                        View Analysis
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentManagement;

