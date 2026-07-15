import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axiosInstance from '../../utils/axios';
import { useVendorPanel } from '../../context/VendorPanelContext';
import { useVendorStudents } from '../../hooks/useVendorStudents';
import VendorAssessPage from '../../components/VendorAdmin/VendorAssessPage';
import VendorAssignStudents from '../../components/VendorAdmin/VendorAssignStudents';
import { getVendorTestTypeAccent } from '../../utils/vendorTestTypeUi';

const AssignInterview = () => {
  const { interviewId } = useParams();
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
  const [interview, setInterview] = useState(null);
  const [classrooms, setClassrooms] = useState([]);
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [selectedClassroomIds, setSelectedClassroomIds] = useState([]);
  const [metaLoading, setMetaLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const [interviewRes, classroomsRes] = await Promise.all([
          axiosInstance.get(`/interviews/${interviewId}`).catch(() => ({ data: null })),
          axiosInstance.get('/vendor-admin/classrooms').catch(() => ({ data: [] })),
        ]);
        setInterview(interviewRes.data);
        setClassrooms(classroomsRes.data || []);
      } catch (error) {
        console.error('Error loading assign page:', error);
      } finally {
        setMetaLoading(false);
      }
    };
    load();
  }, [interviewId]);

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
    const hasClassrooms = selectedClassroomIds.length > 0;
    const hasStudents = selectedStudents.length > 0;
    if (!hasClassrooms && !hasStudents) {
      alert('Select one or more classrooms or at least one student');
      return;
    }

    setAssigning(true);
    try {
      const { data } = await axiosInstance.post(`/interviews/${interviewId}/assign`, {
        studentIds: hasStudents ? selectedStudents : [],
        classroomIds: hasClassrooms ? selectedClassroomIds : [],
      });
      await refreshStats({ silent: true });
      alert(data.message || 'Interview assigned successfully');
      navigate(`/vendor-admin/interviews/${interviewId}/results`);
    } catch (error) {
      alert(error.response?.data?.message || 'Error assigning interview');
    } finally {
      setAssigning(false);
    }
  };

  const accent = getVendorTestTypeAccent('interview');

  const assignLabel = useMemo(() => {
    if (assigning) return 'Assigning…';
    if (selectedClassroomIds.length > 0) {
      return `Assign to ${selectedClassroomIds.length} classroom${selectedClassroomIds.length !== 1 ? 's' : ''}`;
    }
    if (selectedStudents.length > 0) {
      return `Assign to ${selectedStudents.length} student${selectedStudents.length !== 1 ? 's' : ''}`;
    }
    return 'Assign interview';
  }, [assigning, selectedClassroomIds.length, selectedStudents.length]);

  return (
    <VendorAssessPage
      loading={metaLoading}
      backTo="/vendor-admin/tests?type=interview"
      backLabel="Back to interviews"
      eyebrow="Assign · Interview"
      title={interview?.title ? `Assign: ${interview.title}` : 'Assign interview'}
      subtitle={
        interview
          ? `${interview.interviewType} · ${interview.topic} · ${interview.difficulty} · ${interview.duration} min · Classroom or individual students.`
          : 'Assign to a classroom or select students for this mock interview.'
      }
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
        onCancelTo="/vendor-admin/tests?type=interview"
        assignLabel={assignLabel}
        assigning={assigning}
        accent={accent}
        assignEntityLabel="interview"
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

export default AssignInterview;
