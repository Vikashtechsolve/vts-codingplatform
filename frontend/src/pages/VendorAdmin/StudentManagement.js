import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  FiPlus,
  FiSearch,
  FiUsers,
  FiUpload,
  FiRefreshCw,
  FiBarChart2,
  FiEdit2,
  FiUser,
  FiLock,
  FiX,
} from 'react-icons/fi';
import axiosInstance from '../../utils/axios';
import VendorHubPage from '../../components/VendorAdmin/VendorHubPage';
import {
  parseBulkStudentText,
  matchesStudentSearch,
  BULK_STUDENT_FORMAT_HINT,
  BULK_STUDENT_SAMPLE,
} from '../../utils/studentBulkImport';
import './StudentManagement.css';

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
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    enrollmentNumber: '',
    password: 'student123',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editingStudent, setEditingStudent] = useState(null);
  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
    enrollmentNumber: '',
    password: '',
    isActive: true,
  });
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState('');

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

  useEffect(() => {
    if (!editingStudent) return undefined;

    const onKeyDown = (e) => {
      if (e.key === 'Escape' && !editSubmitting) {
        closeEditStudent();
      }
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [editingStudent, editSubmitting]);

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
    return classroomFiltered.filter((s) => matchesStudentSearch(s, q));
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
        enrollmentNumber: formData.enrollmentNumber.trim(),
        password: formData.password.trim() || 'student123',
      };

      if (!trimmedData.name || !trimmedData.email) {
        setError('Name and email are required');
        setSubmitting(false);
        return;
      }

      const response = await axiosInstance.post('/vendor-admin/students/enroll', {
        students: [
          {
            ...trimmedData,
            enrollmentNumber: trimmedData.enrollmentNumber || undefined,
          },
        ],
      });

      if (response.data.enrolled?.length > 0) {
        setSuccess(`Student "${trimmedData.name}" enrolled successfully.`);
        setFormData({ name: '', email: '', enrollmentNumber: '', password: 'student123' });
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
      const { students: payload, invalidLines } = parseBulkStudentText(bulkData);
      if (!payload.length) {
        setError(
          invalidLines.length
            ? `No valid rows. ${invalidLines[0].error} (line ${invalidLines[0].line})`
            : 'Paste at least one student row.'
        );
        return;
      }

      const response = await axiosInstance.post('/vendor-admin/students/enroll', {
        students: payload,
      });
      const n = response.data.enrolled?.length || 0;
      const skipped = response.data.skipped?.length || 0;
      setSuccess(
        `${n} student(s) enrolled${skipped ? ` · ${skipped} skipped` : ''}.`
      );
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

  const openEditStudent = (student) => {
    setEditingStudent(student);
    setEditForm({
      name: student.name || '',
      email: student.email || '',
      enrollmentNumber: student.enrollmentNumber || '',
      password: '',
      isActive: student.isActive !== false,
    });
    setEditError('');
    setShowAddForm(false);
    setShowBulkForm(false);
  };

  const closeEditStudent = () => {
    setEditingStudent(null);
    setEditError('');
    setEditForm({
      name: '',
      email: '',
      enrollmentNumber: '',
      password: '',
      isActive: true,
    });
  };

  const handleEditStudent = async (e) => {
    e.preventDefault();
    if (!editingStudent) return;

    setEditError('');
    setEditSubmitting(true);

    try {
      const payload = {
        name: editForm.name.trim(),
        email: editForm.email.trim(),
        enrollmentNumber: editForm.enrollmentNumber.trim(),
        isActive: editForm.isActive,
      };

      if (!payload.name || !payload.email) {
        setEditError('Name and email are required');
        setEditSubmitting(false);
        return;
      }

      if (editForm.password.trim()) {
        payload.password = editForm.password.trim();
      }

      await axiosInstance.put(`/vendor-admin/students/${editingStudent._id}`, payload);
      await fetchStudents();
      closeEditStudent();
      setSuccess(`Student "${payload.name}" updated successfully.`);
      setTimeout(() => setSuccess(''), 2500);
    } catch (err) {
      setEditError(err.response?.data?.message || 'Failed to update student');
    } finally {
      setEditSubmitting(false);
    }
  };

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
      {success && !showAddForm && !showBulkForm && !editingStudent && (
        <div className="vh-alert vh-alert--success" style={{ marginBottom: 16 }}>
          {success}
        </div>
      )}

      {editingStudent && (
        <div
          className="vsm-edit-overlay"
          onClick={closeEditStudent}
          role="presentation"
        >
          <div
            className="vsm-edit-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="vsm-edit-title"
          >
            <div className="vsm-edit-accent" aria-hidden />

            <header className="vsm-edit-header">
              <div className="vsm-edit-header-main">
                <span className="vsm-edit-avatar">
                  {getInitials(editForm.name || editingStudent.name)}
                </span>
                <div className="vsm-edit-header-text">
                  <p className="vsm-edit-eyebrow">Edit student</p>
                  <h2 id="vsm-edit-title">{editForm.name || editingStudent.name}</h2>
                  <p className="vsm-edit-subtitle">
                    {editForm.enrollmentNumber
                      ? `${editForm.enrollmentNumber} · ${editForm.email || editingStudent.email}`
                      : editForm.email || editingStudent.email}
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="vsm-edit-close"
                onClick={closeEditStudent}
                aria-label="Close edit form"
              >
                <FiX />
              </button>
            </header>

            <form className="vsm-edit-form" onSubmit={handleEditStudent}>
              <div className="vsm-edit-body">
                {editError && (
                  <div className="vh-alert vh-alert--error vsm-edit-alert">{editError}</div>
                )}

                <section className="vsm-edit-section">
                  <div className="vsm-edit-section-head">
                    <FiUser aria-hidden />
                    <div>
                      <h3>Profile</h3>
                      <p>Basic identity shown across tests, classrooms, and reports.</p>
                    </div>
                  </div>
                  <div className="vsm-edit-grid">
                    <div className="vh-field">
                      <label htmlFor="edit-student-name">Full name *</label>
                      <input
                        id="edit-student-name"
                        type="text"
                        value={editForm.name}
                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                        required
                        placeholder="Student name"
                      />
                    </div>
                    <div className="vh-field">
                      <label htmlFor="edit-student-email">Email *</label>
                      <input
                        id="edit-student-email"
                        type="email"
                        value={editForm.email}
                        onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                        required
                        placeholder="student@example.com"
                      />
                    </div>
                    <div className="vh-field vsm-edit-field-full">
                      <label htmlFor="edit-student-enrollment">Enrollment number</label>
                      <input
                        id="edit-student-enrollment"
                        type="text"
                        value={editForm.enrollmentNumber}
                        onChange={(e) =>
                          setEditForm({ ...editForm, enrollmentNumber: e.target.value })
                        }
                        placeholder="e.g. ENR-2024-001"
                      />
                      <span className="vh-field-hint">
                        Unique in your organization. Clear the field to remove it.
                      </span>
                    </div>
                  </div>
                </section>

                <section className="vsm-edit-section">
                  <div className="vsm-edit-section-head">
                    <FiLock aria-hidden />
                    <div>
                      <h3>Security</h3>
                      <p>Reset login credentials for this student.</p>
                    </div>
                  </div>
                  <div className="vh-field">
                    <label htmlFor="edit-student-password">New password</label>
                    <input
                      id="edit-student-password"
                      type="password"
                      value={editForm.password}
                      onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                      placeholder="Leave blank to keep current password"
                      autoComplete="new-password"
                    />
                    <span className="vh-field-hint">Minimum 6 characters when changing.</span>
                  </div>
                </section>

                <section className="vsm-edit-section vsm-edit-section--status">
                  <button
                    type="button"
                    className={`vsm-status-card ${editForm.isActive ? 'is-active' : 'is-inactive'}`}
                    onClick={() => setEditForm({ ...editForm, isActive: !editForm.isActive })}
                  >
                    <span className="vsm-status-indicator" aria-hidden />
                    <span className="vsm-status-copy">
                      <strong>{editForm.isActive ? 'Active account' : 'Inactive account'}</strong>
                      <span>
                        {editForm.isActive
                          ? 'Student can sign in and take assigned assessments.'
                          : 'Sign-in is blocked; past results and history are kept.'}
                      </span>
                    </span>
                    <span className="vsm-status-pill">
                      {editForm.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </button>
                </section>
              </div>

              <footer className="vsm-edit-footer">
                <button
                  type="button"
                  className="vh-btn vh-btn--secondary"
                  onClick={closeEditStudent}
                  disabled={editSubmitting}
                >
                  Cancel
                </button>
                <button type="submit" className="vh-btn vh-btn--primary" disabled={editSubmitting}>
                  {editSubmitting ? 'Saving…' : 'Save changes'}
                </button>
              </footer>
            </form>
          </div>
        </div>
      )}

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
                  <label htmlFor="student-enrollment">Enrollment number</label>
                  <input
                    id="student-enrollment"
                    type="text"
                    value={formData.enrollmentNumber}
                    onChange={(e) =>
                      setFormData({ ...formData, enrollmentNumber: e.target.value })
                    }
                    placeholder="e.g. ENR-2024-001"
                  />
                  <span className="vh-field-hint">Optional. Unique per student in your organization.</span>
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
                  One student per line: <strong>{BULK_STUDENT_FORMAT_HINT}</strong>
                </p>
                <div className="vh-field">
                  <textarea
                    rows={8}
                    value={bulkData}
                    onChange={(e) => setBulkData(e.target.value)}
                    placeholder={BULK_STUDENT_SAMPLE}
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
            placeholder="Search by name, email, or enrollment number…"
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
                    <th>Enrollment #</th>
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
                        {student.enrollmentNumber ? (
                          <span className="vh-badge vh-badge--global">{student.enrollmentNumber}</span>
                        ) : (
                          <span className="vh-cell-muted">—</span>
                        )}
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
                        <button
                          type="button"
                          className="vh-btn vh-btn--ghost vh-btn--sm"
                          onClick={() => openEditStudent(student)}
                        >
                          <FiEdit2 /> Edit
                        </button>
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
