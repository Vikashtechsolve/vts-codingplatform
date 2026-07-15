import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { FiPlus, FiTrash2, FiCheckSquare, FiSquare, FiSearch } from 'react-icons/fi';
import axiosInstance from '../../utils/axios';
import { useVendorPanel } from '../../context/VendorPanelContext';
import VendorHubPage from '../../components/VendorAdmin/VendorHubPage';
import VendorLoadMore from '../../components/VendorAdmin/VendorLoadMore';
import VendorDataSection from '../../components/VendorAdmin/VendorDataSection';
import { normalizePaginatedResponse, mergePaginatedPages } from '../../utils/paginatedApi';
import { useListFetchLoading } from '../../hooks/useListFetchLoading';
import Modal from '../../components/Modal';
import { formatTopicsCardPreview } from '../../utils/interviewCardText';
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
  const [availablePool, setAvailablePool] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [classroomLoading, setClassroomLoading] = useState(true);
  const classroomLoadedRef = useRef(false);
  const {
    refreshing: listRefreshing,
    loadingMore,
    beginFetch,
    endFetch,
  } = useListFetchLoading({ startInLoading: false });
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [modal, setModal] = useState({ isOpen: false, title: '', message: '', type: 'info' });
  const [assigningId, setAssigningId] = useState(null);
  const [bulkAssigning, setBulkAssigning] = useState(false);
  const [bulkRemoving, setBulkRemoving] = useState(false);
  const [testTypeFilter, setTestTypeFilter] = useState('all');
  const [selectedAvailableIds, setSelectedAvailableIds] = useState([]);
  const [selectedAssignedIds, setSelectedAssignedIds] = useState([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    fetchClassroom();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run when classroom id changes
  }, [id]);

  useEffect(() => {
    if (classroom) {
      fetchAvailable({ pageNum: 1, append: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classroom, testTypeFilter, debouncedSearch]);

  const showModal = (title, message, type = 'info') => {
    setModal({ isOpen: true, title, message, type });
  };

  const closeModal = () => {
    setModal({ isOpen: false, title: '', message: '', type: 'info' });
  };

  const fetchClassroom = async () => {
    try {
      if (!classroomLoadedRef.current) setClassroomLoading(true);
      const classroomRes = await axiosInstance.get(`/vendor-admin/classrooms/${id}`);
      setClassroom(classroomRes.data);
      classroomLoadedRef.current = true;
    } catch (error) {
      console.error('Error fetching data:', error);
      showModal('Error', error.response?.data?.message || 'Failed to load data.', 'error');
    } finally {
      setClassroomLoading(false);
    }
  };

  const fetchAvailable = async ({ pageNum = 1, append = false } = {}) => {
    try {
      beginFetch(append);
      const searchParam = debouncedSearch.trim() || undefined;
      const params = { page: pageNum, limit: 30, search: searchParam };
      const assignedTestIds = (classroom?.assignedTests || [])
        .map((at) => (at.testId?._id || at.testId)?.toString())
        .filter(Boolean);
      const assignedInterviewIds = (classroom?.assignedInterviews || [])
        .map((ai) => (ai.interviewId?._id || ai.interviewId)?.toString())
        .filter(Boolean);

      let nextItems = [];
      let nextHasMore = false;

      if (testTypeFilter === 'interview') {
        const res = await axiosInstance.get('/interviews', { params });
        const parsed = normalizePaginatedResponse(res.data);
        nextItems = parsed.items
          .filter((i) => !assignedInterviewIds.includes(String(i._id)))
          .map((i) => ({
            _id: i._id,
            title: i.title,
            type: 'interview',
            kind: 'interview',
            duration: i.duration,
            topic: i.topic,
            description: i.description,
          }));
        nextHasMore = parsed.hasMore;
      } else if (testTypeFilter === 'all') {
        const [testsRes, interviewsRes] = await Promise.all([
          axiosInstance.get('/vendor-admin/tests', { params }),
          axiosInstance.get('/interviews', { params }).catch(() => ({ data: { items: [] } })),
        ]);
        const parsedTests = normalizePaginatedResponse(testsRes.data);
        const parsedInterviews = normalizePaginatedResponse(interviewsRes.data);
        nextItems = [
          ...parsedTests.items
            .filter((t) => !assignedTestIds.includes(String(t._id)))
            .map((t) => ({ ...t, kind: 'test' })),
          ...parsedInterviews.items
            .filter((i) => !assignedInterviewIds.includes(String(i._id)))
            .map((i) => ({
              _id: i._id,
              title: i.title,
              type: 'interview',
              kind: 'interview',
              duration: i.duration,
              topic: i.topic,
              description: i.description,
            })),
        ];
        nextHasMore = parsedTests.hasMore || parsedInterviews.hasMore;
      } else {
        const res = await axiosInstance.get('/vendor-admin/tests', {
          params: { ...params, type: testTypeFilter },
        });
        const parsed = normalizePaginatedResponse(res.data);
        nextItems = parsed.items
          .filter((t) => !assignedTestIds.includes(String(t._id)))
          .map((t) => ({ ...t, kind: 'test' }));
        nextHasMore = parsed.hasMore;
      }

      setAvailablePool((prev) => (append ? mergePaginatedPages(prev, nextItems) : nextItems));
      setPage(pageNum);
      setHasMore(nextHasMore);
    } catch (error) {
      console.error('Error fetching available assessments:', error);
    } finally {
      endFetch();
    }
  };

  const fetchData = async () => {
    await fetchClassroom();
    await fetchAvailable({ pageNum: 1, append: false });
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

  const assignedItems = useMemo(() => {
    const testItems = (classroom?.assignedTests || [])
      .map((at) => {
        const t = at.testId && typeof at.testId === 'object' ? at.testId : { _id: at.testId };
        return t?._id ? { ...t, kind: 'test' } : null;
      })
      .filter(Boolean);
    const interviewItems = (classroom?.assignedInterviews || [])
      .map((ai) => {
        const i = ai.interviewId && typeof ai.interviewId === 'object' ? ai.interviewId : { _id: ai.interviewId };
        if (!i?._id) return null;
        return {
          _id: i._id,
          title: i.title,
          type: 'interview',
          kind: 'interview',
          duration: i.duration,
          topic: i.topic,
        };
      })
      .filter(Boolean);
    return [...testItems, ...interviewItems];
  }, [classroom]);

  const availableItems = availablePool;

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

  const filteredAvailable = availableItems;

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

  if (!classroomLoading && !classroom) {
    return (
      <VendorHubPage
        className="va-atc-page"
        backTo="/vendor-admin/classrooms"
        backLabel="Back to classrooms"
        title="Classroom not found"
        accent="#0891b2"
      >
        <Link to="/vendor-admin/classrooms" className="vh-btn vh-btn--primary">
          Back to classrooms
        </Link>
      </VendorHubPage>
    );
  }

  const studentCount = classroom?.students?.length || 0;

  return (
    <VendorHubPage
      className="va-atc-page"
      loading={classroomLoading && !classroom}
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
        <Link to={`/vendor-admin/classrooms/${id}/students`} className="vh-btn vh-btn--secondary">
          Manage students
        </Link>
      }
    >
      <Modal isOpen={modal.isOpen} onClose={closeModal} title={modal.title} type={modal.type}>
        <p>{modal.message}</p>
      </Modal>

      {studentCount === 0 && (
        <div className="vh-alert vh-alert--warning" style={{ marginBottom: 16 }}>
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

      <div className="vh-search va-atc-search">
        <FiSearch />
        <input
          type="search"
          placeholder="Search by title, type, or topic…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="va-atc-grid">
        <div className="vh-panel">
          <div className="vh-panel-head">
            <div>
              <h2 className="vh-panel-title">Available ({filteredAvailable.length})</h2>
            </div>
            <div className="va-atc-actions">
              <button type="button" className="vh-btn vh-btn--ghost vh-btn--sm" onClick={handleSelectAllAvailableShown}>
                {filteredAvailable.length > 0 &&
                filteredAvailable.every((x) => selectedAvailableIds.includes(x._id))
                  ? <><FiSquare /> Unselect shown</>
                  : <><FiCheckSquare /> Select shown</>}
              </button>
              <button
                type="button"
                className="vh-btn vh-btn--primary vh-btn--sm"
                disabled={!selectedAvailableIds.length || bulkAssigning || studentCount === 0}
                onClick={handleBulkAssign}
              >
                {bulkAssigning ? 'Assigning…' : `Assign selected (${selectedAvailableIds.length})`}
              </button>
            </div>
          </div>
          <div className="vh-panel-body va-atc-list">
            <VendorDataSection refreshing={listRefreshing}>
            {filteredAvailable.length === 0 && !listRefreshing ? (
              <div className="vh-empty">
                <p>Nothing available to assign for this filter.</p>
              </div>
            ) : (
              <>
              {filteredAvailable.map((item) => (
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
                      <p className="vh-cell-muted" title={item.topic}>
                        Topic: {formatTopicsCardPreview(item.topic)}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    className="vh-btn vh-btn--primary vh-btn--sm"
                    disabled={assigningId === item._id || studentCount === 0}
                    onClick={() => handleAssign(item)}
                  >
                    <FiPlus /> {assigningId === item._id ? 'Assigning…' : 'Assign'}
                  </button>
                </div>
              ))}
              <VendorLoadMore
                hasMore={hasMore}
                loading={loadingMore || listRefreshing}
                loadedCount={filteredAvailable.length}
                onLoadMore={() => fetchAvailable({ pageNum: page + 1, append: true })}
              />
              </>
            )}
            </VendorDataSection>
          </div>
        </div>

        <div className="vh-panel">
          <div className="vh-panel-head">
            <div>
              <h2 className="vh-panel-title">Assigned ({filteredAssigned.length})</h2>
            </div>
            <div className="va-atc-actions">
              <button type="button" className="vh-btn vh-btn--ghost vh-btn--sm" onClick={handleSelectAllAssignedShown}>
                {filteredAssigned.length > 0 &&
                filteredAssigned.every((x) => selectedAssignedIds.includes(x._id))
                  ? <><FiSquare /> Unselect shown</>
                  : <><FiCheckSquare /> Select shown</>}
              </button>
              <button
                type="button"
                className="vh-btn vh-btn--danger vh-btn--sm"
                disabled={!selectedAssignedIds.length || bulkRemoving}
                onClick={handleBulkRemove}
              >
                {bulkRemoving ? 'Removing…' : `Remove selected (${selectedAssignedIds.length})`}
              </button>
            </div>
          </div>
          <div className="vh-panel-body va-atc-list">
            {filteredAssigned.length === 0 ? (
              <div className="vh-empty">
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
                        <p className="vh-cell-muted">
                          Assigned {new Date(assignment.assignedAt).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      className="vh-btn vh-btn--danger vh-btn--sm"
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
    </VendorHubPage>
  );
};

export default AssignTestToClassroom;
