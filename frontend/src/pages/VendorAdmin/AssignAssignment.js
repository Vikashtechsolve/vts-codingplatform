import React, { useState, useEffect, useCallback } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import axiosInstance from '../../utils/axios';
import { useVendorPanel } from '../../context/VendorPanelContext';
import { useVendorStudents } from '../../hooks/useVendorStudents';
import VendorAssessPage from '../../components/VendorAdmin/VendorAssessPage';
import VendorAssignStudents from '../../components/VendorAdmin/VendorAssignStudents';

const AssignAssignment = () => {
  const { id: assignmentId } = useParams();
  const navigate = useNavigate();
  const { refreshStats } = useVendorPanel();
  const {
    students,
    refreshing: studentsRefreshing,
    loadingMore,
    hasMore,
    total,
    search,
    setSearch,
    loadMore,
  } = useVendorStudents();
  const [assignment, setAssignment] = useState(null);
  const [classrooms, setClassrooms] = useState([]);
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [selectedClassroomIds, setSelectedClassroomIds] = useState([]);
  const [metaLoading, setMetaLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setMetaLoading(true);
      const [assignmentRes, classroomsRes] = await Promise.all([
        axiosInstance.get(`/assignments/${assignmentId}`),
        axiosInstance.get('/vendor-admin/classrooms').catch(() => ({ data: [] })),
      ]);
      if (assignmentRes.data?.success) setAssignment(assignmentRes.data.assignment);
      setClassrooms(classroomsRes.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      alert(error.response?.data?.message || 'Failed to load data');
    } finally {
      setMetaLoading(false);
    }
  }, [assignmentId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleToggleStudent = (studentId) => {
    setSelectedClassroomIds([]);
    setSelectedStudents((prev) =>
      prev.includes(studentId) ? prev.filter((id) => id !== studentId) : [...prev, studentId]
    );
  };

  const handleToggleClassroom = (classroomId) => {
    setSelectedStudents([]);
    setSelectedClassroomIds((prev) =>
      prev.includes(classroomId) ? prev.filter((id) => id !== classroomId) : [...prev, classroomId]
    );
  };

  const handleClearClassrooms = () => setSelectedClassroomIds([]);

  const handleAssign = async () => {
    const hasStudents = selectedStudents.length > 0;
    const hasClassrooms = selectedClassroomIds.length > 0;
    if (!hasStudents && !hasClassrooms) {
      alert('Select one or more classrooms or at least one student');
      return;
    }
    setAssigning(true);
    try {
      const payload = hasClassrooms
        ? { classroomIds: selectedClassroomIds }
        : { studentIds: selectedStudents };
      const { data } = await axiosInstance.post(`/assignments/${assignmentId}/assign`, payload);
      if (data.success) {
        await refreshStats({ silent: true });
        navigate(`/vendor-admin/assignments/${assignmentId}/submissions`);
      } else {
        alert(data.message || 'Failed to assign');
      }
    } catch (error) {
      alert(error.response?.data?.message || 'Error assigning assignment');
    } finally {
      setAssigning(false);
    }
  };

  const accent = '#6366f1';

  const loading = metaLoading;

  if (!loading && !assignment) {
    return (
      <VendorAssessPage
        backTo="/vendor-admin/tests?type=project"
        backLabel="Back"
        title="Assignment not found"
        accent={accent}
      >
        <Link to="/vendor-admin/tests?type=project" className="va-btn va-btn--secondary">
          Return to projects
        </Link>
      </VendorAssessPage>
    );
  }

  if (!loading && assignment?.status === 'archived') {
    return (
      <VendorAssessPage
        backTo="/vendor-admin/tests?type=project"
        backLabel="Back"
        title="Cannot assign"
        subtitle="This assignment is archived and cannot be assigned to students."
        accent={accent}
      />
    );
  }

  return (
    <VendorAssessPage
      loading={loading}
      backTo="/vendor-admin/tests?type=project"
      backLabel="Back to projects"
      eyebrow="Project evaluation (AI)"
      title={assignment ? `Assign: ${assignment.title}` : 'Assign project'}
      subtitle="Assign to a whole classroom or pick individual students. AI evaluation runs after they submit their repository."
      accent={accent}
    >
      <VendorAssignStudents
        students={students}
        classrooms={classrooms}
        selectedStudents={selectedStudents}
        onToggleStudent={handleToggleStudent}
        selectedClassroomIds={selectedClassroomIds}
        onToggleClassroom={handleToggleClassroom}
        onClearClassrooms={handleClearClassrooms}
        onAssign={handleAssign}
        onCancelTo="/vendor-admin/tests?type=project"
        assignLabel={
          assigning
            ? 'Assigning…'
            : selectedClassroomIds.length > 0
              ? `Assign to ${selectedClassroomIds.length} classroom${selectedClassroomIds.length !== 1 ? 's' : ''}`
              : selectedStudents.length > 0
                ? `Assign to ${selectedStudents.length} student${selectedStudents.length !== 1 ? 's' : ''}`
                : 'Assign project'
        }
        assigning={assigning}
        accent={accent}
        assignEntityLabel="project"
        studentSearch={search}
        onStudentSearchChange={setSearch}
        refreshingStudents={studentsRefreshing}
        hasMoreStudents={hasMore}
        loadingMoreStudents={loadingMore}
        onLoadMoreStudents={loadMore}
        totalStudents={total}
      />
    </VendorAssessPage>
  );
};

export default AssignAssignment;
