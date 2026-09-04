import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiSearch, FiUsers, FiCheck, FiGrid } from 'react-icons/fi';
import { matchesStudentSearch } from '../../utils/studentBulkImport';
import { getStudentRecordId } from '../../utils/enrollmentStudent';
import VendorLoadMore from './VendorLoadMore';
import VendorDataSection from './VendorDataSection';

const classroomStudentCount = (c) => c.studentCount ?? c.students?.length ?? 0;

const VendorAssignStudents = ({
  students = [],
  classrooms = [],
  selectedStudents,
  onToggleStudent,
  selectedClassroomIds = [],
  onToggleClassroom,
  onClearClassrooms,
  onAssign,
  onCancelTo,
  assignLabel = 'Assign',
  assigning = false,
  accent = '#2563eb',
  assignEntityLabel = 'assessment',
  studentSearch,
  onStudentSearchChange,
  refreshingStudents = false,
  hasMoreStudents = false,
  loadingMoreStudents = false,
  onLoadMoreStudents,
  totalStudents = 0,
  classroomPreviewStudents = null,
  loadingClassroomPreview = false,
}) => {
  const hasClassroomPreview = Array.isArray(classroomPreviewStudents);
  const [localSearch, setLocalSearch] = useState('');
  const search = onStudentSearchChange != null ? studentSearch ?? '' : localSearch;
  const setSearch = onStudentSearchChange || setLocalSearch;
  const serverSearch = onStudentSearchChange != null;
  const [mode, setMode] = useState(classrooms.length > 0 ? 'classroom' : 'students');

  const selectedClassrooms = useMemo(
    () => classrooms.filter((c) => selectedClassroomIds.includes(c._id)),
    [classrooms, selectedClassroomIds]
  );

  const classroomsWithStudents = useMemo(
    () => classrooms.filter((c) => classroomStudentCount(c) > 0),
    [classrooms]
  );

  const { totalSeatCount } = useMemo(() => {
    let seats = 0;
    selectedClassrooms.forEach((c) => {
      seats += classroomStudentCount(c);
    });
    return { totalSeatCount: seats };
  }, [selectedClassrooms]);

  const uniqueStudentCount = totalSeatCount;

  const filteredStudents = useMemo(() => {
    if (serverSearch) return students;
    const q = search.trim().toLowerCase();
    if (!q) return students;
    return students.filter((s) => matchesStudentSearch(s, q));
  }, [students, search, serverSearch]);

  const allStudentsSelected =
    mode === 'students' &&
    filteredStudents.length > 0 &&
    filteredStudents.every((s) => selectedStudents.includes(getStudentRecordId(s)));

  const allClassroomsSelected =
    classroomsWithStudents.length > 0 &&
    classroomsWithStudents.every((c) => selectedClassroomIds.includes(c._id));

  const toggleAllStudents = () => {
    if (mode !== 'students') return;
    if (allStudentsSelected) {
      filteredStudents.forEach((s) => {
        const id = getStudentRecordId(s);
        if (selectedStudents.includes(id)) onToggleStudent(id);
      });
    } else {
      filteredStudents.forEach((s) => {
        const id = getStudentRecordId(s);
        if (!selectedStudents.includes(id)) onToggleStudent(id);
      });
    }
  };

  const toggleAllClassrooms = () => {
    if (allClassroomsSelected) {
      onClearClassrooms?.();
    } else {
      classroomsWithStudents.forEach((c) => {
        if (!selectedClassroomIds.includes(c._id)) onToggleClassroom?.(c._id);
      });
    }
  };

  const canAssign =
    (mode === 'classroom' && selectedClassroomIds.length > 0 && uniqueStudentCount > 0) ||
    (mode === 'students' && selectedStudents.length > 0);

  const selectionSummary = useMemo(() => {
    if (mode === 'classroom' && selectedClassroomIds.length > 0) {
      const classPart = `${selectedClassroomIds.length} classroom${selectedClassroomIds.length !== 1 ? 's' : ''}`;
      const studentPart = `${uniqueStudentCount} student${uniqueStudentCount !== 1 ? 's' : ''}`;
      if (selectedClassroomIds.length > 1) {
        return `${classPart} · ${studentPart} (duplicates removed on assign)`;
      }
      return `${classPart} · ${studentPart}`;
    }
    if (selectedStudents.length > 0) {
      return `${selectedStudents.length} student${selectedStudents.length !== 1 ? 's' : ''} selected`;
    }
    return `Choose one or more classrooms, or select students for this ${assignEntityLabel}`;
  }, [
    mode,
    selectedClassroomIds.length,
    uniqueStudentCount,
    selectedStudents.length,
    assignEntityLabel,
  ]);

  const switchMode = (next) => {
    setMode(next);
    setSearch('');
    if (next === 'classroom') {
      [...selectedStudents].forEach((id) => onToggleStudent(id));
    } else {
      onClearClassrooms?.();
    }
  };

  const studentTotalLabel = totalStudents || students.length;

  return (
    <div className="va-assign" style={{ '--card-accent': accent }}>
      <div className="va-assign-toolbar">
        <div className="va-assign-toolbar-summary">
          <FiCheck className="va-assign-toolbar-icon" aria-hidden />
          <span>{selectionSummary}</span>
        </div>
        <div className="va-assign-toolbar-actions">
          {onCancelTo && (
            <Link to={onCancelTo} className="va-btn va-btn--secondary">
              Cancel
            </Link>
          )}
          <button
            type="button"
            className="va-btn va-btn--primary"
            disabled={!canAssign || assigning}
            onClick={onAssign}
          >
            {assignLabel}
          </button>
        </div>
      </div>

      {classrooms.length > 0 && (
        <div className="va-assign-mode-tabs" role="tablist" aria-label="Assignment method">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'classroom'}
            className={`va-assign-mode-tab ${mode === 'classroom' ? 'active' : ''}`}
            onClick={() => switchMode('classroom')}
          >
            <FiGrid /> Assign to classroom(s)
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'students'}
            className={`va-assign-mode-tab ${mode === 'students' ? 'active' : ''}`}
            onClick={() => switchMode('students')}
          >
            <FiUsers /> Pick students
          </button>
        </div>
      )}

      {mode === 'classroom' && classrooms.length > 0 && (
        <div className="va-panel">
          <div className="va-panel-header">
            <h2>Choose classrooms</h2>
            <div className="va-panel-header-actions">
              <button
                type="button"
                className="va-btn va-btn--secondary va-btn--sm"
                onClick={toggleAllClassrooms}
                disabled={classroomsWithStudents.length === 0}
              >
                {allClassroomsSelected ? 'Clear all' : 'Select all'}
              </button>
              <span className="va-cell-muted">{classrooms.length} total</span>
            </div>
          </div>
          <div className="va-panel-body">
            <p className="va-assign-hint">
              Select one or more classrooms. Every student in those classes will receive this {assignEntityLabel}.
              Students in multiple selected classes are only enrolled once.
            </p>
            <div className="va-classroom-grid">
              {classrooms.map((c) => {
                const count = classroomStudentCount(c);
                const selected = selectedClassroomIds.includes(c._id);
                const empty = count === 0;
                return (
                  <button
                    key={c._id}
                    type="button"
                    className={`va-classroom-card ${selected ? 'selected' : ''} ${empty ? 'empty' : ''}`}
                    onClick={() => !empty && onToggleClassroom?.(c._id)}
                    disabled={empty}
                    aria-pressed={selected}
                  >
                    <input
                      type="checkbox"
                      readOnly
                      checked={selected}
                      tabIndex={-1}
                      aria-hidden
                      className="va-classroom-card-check"
                    />
                    <span className="va-classroom-card-text">
                      <span className="va-classroom-card-name">{c.name}</span>
                      <span className="va-classroom-card-meta">
                        {empty ? 'No students — add students first' : `${count} student${count !== 1 ? 's' : ''}`}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {mode === 'students' && (
        <div className="va-panel">
          <div className="va-panel-header">
            <h2>
              <FiUsers style={{ verticalAlign: 'middle', marginRight: 6 }} />
              Select students
            </h2>
            <span className="va-cell-muted">{studentTotalLabel} total</span>
          </div>
          <div className="va-panel-body">
            <div className="va-student-toolbar">
              <div className="va-search">
                <FiSearch />
                <input
                  type="search"
                  placeholder="Search by name, email, or enrollment number…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <button
                type="button"
                className="va-btn va-btn--secondary va-btn--sm"
                onClick={toggleAllStudents}
                disabled={filteredStudents.length === 0}
              >
                {allStudentsSelected ? 'Deselect all' : 'Select all'}
              </button>
            </div>

            {filteredStudents.length === 0 ? (
              <div className="va-empty">
                <p>{search ? 'No students match your search.' : 'No students available to assign.'}</p>
              </div>
            ) : (
              <>
                <VendorDataSection refreshing={refreshingStudents}>
                <div className="va-student-grid">
                  {filteredStudents.map((student) => {
                    const studentId = getStudentRecordId(student);
                    const selected = selectedStudents.includes(studentId);
                    return (
                      <button
                        key={studentId}
                        type="button"
                        className={`va-student-card ${selected ? 'selected' : ''}`}
                        onClick={() => onToggleStudent(studentId)}
                      >
                        <input
                          type="checkbox"
                          readOnly
                          checked={selected}
                          tabIndex={-1}
                          aria-hidden
                        />
                        <span>
                          <span className="va-student-name">{student.name || 'Student'}</span>
                          <span className="va-student-email">
                            {student.enrollmentNumber
                              ? `${student.enrollmentNumber} · ${student.email || 'No email'}`
                              : student.email || 'No email on file'}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
                {onLoadMoreStudents && (
                  <VendorLoadMore
                    hasMore={hasMoreStudents}
                    loading={loadingMoreStudents || refreshingStudents}
                    loadedCount={students.length}
                    total={totalStudents || students.length}
                    onLoadMore={onLoadMoreStudents}
                  />
                )}
                </VendorDataSection>
              </>
            )}
          </div>
        </div>
      )}

      {mode === 'classroom' && selectedClassroomIds.length > 0 && (
        <div className="va-panel va-assign-preview">
          <div className="va-panel-header">
            <h2>
              Students across {selectedClassroomIds.length} classroom
              {selectedClassroomIds.length !== 1 ? 's' : ''}
            </h2>
            <span className="va-cell-muted">
              {loadingClassroomPreview
                ? 'Loading students…'
                : `${
                    hasClassroomPreview && classroomPreviewStudents.length
                      ? classroomPreviewStudents.length
                      : uniqueStudentCount
                  } student${
                    (hasClassroomPreview && classroomPreviewStudents.length
                      ? classroomPreviewStudents.length
                      : uniqueStudentCount) !== 1
                      ? 's'
                      : ''
                  }`}
            </span>
          </div>
          <div className="va-panel-body">
            <div className="va-assign-class-chips">
              {selectedClassrooms.map((c) => (
                <span key={c._id} className="va-assign-class-chip">
                  {c.name} ({classroomStudentCount(c)})
                  <button
                    type="button"
                    className="va-assign-class-chip-remove"
                    aria-label={`Remove ${c.name}`}
                    onClick={() => onToggleClassroom?.(c._id)}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            {hasClassroomPreview && classroomPreviewStudents.length > 0 && (
              <ul className="va-classroom-student-preview">
                {classroomPreviewStudents.map((student) => (
                  <li key={getStudentRecordId(student)}>
                    <strong>{student.name || 'Student'}</strong>
                    <span>
                      {student.enrollmentNumber
                        ? `${student.enrollmentNumber} · ${student.email || ''}`
                        : student.email || '—'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {hasClassroomPreview &&
              !loadingClassroomPreview &&
              classroomPreviewStudents.length === 0 && (
                <p className="va-assign-hint" style={{ marginTop: 12, marginBottom: 0 }}>
                  No student profiles found for the selected classroom(s). Add students to the
                  classroom first, or use Pick students to assign individually.
                </p>
              )}
          </div>
        </div>
      )}
    </div>
  );
};

export default VendorAssignStudents;
