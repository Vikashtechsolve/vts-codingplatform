import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axiosInstance from '../../utils/axios';
import { useVendorPanel } from '../../context/VendorPanelContext';
import VendorAssessPage from '../../components/VendorAdmin/VendorAssessPage';
import VendorAssignStudents from '../../components/VendorAdmin/VendorAssignStudents';
import { getVendorTestTypeAccent, getVendorTestTypeLabel } from '../../utils/vendorTestTypeUi';

const AssignTest = () => {
  const { testId } = useParams();
  const navigate = useNavigate();
  const { refreshStats } = useVendorPanel();
  const [test, setTest] = useState(null);
  const [students, setStudents] = useState([]);
  const [classrooms, setClassrooms] = useState([]);
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [selectedClassroomIds, setSelectedClassroomIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const [studentsRes, testRes, classroomsRes] = await Promise.all([
          axiosInstance.get('/vendor-admin/students'),
          axiosInstance.get(`/tests/${testId}`).catch(() => ({ data: null })),
          axiosInstance.get('/vendor-admin/classrooms').catch(() => ({ data: [] })),
        ]);
        setStudents(studentsRes.data || []);
        setTest(testRes.data);
        setClassrooms(classroomsRes.data || []);
      } catch (error) {
        console.error('Error loading assign page:', error);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [testId]);

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
    if (hasClassrooms) {
      const empty = selectedClassroomIds.filter((cid) => {
        const c = classrooms.find((x) => x._id === cid);
        return !c?.students?.length;
      });
      if (empty.length > 0) {
        alert('One or more selected classrooms have no students.');
        return;
      }
    }

    setAssigning(true);
    try {
      const { data } = await axiosInstance.post(`/tests/${testId}/assign`, {
        studentIds: hasStudents ? selectedStudents : [],
        classroomIds: hasClassrooms ? selectedClassroomIds : [],
      });
      await refreshStats({ silent: true });
      alert(data.message || 'Test assigned successfully');
      navigate(`/vendor-admin/tests/${testId}/results`);
    } catch (error) {
      alert(error.response?.data?.message || 'Error assigning test');
    } finally {
      setAssigning(false);
    }
  };

  const accent = getVendorTestTypeAccent(test?.type);
  const backType = test?.type ? `?type=${test.type}` : '';
  const typeLabel = getVendorTestTypeLabel(test?.type);

  const assignLabel = useMemo(() => {
    if (assigning) return 'Assigning…';
    if (selectedClassroomIds.length > 0) {
      return `Assign to ${selectedClassroomIds.length} classroom${selectedClassroomIds.length !== 1 ? 's' : ''}`;
    }
    if (selectedStudents.length > 0) {
      return `Assign to ${selectedStudents.length} student${selectedStudents.length !== 1 ? 's' : ''}`;
    }
    return 'Assign test';
  }, [assigning, selectedClassroomIds.length, selectedStudents.length]);

  return (
    <VendorAssessPage
      loading={loading}
      backTo={`/vendor-admin/tests${backType}`}
      backLabel="Back to tests"
      eyebrow={`Assign · ${typeLabel}`}
      title={test?.title ? `Assign: ${test.title}` : 'Assign test'}
      subtitle={
        test
          ? `${typeLabel} · ${test.duration || '—'} min · Assign to a whole classroom or pick individual students.`
          : 'Assign to a classroom or select students who should see this test on their dashboard.'
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
        onCancelTo={`/vendor-admin/tests${backType}`}
        assignLabel={assignLabel}
        assigning={assigning}
        accent={accent}
        assignEntityLabel="test"
      />
    </VendorAssessPage>
  );
};

export default AssignTest;
