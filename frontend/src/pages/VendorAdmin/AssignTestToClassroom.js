import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { FiPlus, FiTrash2, FiCheckSquare, FiSquare, FiSearch } from 'react-icons/fi';
import axiosInstance from '../../utils/axios';
import { useVendorPanel } from '../../context/VendorPanelContext';
import VendorAssessPage from '../../components/VendorAdmin/VendorAssessPage';
import Modal from '../../components/Modal';
import './AssignTestToClassroom.css';

const TEST_TYPES = [
  'all',
  'coding',
  'mcq',
  'aptitude',
  'theory',
  'english',
  'mixed',
  'interview',
];

const TYPE_LABELS = {
  all: 'All types',
  coding: 'Coding',
  mcq: 'MCQ',
  aptitude: 'Aptitude',
  theory: 'Theory',
  english: 'English',
  mixed: 'Mixed',
  interview: 'Interview',
};

const AssignTestToClassroom = () => {
  const { id } = useParams();
  const { refreshStats } = useVendorPanel();
  const [classroom, setClassroom] = useState(null);
  const [tests, setTests] = useState([]);
  const [interviews, setInterviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState({ isOpen: false, title: '', message: '', type: 'info' });
  const [assigningId, setAssigningId] = useState(null);
  const [bulkAssigning, setBulkAssigning] = useState(false);
  const [bulkRemoving, setBulkRemoving] = useState(false);
  const [testTypeFilter, setTestTypeFilter] = useState('all');
  const [selectedAvailableIds, setSelectedAvailableIds] = useState([]);
  const [selectedAssignedIds, setSelectedAssignedIds] = useState([]);
  const [search, setSearch] = useState('');

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
        axiosInstance.get('/interviews').catch(() => ({ data: [] })),
      ]);

      setClassroom(classroomRes.data);
      setTests(Array.isArray(testsRes.data) ? testsRes.data : []);
      setInterviews(Array.isArray(interviewsRes?.data) ? interviewsRes.data : []);
    } catch (error) {
      console.error('Error fetching data:', error);
      showModal('Error', error.response?.data?.message || 'Failed to load data.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleAssign = async (item) => {
    if (!classroom?.students?.length) {
      showModal('No students', 'Add students to this classroom before assigning assessments.', 'warning');
      return;
    }
    const isInterview = item.kind === 'interview';
    try {
      setAssigningId(item._id);
      if (isInterview) {
        const response = await axiosInstance.post(`/vendor-admin/classrooms/${id}/interviews/${item._id}`);
        showModal('Success', response.data.message || 'Interview assigned successfully!', 'success');
      } else {
        const response = await axiosInstance.post(`/vendor-admin/classrooms/${id}/tests/${item._id}`);
        showModal('Success', response.data.message || 'Test assigned successfully!', 'success');
      }
      await refreshStats({ silent: true });
      fetchData();
    } catch (error) {
      showModal('Error', error.response?.data?.message || 'Failed to assign.', 'error');
    } finally {
      setAssigningId(null);
    }
  };

  const handleRemove = async (item) => {
    if (!window.confirm('Remove this assessment from the classroom roster? (Student enrollments are not removed.)')) return;
    const isInterview = item.kind === 'interview';
    try {
      if (isInterview) {
        await axiosInstance.delete(`/vendor-admin/classrooms/${id}/interviews/${item._id}`);
      } else {
        await axiosInstance.delete(`/vendor-admin/classrooms/${id}/tests/${item._id}`);
      }
      showModal('Success', 'Removed from classroom.', 'success');
      fetchData();
    } catch (error) {
      showModal('Error', error.response?.data?.message || 'Failed to remove.', 'error');
    }
  };

  const assignedTestIds = useMemo(
    () => classroom?.assignedTests?.map((at) => (at.testId?._id || at.testId)?.toString()).filter(Boolean) || [],
    [classroom?.assignedTests]
  );
  const assignedInterviewIds = useMemo(
    () =>
      (classroom?.assignedInterviews || [])
        .map((ai) => (ai.interviewId?._id || ai.interviewId)?.toString())
        .filter(Boolean),
    [classroom?.assignedInterviews]
  );

  const assignedItems = useMemo(() => {
    const testItems = tests
      .filter((t) => assignedTestIds.includes(t._id.toString()))
      .map((t) => ({ ...t, kind: 'test' }));
    const interviewItems = interviews
      .filter((i) => assignedInterviewIds.includes(i._id.toString()))
      .map((i) => ({
        _id: i._id,
        title: i.title,
        type: 'interview',
        kind: 'interview',
        duration: i.duration,
        topic: i.topic,
      }));
    return [...testItems, ...interviewItems];
  }, [tests, interviews, assignedTestIds, assignedInterviewIds]);

  const availableItems = useMemo(() => {
    const testItems = tests
      .filter((t) => !assignedTestIds.includes(t._id.toString()))
      .map((t) => ({ ...t, kind: 'test' }));
    const interviewItems = interviews
      .filter((i) => !assignedInterviewIds.includes(i._id.toString()))
      .map((i) => ({
        _id: i._id,
        title: i.title,
        type: 'interview',
        kind: 'interview',
        duration: i.duration,
        topic: i.topic,
        description: i.description,
      }));
    return [...testItems, ...interviewItems];
  }, [tests, interviews, assignedTestIds, assignedInterviewIds]);

  const filteredAssigned = useMemo(() => {
    const q = search.trim().toLowerCase();
    return assignedItems.filter((t) => {
      if (testTypeFilter !== 'all' && t.type !== testTypeFilter) return false;
      if (!q) return true;
      return (
        t.title?.toLowerCase().includes(q) ||
        t.type?.toLowerCase().includes(q) ||
        t.topic?.toLowerCase().includes(q)
      );
    });
  }, [assignedItems, testTypeFilter, search]);

  const filteredAvailable = useMemo(() => {
    const q = search.trim().toLowerCase();
    return availableItems.filter((t) => {
      if (testTypeFilter !== 'all' && t.type !== testTypeFilter) return false;
      if (!q) return true;
      return (
        t.title?.toLowerCase().includes(q) ||
        t.type?.toLowerCase().includes(q) ||
        t.topic?.toLowerCase().includes(q)
      );
    });
  }, [availableItems, testTypeFilter, search]);

  const handleToggleAvailable = (id) => {
    const sid = String(id);
    setSelectedAvailableIds((prev) =>
      prev.includes(sid) ? prev.filter((x) => x !== sid) : [...prev, sid]
    );
  };

  const handleToggleAssigned = (id) => {
    const sid = String(id);
    setSelectedAssignedIds((prev) =>
      prev.includes(sid) ? prev.filter((x) => x !== sid) : [...prev, sid]
    );
  };

  const handleSelectAllAvailableShown = () => {
    const shown = filteredAvailable.map((x) => String(x._id));
    const allSelected = shown.length > 0 && shown.every((id) => selectedAvailableIds.includes(id));
    if (allSelected) {
      setSelectedAvailableIds((prev) => prev.filter((id) => !shown.includes(id)));
    } else {
      setSelectedAvailableIds((prev) => Array.from(new Set([...prev, ...shown])));
    }
  };

  const handleSelectAllAssignedShown = () => {
    const shown = filteredAssigned.map((x) => String(x._id));
    const allSelected = shown.length > 0 && shown.every((id) => selectedAssignedIds.includes(id));
    if (allSelected) {
      setSelectedAssignedIds((prev) => prev.filter((id) => !shown.includes(id)));
    } else {
      setSelectedAssignedIds((prev) => Array.from(new Set([...prev, ...shown])));
    }
  };

  const handleBulkAssign = async () => {
    if (!selectedAvailableIds.length) return;
    if (!classroom?.students?.length) {
      showModal('No students', 'Add students to this classroom before assigning assessments.', 'warning');
      return;
    }
    const selectedItems = availableItems.filter((i) => selectedAvailableIds.includes(String(i._id)));
    try {
      setBulkAssigning(true);
      await Promise.all(
        selectedItems.map((item) =>
          item.kind === 'interview'
            ? axiosInstance.post(`/vendor-admin/classrooms/${id}/interviews/${item._id}`)
            : axiosInstance.post(`/vendor-admin/classrooms/${id}/tests/${item._id}`)
        )
      );
      setSelectedAvailableIds([]);
      await refreshStats({ silent: true });
      showModal('Success', `Assigned ${selectedItems.length} assessment(s).`, 'success');
      fetchData();
    } catch (error) {
      showModal('Error', error.response?.data?.message || 'Bulk assign failed.', 'error');
    } finally {
      setBulkAssigning(false);
    }
  };

  const handleBulkRemove = async () => {
    if (!selectedAssignedIds.length) return;
    if (!window.confirm(`Remove ${selectedAssignedIds.length} selected assessment(s)?`)) return;
    const selectedItems = assignedItems.filter((i) => selectedAssignedIds.includes(String(i._id)));
    try {
      setBulkRemoving(true);
      await Promise.all(
        selectedItems.map((item) =>
          item.kind === 'interview'
            ? axiosInstance.delete(`/vendor-admin/classrooms/${id}/interviews/${item._id}`)
            : axiosInstance.delete(`/vendor-admin/classrooms/${id}/tests/${item._id}`)
        )
      );
      setSelectedAssignedIds([]);
      showModal('Success', `Removed ${selectedItems.length} assessment(s).`, 'success');
      fetchData();
    } catch (error) {
      showModal('Error', error.response?.data?.message || 'Bulk remove failed.', 'error');
    } finally {
      setBulkRemoving(false);
    }
  };

  const getAssignment = (item) => {
    if (item.kind === 'interview') {
      return (classroom?.assignedInterviews || []).find(
        (ai) => (ai.interviewId?._id || ai.interviewId)?.toString() === item._id.toString()
      );
    }
    return classroom?.assignedTests?.find(
      (at) => (at.testId?._id || at.testId)?.toString() === item._id.toString()
    );
  };

  if (!loading && !classroom) {
    return (
      <VendorAssessPage
        backTo="/vendor-admin/classrooms"
        backLabel="Back to classrooms"
        title="Classroom not found"
        accent="#0891b2"
      >
        <Link to="/vendor-admin/classrooms" className="va-btn va-btn--primary">
          Back to classrooms
        </Link>
      </VendorAssessPage>
    );
  }

  const studentCount = classroom?.students?.length || 0;

  return (
    <VendorAssessPage
      loading={loading}
      backTo="/vendor-admin/classrooms"
      backLabel="Back to classrooms"
      eyebrow="Classroom assignments"
      title={classroom ? `Assign assessments · ${classroom.name}` : 'Assign assessments'}
      subtitle={
        classroom
          ? `${studentCount} student${studentCount !== 1 ? 's' : ''} in this classroom · Pick assessments below and assign in one click.`
          : 'Link tests and interviews to this classroom.'
      }
      accent="#0891b2"
      actions={
        <Link to={`/vendor-admin/classrooms/${id}/students`} className="va-btn va-btn--secondary">
          Manage students
        </Link>
      }
    >
      <Modal isOpen={modal.isOpen} onClose={closeModal} title={modal.title} type={modal.type}>
        <p>{modal.message}</p>
      </Modal>

      {studentCount === 0 && (
        <div className="va-selection-banner" style={{ marginBottom: 16 }}>
          This classroom has no students yet.{' '}
          <Link to={`/vendor-admin/classrooms/${id}/students`}>Add students</Link> before assigning tests.
        </div>
      )}

      <div className="va-atc-filters">
        {TEST_TYPES.map((type) => (
          <button
            key={type}
            type="button"
            className={`va-atc-filter ${testTypeFilter === type ? 'active' : ''}`}
            onClick={() => setTestTypeFilter(type)}
          >
            {TYPE_LABELS[type]}
          </button>
        ))}
      </div>

      <div className="va-search" style={{ marginBottom: 16 }}>
        <FiSearch />
        <input
          type="search"
          placeholder="Search by title, type, or topic…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="va-atc-grid">
        <div className="va-panel">
          <div className="va-panel-header">
            <h2>Available ({filteredAvailable.length})</h2>
            <div className="va-atc-actions">
              <button type="button" className="va-btn va-btn--ghost va-btn--sm" onClick={handleSelectAllAvailableShown}>
                {filteredAvailable.length > 0 &&
                filteredAvailable.every((x) => selectedAvailableIds.includes(x._id))
                  ? <><FiSquare /> Unselect shown</>
                  : <><FiCheckSquare /> Select shown</>}
              </button>
              <button
                type="button"
                className="va-btn va-btn--primary va-btn--sm"
                disabled={!selectedAvailableIds.length || bulkAssigning || studentCount === 0}
                onClick={handleBulkAssign}
              >
                {bulkAssigning ? 'Assigning…' : `Assign selected (${selectedAvailableIds.length})`}
              </button>
            </div>
          </div>
          <div className="va-panel-body va-atc-list">
            {filteredAvailable.length === 0 ? (
              <div className="va-empty">
                <p>Nothing available to assign for this filter.</p>
              </div>
            ) : (
              filteredAvailable.map((item) => (
                <div key={item._id} className="va-atc-item">
                  <div className="va-atc-item-main">
                    <label className="va-atc-check">
                      <input
                        type="checkbox"
                        checked={selectedAvailableIds.includes(String(item._id))}
                        onChange={() => handleToggleAvailable(String(item._id))}
                      />
                      <span>Select</span>
                    </label>
                    <h3>{item.title}</h3>
                    <div className="va-atc-meta">
                      <span className={`va-atc-type va-atc-type--${item.type}`}>{item.type}</span>
                      {item.duration != null && <span>{item.duration} min</span>}
                    </div>
                    {item.kind === 'interview' && item.topic && (
                      <p className="va-cell-muted">Topic: {item.topic}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    className="va-btn va-btn--primary va-btn--sm"
                    disabled={assigningId === item._id || studentCount === 0}
                    onClick={() => handleAssign(item)}
                  >
                    <FiPlus /> {assigningId === item._id ? 'Assigning…' : 'Assign'}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="va-panel">
          <div className="va-panel-header">
            <h2>Assigned ({filteredAssigned.length})</h2>
            <div className="va-atc-actions">
              <button type="button" className="va-btn va-btn--ghost va-btn--sm" onClick={handleSelectAllAssignedShown}>
                {filteredAssigned.length > 0 &&
                filteredAssigned.every((x) => selectedAssignedIds.includes(x._id))
                  ? <><FiSquare /> Unselect shown</>
                  : <><FiCheckSquare /> Select shown</>}
              </button>
              <button
                type="button"
                className="va-btn va-btn--danger va-btn--sm"
                disabled={!selectedAssignedIds.length || bulkRemoving}
                onClick={handleBulkRemove}
              >
                {bulkRemoving ? 'Removing…' : `Remove selected (${selectedAssignedIds.length})`}
              </button>
            </div>
          </div>
          <div className="va-panel-body va-atc-list">
            {filteredAssigned.length === 0 ? (
              <div className="va-empty">
                <p>No assessments assigned yet for this filter.</p>
              </div>
            ) : (
              filteredAssigned.map((item) => {
                const assignment = getAssignment(item);
                return (
                  <div key={item._id} className="va-atc-item va-atc-item--assigned">
                    <div className="va-atc-item-main">
                      <label className="va-atc-check">
                        <input
                          type="checkbox"
                        checked={selectedAssignedIds.includes(String(item._id))}
                        onChange={() => handleToggleAssigned(String(item._id))}
                        />
                        <span>Select</span>
                      </label>
                      <h3>{item.title}</h3>
                      <div className="va-atc-meta">
                        <span className={`va-atc-type va-atc-type--${item.type}`}>{item.type}</span>
                        {item.duration != null && <span>{item.duration} min</span>}
                      </div>
                      {assignment?.assignedAt && (
                        <p className="va-cell-muted">
                          Assigned {new Date(assignment.assignedAt).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      className="va-btn va-btn--danger va-btn--sm"
                      onClick={() => handleRemove(item)}
                      title="Remove from classroom"
                    >
                      <FiTrash2 /> Remove
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </VendorAssessPage>
  );
};

export default AssignTestToClassroom;
