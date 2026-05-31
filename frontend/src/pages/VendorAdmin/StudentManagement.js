import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  FiPlus,
  FiSearch,
  FiUsers,
  FiUpload,
  FiRefreshCw,
  FiBarChart2,
  FiX,
} from 'react-icons/fi';
import axiosInstance from '../../utils/axios';
import VendorHubPage from '../../components/VendorAdmin/VendorHubPage';

const getInitials = (name) => {
  if (!name) return '?';
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
};

const StudentManagement = () => {
  const [allStudents, setAllStudents] = useState([]);
  const [classrooms, setClassrooms] = useState([]);
  const [selectedClassroom, setSelectedClassroom] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showBulkForm, setShowBulkForm] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [bulkData, setBulkData] = useState('');
  const [formData, setFormData] = useState({ name: '', email: '', password: 'student123' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchStudents = async () => {
    try {
      setLoading(true);
      const [studentsRes, classroomsRes] = await Promise.all([
        axiosInstance.get('/vendor-admin/students'),
        axiosInstance.get('/vendor-admin/classrooms'),
      ]);
      setAllStudents(studentsRes.data || []);
      setClassrooms(classroomsRes.data || []);
    } catch (err) {
      console.error('Error fetching students:', err);
      setError('Failed to load students. Please refresh.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, []);

  const classroomFiltered = useMemo(() => {
    if (selectedClassroom === 'all') return allStudents;
    return allStudents.filter((student) =>
      (student.classrooms || []).some((c) => {
        const classroomId = c.id || c._id || c;
        return String(classroomId) === String(selectedClassroom);
      })
    );
  }, [allStudents, selectedClassroom]);

  const students = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return classroomFiltered;
    return classroomFiltered.filter(
      (s) =>
        s.name?.toLowerCase().includes(q) ||
        s.email?.toLowerCase().includes(q)
    );
  }, [classroomFiltered, search]);

  const stats = useMemo(() => {
    const active = allStudents.filter((s) => s.isActive !== false).length;
    const withClass = allStudents.filter((s) => (s.classrooms || []).length > 0).length;
    return { total: allStudents.length, active, withClass };
  }, [allStudents]);

  const handleAddStudent = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSubmitting(true);

    try {
      const trimmedData = {
        name: formData.name.trim(),
        email: formData.email.trim(),
        password: formData.password.trim() || 'student123',
      };

      if (!trimmedData.name || !trimmedData.email) {
        setError('Name and email are required');
        setSubmitting(false);
        return;
      }

      const response = await axiosInstance.post('/vendor-admin/students/enroll', {
        students: [trimmedData],
      });

      if (response.data.enrolled?.length > 0) {
        setSuccess(`Student "${trimmedData.name}" enrolled successfully.`);
        setFormData({ name: '', email: '', password: 'student123' });
        await fetchStudents();
        setTimeout(() => {
          setShowAddForm(false);
          setSuccess('');
        }, 2000);
      } else if (response.data.skipped?.length > 0) {
        setError('A student with this email already exists.');
      } else {
        setError('Failed to enroll student. Please try again.');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Error enrolling student');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBulkEnroll = async () => {
    setError('');
    setSuccess('');
    try {
      const lines = bulkData.split('\n').filter((line) => line.trim());
      const payload = lines.map((line) => {
        const [name, email, password] = line.split(',').map((s) => s.trim());
        return { name, email, password: password || 'student123' };
      });

      const response = await axiosInstance.post('/vendor-admin/students/enroll', {
        students: payload,
      });
      const n = response.data.enrolled?.length || payload.length;
      setSuccess(`${n} student(s) enrolled.`);
      setShowBulkForm(false);
      setBulkData('');
      await fetchStudents();
    } catch (err) {
      setError(err.response?.data?.message || 'Error enrolling students');
    }
  };

  const classroomCount = (classroomId) =>
    allStudents.filter((s) =>
      (s.classrooms || []).some((c) => String(c.id || c._id || c) === String(classroomId))
    ).length;

  return (
    <VendorHubPage
      className="vh-students-page"
      loading={loading}
      eyebrow="Roster"
      title="Students"
      subtitle="Enroll learners, filter by classroom, and open performance analysis for each student."
      accent="#059669"
      actions={
        <>
          <button
            type="button"
            className="vh-btn vh-btn--ghost"
            onClick={() => fetchStudents()}
          >
            <FiRefreshCw /> Refresh
          </button>
          <button
            type="button"
            className="vh-btn vh-btn--secondary"
            onClick={() => {
              setShowBulkForm((v) => !v);
              setShowAddForm(false);
            }}
          >
            <FiUpload /> {showBulkForm ? 'Cancel bulk' : 'Bulk enroll'}
          </button>
          <button
            type="button"
            className="vh-btn vh-btn--primary"
            onClick={() => {
              setShowAddForm((v) => !v);
              setShowBulkForm(false);
            }}
          >
            <FiPlus /> {showAddForm ? 'Cancel' : 'Add student'}
          </button>
        </>
      }
    >
      <div className="vh-stats">
        <div className="vh-stat vh-stat--accent">
          <span className="vh-stat-label">Total students</span>
          <span className="vh-stat-value">{stats.total}</span>
        </div>
        <div className="vh-stat">
          <span className="vh-stat-label">Active</span>
          <span className="vh-stat-value">{stats.active}</span>
        </div>
        <div className="vh-stat">
          <span className="vh-stat-label">In a classroom</span>
          <span className="vh-stat-value">{stats.withClass}</span>
        </div>
        <div className="vh-stat">
          <span className="vh-stat-label">Listed below</span>
          <span className="vh-stat-value">{students.length}</span>
        </div>
      </div>

      {(showAddForm || showBulkForm) && (
        <div className="vh-panel vh-form-panel">
          <div className="vh-panel-head">
            <h2 className="vh-panel-title">
              {showBulkForm ? 'Bulk enroll students' : 'Add new student'}
            </h2>
            <button
              type="button"
              className="vh-btn vh-btn--icon vh-btn--ghost"
              onClick={() => {
                setShowAddForm(false);
                setShowBulkForm(false);
              }}
              aria-label="Close form"
            >
              <FiX />
            </button>
          </div>
          <div className="vh-panel-body">
            {error && <div className="vh-alert vh-alert--error">{error}</div>}
            {success && <div className="vh-alert vh-alert--success">{success}</div>}

            {showAddForm && (
              <form className="vh-form-grid" onSubmit={handleAddStudent}>
                <div className="vh-field">
                  <label htmlFor="student-name">Full name *</label>
                  <input
                    id="student-name"
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    placeholder="Student name"
                  />
                </div>
                <div className="vh-field">
                  <label htmlFor="student-email">Email *</label>
                  <input
                    id="student-email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                    placeholder="student@example.com"
                  />
                </div>
                <div className="vh-field">
                  <label htmlFor="student-password">Password</label>
                  <input
                    id="student-password"
                    type="text"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="Default: student123"
                  />
                  <span className="vh-field-hint">Leave blank to use the default password.</span>
                </div>
                <div className="vh-form-actions">
                  <button type="submit" className="vh-btn vh-btn--primary" disabled={submitting}>
                    {submitting ? 'Adding…' : 'Add student'}
                  </button>
                </div>
              </form>
            )}

            {showBulkForm && (
              <>
                <p className="vh-panel-desc" style={{ marginTop: 0 }}>
                  One student per line: <strong>Name,Email,Password</strong> (password optional)
                </p>
                <div className="vh-field">
                  <textarea
                    rows={8}
                    value={bulkData}
                    onChange={(e) => setBulkData(e.target.value)}
                    placeholder={'John Doe,john@example.com\nJane Smith,jane@example.com'}
                  />
                </div>
                <div className="vh-form-actions">
                  <button
                    type="button"
                    className="vh-btn vh-btn--primary"
                    onClick={handleBulkEnroll}
                    disabled={!bulkData.trim()}
                  >
                    Enroll students
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <div className="vh-toolbar">
        <div className="vh-search">
          <FiSearch />
          <input
            type="search"
            placeholder="Search by name or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="vh-select-wrap">
          <select
            value={selectedClassroom}
            onChange={(e) => setSelectedClassroom(e.target.value)}
          >
            <option value="all">All classrooms ({allStudents.length})</option>
            {classrooms.map((c) => (
              <option key={c._id} value={String(c._id)}>
                {c.name} ({classroomCount(c._id)})
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="vh-panel">
        <div className="vh-panel-head">
          <h2 className="vh-panel-title">Student roster</h2>
        </div>
        <div className="vh-panel-body vh-panel-body--flush">
          {students.length === 0 ? (
            <div className="vh-empty">
              <div className="vh-empty-icon"><FiUsers /></div>
              <h2>
                {selectedClassroom === 'all' && !search
                  ? 'No students yet'
                  : 'No matches'}
              </h2>
              <p>
                {search
                  ? 'Try another search or clear filters.'
                  : selectedClassroom === 'all'
                    ? 'Add your first student to start assigning tests.'
                    : 'No students in this classroom yet.'}
              </p>
              {!search && selectedClassroom === 'all' && (
                <button
                  type="button"
                  className="vh-btn vh-btn--primary"
                  onClick={() => setShowAddForm(true)}
                >
                  <FiPlus /> Add student
                </button>
              )}
            </div>
          ) : (
            <div className="vh-table-wrap">
              <table className="vh-table">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Classrooms</th>
                    <th>Tests</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((student) => (
                    <tr key={student._id}>
                      <td>
                        <div className="vh-person">
                          <span className="vh-avatar" style={{ background: '#059669' }}>
                            {getInitials(student.name)}
                          </span>
                          <div>
                            <div className="vh-person-name">{student.name}</div>
                            <div className="vh-person-email">{student.email}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        {(student.classrooms || []).length > 0 ? (
                          <div className="vh-tag-list">
                            {student.classrooms.map((c, idx) => (
                              <span key={idx} className="vh-tag">
                                {c.name}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="vh-cell-muted">Unassigned</span>
                        )}
                      </td>
                      <td>
                        <strong>{student.enrolledTests?.length || 0}</strong>
                      </td>
                      <td>
                        <span
                          className={`vh-badge ${
                            student.isActive !== false ? 'vh-badge--active' : 'vh-badge--inactive'
                          }`}
                        >
                          {student.isActive !== false ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="vh-cell-actions">
                        <Link
                          to={`/vendor-admin/students/${student._id}/analysis`}
                          className="vh-btn vh-btn--secondary vh-btn--sm"
                        >
                          <FiBarChart2 /> Analysis
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
    </VendorHubPage>
  );
};

export default StudentManagement;
