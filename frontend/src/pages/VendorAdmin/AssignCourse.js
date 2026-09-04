import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axiosInstance from '../../utils/axios';
import { useVendorStudents } from '../../hooks/useVendorStudents';
import VendorAssessPage from '../../components/VendorAdmin/VendorAssessPage';
import VendorAssignStudents from '../../components/VendorAdmin/VendorAssignStudents';
import '../../styles/courses-pages.css';

const COURSES_ACCENT = '#0f766e';
const classroomStudentCount = (c) => c?.studentCount ?? c?.students?.length ?? 0;

const AssignCourse = () => {
  const { courseId } = useParams();
  const navigate = useNavigate();
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
  const [course, setCourse] = useState(null);
  const [classrooms, setClassrooms] = useState([]);
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [selectedClassroomIds, setSelectedClassroomIds] = useState([]);
  const [metaLoading, setMetaLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const [courseRes, classroomsRes] = await Promise.all([
          axiosInstance.get(`/vendor-admin/courses/${courseId}`),
          axiosInstance.get('/vendor-admin/classrooms').catch(() => ({ data: [] })),
        ]);
        setCourse(courseRes.data);
        setClassrooms(classroomsRes.data || []);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load course');
      } finally {
        setMetaLoading(false);
      }
    };
    load();
  }, [courseId]);

  const handleAssign = async () => {
    const hasClassrooms = selectedClassroomIds.length > 0;
    const hasStudents = selectedStudents.length > 0;
    if (!hasClassrooms && !hasStudents) {
      setError('Select classrooms or students');
      return;
    }
    if (hasClassrooms) {
      const empty = selectedClassroomIds.filter((cid) => {
        const c = classrooms.find((x) => x._id === cid);
        return classroomStudentCount(c) === 0;
      });
      if (empty.length) {
        setError('One or more selected classrooms have no students.');
        return;
      }
    }

    setAssigning(true);
    setError('');
    try {
      const { data } = await axiosInstance.post(`/vendor-admin/courses/${courseId}/assign`, {
        studentIds: hasStudents ? selectedStudents : [],
        classroomIds: hasClassrooms ? selectedClassroomIds : [],
      });
      navigate(`/vendor-admin/courses/${courseId}`, {
        state: { assigned: data.assigned, created: data.created },
      });
    } catch (err) {
      setError(err.response?.data?.message || 'Assign failed');
    } finally {
      setAssigning(false);
    }
  };

  const assignLabel = useMemo(() => {
    if (assigning) return 'Assigning…';
    if (selectedClassroomIds.length > 0) {
      return `Assign to ${selectedClassroomIds.length} classroom${selectedClassroomIds.length !== 1 ? 's' : ''}`;
    }
    if (selectedStudents.length > 0) {
      return `Assign to ${selectedStudents.length} student${selectedStudents.length !== 1 ? 's' : ''}`;
    }
    return 'Assign course';
  }, [assigning, selectedClassroomIds.length, selectedStudents.length]);

  const moduleCount = course?.modules?.length || 0;
  const lectureCount = (course?.modules || []).reduce(
    (n, m) => n + (m.lectures?.length || m.lectureCount || 0),
    0
  );

  return (
    <VendorAssessPage
      loading={metaLoading}
      backTo={`/vendor-admin/courses/${courseId}`}
      backLabel="Back to course"
      eyebrow="Assign course"
      title={course?.title ? `Assign: ${course.title}` : 'Assign course'}
      subtitle={
        course
          ? `${moduleCount} modules · ${lectureCount} lectures · ${
              course.unlockMode === 'open' ? 'all modules open' : 'unlock in order'
            } · Assign to a classroom or pick individual students.`
          : 'Assign to a classroom or select students who should see this course.'
      }
      accent={COURSES_ACCENT}
      className="courses-page"
    >
      {error && <p className="vh-error">{error}</p>}
      <VendorAssignStudents
        students={students}
        classrooms={classrooms}
        selectedStudents={selectedStudents}
        onToggleStudent={(id) => {
          setSelectedClassroomIds([]);
          setError('');
          setSelectedStudents((prev) =>
            prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
          );
        }}
        selectedClassroomIds={selectedClassroomIds}
        onToggleClassroom={(id) => {
          setSelectedStudents([]);
          setError('');
          setSelectedClassroomIds((prev) =>
            prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
          );
        }}
        onClearClassrooms={() => setSelectedClassroomIds([])}
        onAssign={handleAssign}
        onCancelTo={`/vendor-admin/courses/${courseId}`}
        assignLabel={assignLabel}
        assigning={assigning}
        accent={COURSES_ACCENT}
        assignEntityLabel="course"
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

export default AssignCourse;
