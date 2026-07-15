import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  FiSearch,
  FiUsers,
  FiUpload,
  FiX,
  FiUserPlus,
  FiTrash2,
  FiRefreshCw,
  FiCheckSquare,
  FiSquare,
  FiFileText,
} from 'react-icons/fi';
import axiosInstance from '../../utils/axios';
import Modal from '../../components/Modal';
import VendorHubPage from '../../components/VendorAdmin/VendorHubPage';
import VendorDataSection from '../../components/VendorAdmin/VendorDataSection';
import VendorLoadMore from '../../components/VendorAdmin/VendorLoadMore';
import { useVendorStudents } from '../../hooks/useVendorStudents';
import {
  parseBulkStudentText,
  matchesStudentSearch,
  BULK_STUDENT_FORMAT_HINT,
  BULK_STUDENT_SAMPLE,
} from '../../utils/studentBulkImport';
import './ManageClassroomStudents.css';

const getInitials = (name) =>
  (name || '?')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

const normalizeId = (value) => String(value?._id || value || '');

const ManageClassroomStudents = () => {
  const { id } = useParams();
  const [classroom, setClassroom] = useState(null);
  const {
    students: allStudents,
    refreshing: studentsRefreshing,
    loadingMore,
    hasMore,
    total: totalStudents,
    search: searchAvailable,
    setSearch: setSearchAvailable,
    loadMore,
    refresh: refreshStudents,
  } = useVendorStudents();
  const [classroomLoading, setClassroomLoading] = useState(true);
  const [modal, setModal] = useState({ isOpen: false, title: '', message: '', type: 'info' });
  const [activeTab, setActiveTab] = useState('enrolled');
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [addingSelected, setAddingSelected] = useState(false);
  const [removingId, setRemovingId] = useState(null);
  const [bulkData, setBulkData] = useState('');
  const [bulkImporting, setBulkImporting] = useState(false);
  const [bulkFeedback, setBulkFeedback] = useState({ type: '', message: '' });
  const [searchCurrent, setSearchCurrent] = useState('');
  const classroomLoadedRef = useRef(false);

  const pageLoading = classroomLoading && !classroomLoadedRef.current;

  const showModal = (title, message, type = 'info') => {
    setModal({ isOpen: true, title, message, type });
  };

  const closeModal = () => {
    setModal({ isOpen: false, title: '', message: '', type: 'info' });
  };

  const fetchClassroom = useCallback(async () => {
    try {
      if (!classroomLoadedRef.current) setClassroomLoading(true);
      const classroomRes = await axiosInstance.get(`/vendor-admin/classrooms/${id}`);
      setClassroom(classroomRes.data);
      classroomLoadedRef.current = true;
    } catch (error) {
      console.error('Error fetching data:', error);
      showModal('Error', error.response?.data?.message || 'Failed to load classroom data.', 'error');
    } finally {
      setClassroomLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchClassroom();
  }, [fetchClassroom]);

  const fetchData = useCallback(async () => {
    await Promise.all([fetchClassroom(), refreshStudents()]);
  }, [fetchClassroom, refreshStudents]);

  const classroomStudentIds = useMemo(
    () => new Set((classroom?.students || []).map((s) => normalizeId(s))),
    [classroom]
  );

  const currentStudents = useMemo(() => {
    const list = classroom?.students || [];
    const q = searchCurrent.trim().toLowerCase();
    if (!q) return list;
    return list.filter((s) => matchesStudentSearch(s, q));
  }, [classroom, searchCurrent]);

  const availableStudents = useMemo(() => {
    return allStudents.filter((s) => !classroomStudentIds.has(normalizeId(s._id)));
  }, [allStudents, classroomStudentIds]);

  const handleStudentToggle = (studentId) => {
    const sid = normalizeId(studentId);
    setSelectedStudents((prev) =>
      prev.includes(sid) ? prev.filter((id) => id !== sid) : [...prev, sid]
    );
  };

  const handleAddStudents = async () => {
    if (selectedStudents.length === 0) {
      showModal('Select students', 'Choose at least one student to add to this classroom.', 'warning');
      return;
    }

    try {
      setAddingSelected(true);
      await axiosInstance.post(`/vendor-admin/classrooms/${id}/students`, {
        studentIds: selectedStudents,
      });
      showModal('Success', `${selectedStudents.length} student(s) added to the classroom.`, 'success');
      setSelectedStudents([]);
      await fetchData();
      setActiveTab('enrolled');
    } catch (error) {
      showModal('Error', error.response?.data?.message || 'Failed to add students.', 'error');
    } finally {
      setAddingSelected(false);
    }
  };

  const handleRemoveStudent = async (studentId) => {
    if (!window.confirm('Remove this student from the classroom?')) return;

    const sid = normalizeId(studentId);
    try {
      setRemovingId(sid);
      await axiosInstance.delete(`/vendor-admin/classrooms/${id}/students/${sid}`);
      await fetchData();
    } catch (error) {
      showModal('Error', error.response?.data?.message || 'Failed to remove student.', 'error');
    } finally {
      setRemovingId(null);
    }
  };

  const parseBulkLines = (raw) => {
    const { students, invalidLines } = parseBulkStudentText(raw);
    return {
      students,
      invalidLines: invalidLines.map((item) => item.line),
    };
  };

  const handleBulkAdd = async () => {
    setBulkFeedback({ type: '', message: '' });

    if (!bulkData.trim()) {
      setBulkFeedback({ type: 'error', message: 'Paste at least one student row to import.' });
      return;
    }

    const { students, invalidLines } = parseBulkLines(bulkData);

    if (students.length === 0) {
      setBulkFeedback({
        type: 'error',
        message: 'Invalid format. Use Name,Email,EnrollmentNumber,Password — one student per line.',
      });
      return;
    }

    if (invalidLines.length > 0) {
      setBulkFeedback({
        type: 'warning',
        message: `Line${invalidLines.length > 1 ? 's' : ''} ${invalidLines.join(', ')} look invalid and will be skipped.`,
      });
    }

    try {
      setBulkImporting(true);
      const response = await axiosInstance.post(`/vendor-admin/classrooms/${id}/students/bulk`, {
        students,
      });

      const added = response.data.added?.length || 0;
      const created = response.data.created?.length || 0;
      const skipped = response.data.skipped?.length || 0;

      const parts = [
        `${added} added to classroom`,
        created ? `${created} new account${created !== 1 ? 's' : ''} created` : '',
        skipped ? `${skipped} skipped` : '',
      ].filter(Boolean);

      setBulkFeedback({
        type: 'success',
        message: parts.join(' · '),
      });

      if (response.data.skipped?.length) {
        const skippedDetails = response.data.skipped
          .slice(0, 5)
          .map((s) => `${s.email}: ${s.reason}`)
          .join('\n');
        showModal(
          'Import complete',
          `${parts.join('\n')}\n\nSkipped:\n${skippedDetails}${
            response.data.skipped.length > 5 ? '\n…' : ''
          }`,
          skipped ? 'warning' : 'success'
        );
      } else {
        showModal('Import complete', parts.join('\n'), 'success');
      }

      setBulkData('');
      await fetchData();
      if (added > 0) {
        setActiveTab('enrolled');
      }
    } catch (error) {
      const validationMsg = error.response?.data?.errors
        ?.map((e) => e.msg)
        .filter(Boolean)
        .join('\n');
      const message =
        validationMsg ||
        error.response?.data?.message ||
        'Failed to import students into this classroom.';
      setBulkFeedback({ type: 'error', message });
      showModal('Import failed', message, 'error');
    } finally {
      setBulkImporting(false);
    }
  };

  const handleToggleAllAvailable = () => {
    const availableIds = availableStudents.map((s) => normalizeId(s._id));
    const allSelected =
      availableIds.length > 0 && availableIds.every((sid) => selectedStudents.includes(sid));

    if (allSelected) {
      setSelectedStudents((prev) => prev.filter((sid) => !availableIds.includes(sid)));
      return;
    }
    setSelectedStudents((prev) => Array.from(new Set([...prev, ...availableIds])));
  };

  const enrolledCount = classroom?.students?.length || 0;

  if (!pageLoading && !classroom) {
    return (
      <VendorHubPage
        backTo="/vendor-admin/classrooms"
        backLabel="Back to classrooms"
        title="Classroom not found"
        accent="#0891b2"
      >
        <div className="vh-empty">
          <p>This classroom may have been deleted.</p>
          <Link to="/vendor-admin/classrooms" className="vh-btn vh-btn--primary">
            Back to classrooms
          </Link>
        </div>
      </VendorHubPage>
    );
  }

  return (
    <VendorHubPage
      className="mcs-page"
      loading={pageLoading}
      backTo="/vendor-admin/classrooms"
      backLabel="Back to classrooms"
      eyebrow="Classroom roster"
      title={classroom?.name || 'Manage students'}
      subtitle={
        classroom?.description ||
        'Enroll students individually, pick from your roster, or import many at once.'
      }
      accent="#0891b2"
      actions={
        <>
          <button type="button" className="vh-btn vh-btn--ghost" onClick={fetchData}>
            <FiRefreshCw /> Refresh
          </button>
          <button
            type="button"
            className={`vh-btn vh-btn--secondary ${activeTab === 'bulk' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('bulk')}
          >
            <FiUpload /> Bulk enroll
          </button>
          <Link
            to={`/vendor-admin/classrooms/${id}/tests`}
            className="vh-btn vh-btn--primary"
          >
            <FiFileText /> Assign tests
          </Link>
        </>
      }
    >
      <Modal isOpen={modal.isOpen} onClose={closeModal} title={modal.title} type={modal.type}>
        <p style={{ whiteSpace: 'pre-line' }}>{modal.message}</p>
      </Modal>

      <div className="vh-stats mcs-stats">
        <div className="vh-stat vh-stat--accent">
          <span className="vh-stat-label">Enrolled</span>
          <span className="vh-stat-value">{enrolledCount}</span>
        </div>
        <div className="vh-stat">
          <span className="vh-stat-label">Available to add</span>
          <span className="vh-stat-value">{availableStudents.length}</span>
        </div>
        <div className="vh-stat">
          <span className="vh-stat-label">Selected</span>
          <span className="vh-stat-value">{selectedStudents.length}</span>
        </div>
      </div>

      <div className="mcs-tabs" role="tablist" aria-label="Student management views">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'enrolled'}
          className={`mcs-tab ${activeTab === 'enrolled' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('enrolled')}
        >
          <FiUsers /> Enrolled ({enrolledCount})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'add'}
          className={`mcs-tab ${activeTab === 'add' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('add')}
        >
          <FiUserPlus /> Add from roster ({availableStudents.length})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'bulk'}
          className={`mcs-tab ${activeTab === 'bulk' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('bulk')}
        >
          <FiUpload /> Bulk enroll
        </button>
      </div>

      {activeTab === 'enrolled' && (
        <div className="vh-panel mcs-panel">
          <div className="vh-panel-head">
            <div>
              <h2 className="vh-panel-title">Students in this classroom</h2>
              <p className="vh-panel-desc">Search enrolled students and remove them when needed.</p>
            </div>
          </div>
          <div className="vh-panel-body">
            <div className="vh-search mcs-search">
              <FiSearch />
              <input
                type="search"
                placeholder="Search by name, email, or enrollment number…"
                value={searchCurrent}
                onChange={(e) => setSearchCurrent(e.target.value)}
              />
            </div>

            {currentStudents.length === 0 ? (
              <div className="mcs-empty">
                <div className="vh-empty-icon">
                  <FiUsers />
                </div>
                <h3>{searchCurrent ? 'No matches' : 'No students yet'}</h3>
                <p>
                  {searchCurrent
                    ? 'Try a different search term.'
                    : 'Add students from your roster or bulk enroll a CSV-style list.'}
                </p>
                {!searchCurrent && (
                  <div className="mcs-empty-actions">
                    <button
                      type="button"
                      className="vh-btn vh-btn--secondary"
                      onClick={() => setActiveTab('add')}
                    >
                      <FiUserPlus /> Add from roster
                    </button>
                    <button
                      type="button"
                      className="vh-btn vh-btn--primary"
                      onClick={() => setActiveTab('bulk')}
                    >
                      <FiUpload /> Bulk enroll
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="mcs-member-list">
                {currentStudents.map((student) => {
                  const sid = normalizeId(student);
                  return (
                    <div key={sid} className="mcs-member-row">
                      <div className="vh-person">
                        <span className="vh-avatar mcs-avatar">{getInitials(student.name)}</span>
                        <div>
                          <div className="vh-person-name">{student.name || 'Student'}</div>
                          <div className="vh-person-email">
                            {student.enrollmentNumber
                              ? `${student.enrollmentNumber} · ${student.email || ''}`
                              : student.email || ''}
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="vh-btn vh-btn--icon vh-btn--danger"
                        title="Remove from classroom"
                        disabled={removingId === sid}
                        onClick={() => handleRemoveStudent(sid)}
                      >
                        <FiTrash2 />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'add' && (
        <div className="vh-panel mcs-panel">
          <div className="vh-panel-head">
            <div>
              <h2 className="vh-panel-title">Add existing students</h2>
              <p className="vh-panel-desc">
                Select students already registered under your organization.
              </p>
            </div>
            <div className="mcs-panel-actions">
              <button
                type="button"
                className="vh-btn vh-btn--ghost vh-btn--sm"
                onClick={handleToggleAllAvailable}
                disabled={availableStudents.length === 0}
              >
                {availableStudents.length > 0 &&
                availableStudents.every((s) => selectedStudents.includes(normalizeId(s._id))) ? (
                  <>
                    <FiSquare /> Unselect shown
                  </>
                ) : (
                  <>
                    <FiCheckSquare /> Select shown
                  </>
                )}
              </button>
              <button
                type="button"
                className="vh-btn vh-btn--primary vh-btn--sm"
                disabled={selectedStudents.length === 0 || addingSelected}
                onClick={handleAddStudents}
              >
                {addingSelected
                  ? 'Adding…'
                  : `Add selected (${selectedStudents.length})`}
              </button>
            </div>
          </div>
          <div className="vh-panel-body">
            <div className="vh-search mcs-search">
              <FiSearch />
              <input
                type="search"
                placeholder="Search by name, email, or enrollment number…"
                value={searchAvailable}
                onChange={(e) => setSearchAvailable(e.target.value)}
              />
            </div>

            {selectedStudents.length > 0 && (
              <div className="vh-selection-bar mcs-selection-bar">
                <span>{selectedStudents.length} selected</span>
                <button
                  type="button"
                  className="vh-btn vh-btn--ghost vh-btn--sm"
                  onClick={() => setSelectedStudents([])}
                >
                  <FiX /> Clear
                </button>
              </div>
            )}

            {availableStudents.length === 0 && !studentsRefreshing ? (
              <div className="mcs-empty">
                <div className="vh-empty-icon">
                  <FiUserPlus />
                </div>
                <h3>{searchAvailable ? 'No matches' : 'Everyone is already enrolled'}</h3>
                <p>
                  {searchAvailable
                    ? 'Try another search or use bulk enroll to create new accounts.'
                    : 'Use bulk enroll to create new student accounts and add them here.'}
                </p>
                {!searchAvailable && (
                  <button
                    type="button"
                    className="vh-btn vh-btn--primary"
                    onClick={() => setActiveTab('bulk')}
                  >
                    <FiUpload /> Bulk enroll
                  </button>
                )}
              </div>
            ) : (
              <>
              <VendorDataSection refreshing={studentsRefreshing}>
              <div className="mcs-member-list">
                {availableStudents.map((student) => {
                  const sid = normalizeId(student._id);
                  const isSelected = selectedStudents.includes(sid);
                  return (
                    <label
                      key={sid}
                      className={`mcs-member-row mcs-member-row--selectable ${
                        isSelected ? 'mcs-member-row--selected' : ''
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleStudentToggle(sid)}
                      />
                      <div className="vh-person">
                        <span className="vh-avatar mcs-avatar mcs-avatar--muted">
                          {getInitials(student.name)}
                        </span>
                        <div>
                          <div className="vh-person-name">{student.name}</div>
                          <div className="vh-person-email">
                            {student.enrollmentNumber
                              ? `${student.enrollmentNumber} · ${student.email || ''}`
                              : student.email || ''}
                          </div>
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
              <VendorLoadMore
                hasMore={hasMore}
                loading={loadingMore || studentsRefreshing}
                loadedCount={allStudents.length}
                total={totalStudents}
                onLoadMore={loadMore}
              />
              </VendorDataSection>
              </>
            )}
          </div>
        </div>
      )}

      {activeTab === 'bulk' && (
        <div className="vh-panel mcs-panel mcs-panel--bulk">
          <div className="vh-panel-head">
            <div>
              <h2 className="vh-panel-title">Bulk enroll into classroom</h2>
              <p className="vh-panel-desc">
                Paste one student per line. Existing accounts are linked; new emails create accounts
                and enroll them automatically.
              </p>
            </div>
          </div>
          <div className="vh-panel-body">
            {bulkFeedback.message && (
              <div className={`vh-alert vh-alert--${bulkFeedback.type || 'error'}`}>
                {bulkFeedback.message}
              </div>
            )}

            <div className="mcs-bulk-grid">
              <div className="mcs-bulk-main">
                <div className="vh-field">
                  <label htmlFor="mcs-bulk-input">Student list</label>
                  <textarea
                    id="mcs-bulk-input"
                    rows={12}
                    value={bulkData}
                    onChange={(e) => {
                      setBulkData(e.target.value);
                      if (bulkFeedback.message) {
                        setBulkFeedback({ type: '', message: '' });
                      }
                    }}
                    placeholder={BULK_STUDENT_SAMPLE}
                    spellCheck={false}
                  />
                  <span className="vh-field-hint">
                    Format: <strong>{BULK_STUDENT_FORMAT_HINT}</strong>
                  </span>
                </div>
                <div className="vh-form-actions mcs-bulk-actions">
                  <button
                    type="button"
                    className="vh-btn vh-btn--ghost"
                    onClick={() => setBulkData('')}
                    disabled={bulkImporting || !bulkData.trim()}
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    className="vh-btn vh-btn--secondary"
                    onClick={() => setBulkData(BULK_STUDENT_SAMPLE)}
                    disabled={bulkImporting}
                  >
                    Insert sample
                  </button>
                  <button
                    type="button"
                    className="vh-btn vh-btn--primary"
                    disabled={bulkImporting || !bulkData.trim()}
                    onClick={handleBulkAdd}
                  >
                    {bulkImporting ? 'Enrolling…' : 'Enroll into classroom'}
                  </button>
                </div>
              </div>

              <aside className="mcs-bulk-help">
                <h3>How bulk enroll works</h3>
                <ol>
                  <li>Paste students as comma-separated rows.</li>
                  <li>If the email already exists, the student is added to this classroom.</li>
                  <li>If the email is new, an account is created and enrolled.</li>
                  <li>Students already in this classroom are skipped.</li>
                </ol>
                <div className="mcs-bulk-example">
                  <span className="mcs-bulk-example-label">Example</span>
                  <pre>{BULK_STUDENT_SAMPLE}</pre>
                </div>
              </aside>
            </div>
          </div>
        </div>
      )}
    </VendorHubPage>
  );
};

export default ManageClassroomStudents;
