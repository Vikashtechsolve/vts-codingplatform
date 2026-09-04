import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { FiArrowLeft } from 'react-icons/fi';
import axiosInstance from '../../utils/axios';
import { studentRouteForAssessmentType } from '../../utils/courseAssessment';
import CourseLectureWatchView from '../../components/Courses/CourseLectureWatchView';
import useCourseLectureWatch from '../../hooks/useCourseLectureWatch';
import { STUDENT_SECTIONS } from '../../constants/studentSections';
import '../../styles/courses-pages.css';
import '../Student/Dashboard.css';

const COURSES_ACCENT = STUDENT_SECTIONS.find((s) => s.id === 'courses')?.accent || '#0f766e';

const LecturePlayer = () => {
  const { courseId, lectureId } = useParams();
  const navigate = useNavigate();
  const {
    booting,
    switching,
    error,
    lecture,
    progress,
    playlistUrl,
    resumePosition,
    outline,
  } = useCourseLectureWatch({ courseId, lectureId, role: 'student' });
  const [watchInfo, setWatchInfo] = useState(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  useEffect(() => {
    setWatchInfo(null);
  }, [lectureId]);

  useEffect(() => {
    if (!lecture?.hasNotesHtml && !lecture?.hasNotesPdf) return undefined;
    let cancelled = false;
    axiosInstance
      .post(`/student/courses/${courseId}/lectures/${lectureId}/open-notes`)
      .then(({ data }) => {
        if (!cancelled) {
          setWatchInfo((w) => ({
            ...w,
            completed: data.completed,
            percentComplete: data.percentComplete,
          }));
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [courseId, lectureId, lecture?.hasNotesHtml, lecture?.hasNotesPdf]);

  const goLecture = (id) => {
    if (!id || String(id) === String(lectureId)) return;
    navigate(`/student/courses/${courseId}/lectures/${id}`, { preventScrollReset: true });
  };

  const downloadNotes = async () => {
    setPdfLoading(true);
    try {
      const { data } = await axiosInstance.get(
        `/student/courses/${courseId}/lectures/${lectureId}/notes-pdf`
      );
      window.open(data.url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      alert(err.response?.data?.message || 'Download failed');
    } finally {
      setPdfLoading(false);
    }
  };

  const startQuiz = async (moduleId) => {
    try {
      const { data: start } = await axiosInstance.post(
        `/student/courses/${courseId}/modules/${moduleId}/quiz/start`
      );
      const type = start.assessmentType || 'test';
      const assessmentId = start.assessmentId || start.testId;
      const route = studentRouteForAssessmentType(type, assessmentId, courseId, moduleId, start.type);
      if (!route) {
        alert('Assessment is not available for this module.');
        return;
      }
      navigate(route);
    } catch (err) {
      alert(err.response?.data?.message || 'Cannot start assessment');
    }
  };

  if (booting) {
    return (
      <div className="courses-student-page" style={{ '--courses-accent': COURSES_ACCENT }}>
        <div className="clw-skeleton" aria-busy="true">
          <div className="clw-skeleton-video" />
          <div className="clw-skeleton-side" />
        </div>
      </div>
    );
  }

  if (error && !lecture) {
    return (
      <div className="courses-student-page student-page">
        <div className="student-empty-card">
          <p>{error}</p>
          <Link to={`/student/courses/${courseId}`} className="section-back">
            <FiArrowLeft /> Back to course
          </Link>
        </div>
      </div>
    );
  }

  const watched = watchInfo?.watchedSecondsUnique ?? progress?.watchedSecondsUnique ?? 0;
  const durationSec = watchInfo?.durationSec ?? progress?.durationSec ?? lecture?.video?.durationSec ?? 0;
  const isComplete = watchInfo?.completed || progress?.completedAt;

  return (
    <div className="courses-student-page" style={{ '--courses-accent': COURSES_ACCENT }}>
      <CourseLectureWatchView
        courseTitle={outline?.course?.title}
        backTo={`/student/courses/${courseId}`}
        backLabel="Course outline"
        modules={outline?.modules || []}
        lecture={lecture}
        lectureId={lectureId}
        courseId={courseId}
        playlistUrl={playlistUrl}
        resumePosition={resumePosition}
        switching={switching}
        onSelectLecture={goLecture}
        onStartQuiz={startQuiz}
        onDownloadPdf={downloadNotes}
        onProgress={setWatchInfo}
        enableHeartbeat
        watchedSeconds={watched}
        durationSec={durationSec}
        isComplete={!!isComplete}
        pdfLoading={pdfLoading}
      />
    </div>
  );
};

export default LecturePlayer;
