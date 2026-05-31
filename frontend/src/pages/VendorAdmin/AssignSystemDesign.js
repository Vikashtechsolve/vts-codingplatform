import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Link } from 'react-router-dom';
import axiosInstance from '../../utils/axios';
import { useVendorPanel } from '../../context/VendorPanelContext';
import VendorAssessPage from '../../components/VendorAdmin/VendorAssessPage';
import VendorAssignStudents from '../../components/VendorAdmin/VendorAssignStudents';

const AssignSystemDesign = () => {
  const { id: problemId } = useParams();
  const navigate = useNavigate();
  const { refreshStats } = useVendorPanel();
  const [problem, setProblem] = useState(null);
  const [students, setStudents] = useState([]);
  const [classrooms, setClassrooms] = useState([]);
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [selectedClassroomIds, setSelectedClassroomIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [problemRes, studentsRes, classroomsRes] = await Promise.all([
        axiosInstance.get(`/system-design-problems/${problemId}`),
        axiosInstance.get('/vendor-admin/students'),
        axiosInstance.get('/vendor-admin/classrooms').catch(() => ({ data: [] })),
      ]);
      if (problemRes.data?.success) setProblem(problemRes.data.problem);
      setStudents(studentsRes.data || []);
      setClassrooms(classroomsRes.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      alert('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [problemId]);

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
      const { data } = await axiosInstance.post(`/system-design-problems/${problemId}/assign`, {
        studentIds: hasStudents ? selectedStudents : [],
        classroomIds: hasClassrooms ? selectedClassroomIds : [],
      });
      if (data.success) {
        await refreshStats({ silent: true });
        navigate(`/vendor-admin/system-designs/${problemId}/submissions`);
      } else {
        alert(data.message || 'Failed to assign');
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to assign');
    } finally {
      setAssigning(false);
    }
  };

  const accent = '#ea580c';

  if (!loading && !problem) {
    return (
      <VendorAssessPage
        backTo="/vendor-admin/tests?type=system"
        backLabel="Back"
        title="Problem not found"
        accent={accent}
      >
        <Link to="/vendor-admin/tests?type=system" className="va-btn va-btn--secondary">
          Return to system design
        </Link>
      </VendorAssessPage>
    );
  }

  return (
    <VendorAssessPage
      loading={loading}
      backTo="/vendor-admin/tests?type=system"
      backLabel="Back to system design"
      eyebrow="System design"
      title={problem ? `Assign: ${problem.title}` : 'Assign problem'}
      subtitle={
        problem
          ? `${problem.category?.replace(/_/g, ' ')} · ${problem.difficulty} · ${problem.duration} min`
          : 'Select students or a classroom for this architecture assessment.'
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
        onCancelTo="/vendor-admin/tests?type=system"
        assignLabel={
          assigning
            ? 'Assigning…'
            : selectedClassroomIds.length > 0
              ? `Assign to ${selectedClassroomIds.length} classroom${selectedClassroomIds.length !== 1 ? 's' : ''}`
              : selectedStudents.length > 0
                ? `Assign to ${selectedStudents.length} student${selectedStudents.length !== 1 ? 's' : ''}`
                : 'Assign problem'
        }
        assigning={assigning}
        accent={accent}
        assignEntityLabel="system design problem"
      />
    </VendorAssessPage>
  );
};

export default AssignSystemDesign;
