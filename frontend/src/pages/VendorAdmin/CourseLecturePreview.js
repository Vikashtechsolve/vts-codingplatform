import React, { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { FiArrowLeft } from 'react-icons/fi';
import axiosInstance from '../../utils/axios';
import CourseLectureWatchView from '../../components/Courses/CourseLectureWatchView';
import useCourseLectureWatch from '../../hooks/useCourseLectureWatch';
import '../../styles/courses-pages.css';

const COURSES_ACCENT = '#0f766e';

const VendorCourseLecturePreview = () => {
  const { courseId, lectureId } = useParams();
  const navigate = useNavigate();
  const {
    booting,
    switching,
    error,
    lecture,
    playlistUrl,
    resumePosition,
    outline,
  } = useCourseLectureWatch({ courseId, lectureId, role: 'vendor' });
  const [pdfLoading, setPdfLoading] = useState(false);

  const goLecture = (id) => {
    if (!id || String(id) === String(lectureId)) return;
    navigate(`/vendor-admin/courses/${courseId}/lectures/${id}`, { preventScrollReset: true });
  };

  const downloadNotes = async () => {
    setPdfLoading(true);
    try {
      const { data: pdf } = await axiosInstance.get(
        `/vendor-admin/courses/${courseId}/lectures/${lectureId}/notes-pdf`
      );
      window.open(pdf.url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      alert(err.response?.data?.message || 'Download failed');
    } finally {
      setPdfLoading(false);
    }
  };

  if (booting) {
    return (
      <div className="courses-page clw-vendor-page" style={{ '--courses-accent': COURSES_ACCENT }}>
        <div className="clw-skeleton" aria-busy="true">
          <div className="clw-skeleton-video" />
          <div className="clw-skeleton-side" />
        </div>
      </div>
    );
  }

  if (error && !lecture) {
    return (
      <div className="courses-page" style={{ '--courses-accent': COURSES_ACCENT, padding: 24 }}>
        <p className="vh-error">{error}</p>
        <Link to={`/vendor-admin/courses/${courseId}`} className="section-back">
          <FiArrowLeft /> Back to course
        </Link>
      </div>
    );
  }

  const modules = (outline?.modules || []).map((m) => ({ ...m, unlocked: true }));

  return (
    <div className="courses-page clw-vendor-page" style={{ '--courses-accent': COURSES_ACCENT }}>
      <CourseLectureWatchView
        courseTitle={outline?.course?.title}
        backTo={`/vendor-admin/courses/${courseId}`}
        backLabel="Course"
        modules={modules}
        lecture={lecture}
        lectureId={lectureId}
        courseId={courseId}
        playlistUrl={playlistUrl}
        resumePosition={resumePosition}
        switching={switching}
        onSelectLecture={goLecture}
        onDownloadPdf={downloadNotes}
        enableHeartbeat={false}
        previewBanner="Vendor preview — students see the same video and notes. Progress is not recorded."
        pdfLoading={pdfLoading}
      />
    </div>
  );
};

export default VendorCourseLecturePreview;
