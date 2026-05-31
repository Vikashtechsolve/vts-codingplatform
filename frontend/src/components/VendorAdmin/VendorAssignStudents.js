import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiSearch, FiUsers, FiCheck, FiGrid } from 'react-icons/fi';

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
}) => {
  const [search, setSearch] = useState('');
  const [mode, setMode] = useState(classrooms.length > 0 ? 'classroom' : 'students');

  const selectedClassrooms = useMemo(
    () => classrooms.filter((c) => selectedClassroomIds.includes(c._id)),
    [classrooms, selectedClassroomIds]
  );

  const classroomsWithStudents = useMemo(
    () => classrooms.filter((c) => (c.students?.length ?? 0) > 0),
    [classrooms]
  );

  const { uniqueStudentIds, totalSeatCount } = useMemo(() => {
    const ids = new Set();
    let seats = 0;
    selectedClassrooms.forEach((c) => {
      (c.students || []).forEach((s) => {
        const id = (s._id || s).toString();
        ids.add(id);
        seats += 1;
      });
    });
    return { uniqueStudentIds: ids, totalSeatCount: seats };
  }, [selectedClassrooms]);

  const uniqueStudentCount = uniqueStudentIds.size;

  const previewStudents = useMemo(() => {
    if (uniqueStudentCount === 0) return [];
    return students.filter((s) => uniqueStudentIds.has(s._id.toString()));
  }, [students, uniqueStudentIds, uniqueStudentCount]);

  const filteredStudents = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = students;
    if (!q) return list;
    return list.filter(
      (s) =>
        s.name?.toLowerCase().includes(q) ||
        s.email?.toLowerCase().includes(q)
    );
  }, [students, search]);

  const allStudentsSelected =
    mode === 'students' &&
    filteredStudents.length > 0 &&
    filteredStudents.every((s) => selectedStudents.includes(s._id));

  const allClassroomsSelected =
    classroomsWithStudents.length > 0 &&
    classroomsWithStudents.every((c) => selectedClassroomIds.includes(c._id));

  const toggleAllStudents = () => {
    if (mode !== 'students') return;
    if (allStudentsSelected) {
      filteredStudents.forEach((s) => {
        if (selectedStudents.includes(s._id)) onToggleStudent(s._id);
      });
    } else {
      filteredStudents.forEach((s) => {
        if (!selectedStudents.includes(s._id)) onToggleStudent(s._id);
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
      if (totalSeatCount > uniqueStudentCount) {
        return `${classPart} · ${studentPart} (${totalSeatCount - uniqueStudentCount} overlap)`;
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
    totalSeatCount,
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
                const count = c.students?.length ?? 0;
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
            <span className="va-cell-muted">{students.length} total</span>
          </div>
          <div className="va-panel-body">
            <div className="va-student-toolbar">
              <div className="va-search">
                <FiSearch />
                <input
                  type="search"
                  placeholder="Search by name or email…"
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
              <div className="va-student-grid">
                {filteredStudents.map((student) => {
                  const selected = selectedStudents.includes(student._id);
                  return (
                    <button
                      key={student._id}
                      type="button"
                      className={`va-student-card ${selected ? 'selected' : ''}`}
                      onClick={() => onToggleStudent(student._id)}
                    >
                      <input
                        type="checkbox"
                        readOnly
                        checked={selected}
                        tabIndex={-1}
                        aria-hidden
                      />
                      <span>
                        <span className="va-student-name">{student.name}</span>
                        <span className="va-student-email">{student.email}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {mode === 'classroom' && selectedClassroomIds.length > 0 && uniqueStudentCount > 0 && (
        <div className="va-panel va-assign-preview">
          <div className="va-panel-header">
            <h2>
              Students across {selectedClassroomIds.length} classroom
              {selectedClassroomIds.length !== 1 ? 's' : ''}
            </h2>
          </div>
          <div className="va-panel-body">
            <div className="va-assign-class-chips">
              {selectedClassrooms.map((c) => (
                <span key={c._id} className="va-assign-class-chip">
                  {c.name}
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
            <ul className="va-assign-roster">
              {previewStudents.slice(0, 16).map((s) => (
                <li key={s._id}>{s.name}</li>
              ))}
              {previewStudents.length > 16 && (
                <li className="va-assign-roster-more">+{previewStudents.length - 16} more</li>
              )}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

export default VendorAssignStudents;
