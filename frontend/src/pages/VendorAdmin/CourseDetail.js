import React, { useCallback, useMemo, useState, useEffect } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import {
  FiBarChart2,
  FiBook,
  FiCheckCircle,
  FiEdit3,
  FiSave,
  FiSearch,
  FiTrash2,
  FiUsers,
} from 'react-icons/fi';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import axiosInstance from '../../utils/axios';
import VendorHubPage from '../../components/VendorAdmin/VendorHubPage';
import VendorCourseCurriculum from '../../components/Courses/VendorCourseCurriculum';
import '../../styles/courses-pages.css';

const COURSES_ACCENT = '#0f766e';

const progressBucket = (pct) => {
  if (pct >= 100) return 'completed';
  if (pct > 0) return 'inProgress';
  return 'notStarted';
};

const VendorCourseDetail = () => {
  const { courseId } = useParams();
  const location = useLocation();
  const [tab, setTab] = useState('overview');
  const [course, setCourse] = useState(null);
  const [enrollments, setEnrollments] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [visibility, setVisibility] = useState('visible');
  const [dueAt, setDueAt] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');
  const [unassigningId, setUnassigningId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Enrollments failing (e.g. allocation edge cases) must not blank
      // the whole page — the course view is still useful without them.
      const [{ data }, enrResult] = await Promise.all([
        axiosInstance.get(`/vendor-admin/courses/${courseId}`),
        axiosInstance
          .get(`/vendor-admin/courses/${courseId}/enrollments`, {
            params: { page: 1, limit: 100 },
          })
          .catch(() => null),
      ]);
      setCourse(data);
      setVisibility(data.allocation?.visibility || 'visible');
      setDueAt(
        data.allocation?.dueAt
          ? new Date(data.allocation.dueAt).toISOString().slice(0, 16)
          : ''
      );
      setEnrollments(enrResult?.data?.items || []);
      setSummary(enrResult?.data?.summary || null);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (location.state?.assigned != null) {
      setMessage(`Assigned ${location.state.assigned} student(s)`);
      window.history.replaceState({}, '');
      const t = window.setTimeout(() => setMessage(''), 4000);
      return () => window.clearTimeout(t);
    }
    return undefined;
  }, [location.state]);

  const saveSettings = async () => {
    setSaving(true);
    try {
      await axiosInstance.patch(`/vendor-admin/courses/${courseId}/settings`, {
        visibility,
        dueAt: dueAt || null,
      });
      setMessage('Settings saved');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const unassign = async (studentId) => {
    if (!window.confirm('Remove this student from the course?')) return;
    setUnassigningId(studentId);
    try {
      await axiosInstance.post(`/vendor-admin/courses/${courseId}/unassign`, {
        studentIds: [studentId],
      });
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not unassign');
    } finally {
      setUnassigningId(null);
    }
  };

  const filteredEnrollments = useMemo(() => {
    const q = studentSearch.trim().toLowerCase();
    if (!q) return enrollments;
    return enrollments.filter((e) => {
      const name = e.studentId?.name || '';
      const email = e.studentId?.email || '';
      return name.toLowerCase().includes(q) || email.toLowerCase().includes(q);
    });
  }, [enrollments, studentSearch]);

  const computedSummary = useMemo(() => {
    if (summary) return summary;
    const enrolled = enrollments.length;
    let completed = 0;
    let inProgress = 0;
    let totalPct = 0;
    enrollments.forEach((e) => {
      const pct = e.progress?.percentComplete || 0;
      totalPct += pct;
      const b = progressBucket(pct);
      if (b === 'completed') completed += 1;
      else if (b === 'inProgress') inProgress += 1;
    });
    return {
      enrolled,
      completed,
      inProgress,
      notStarted: Math.max(0, enrolled - completed - inProgress),
      avgProgress: enrolled ? Math.round(totalPct / enrolled) : 0,
    };
  }, [summary, enrollments]);

  const chartData = filteredEnrollments.slice(0, 24).map((e) => ({
    name: (e.studentId?.name || 'Student').split(' ')[0],
    progress: e.progress?.percentComplete || 0,
  }));

  const lectureCount = (course?.modules || []).reduce(
    (n, m) => n + (m.lectures?.length || m.lectureCount || 0),
    0
  );
  const quizCount = (course?.modules || []).filter((m) => m.hasQuiz || m.quiz).length;

  return (
    <VendorHubPage
      loading={loading}
      backTo="/vendor-admin/courses"
      backLabel="Courses"
      eyebrow="Course management"
      title={course?.title || 'Course'}
      subtitle={
        course?.canEdit
          ? 'Edit curriculum, assign students, and track progress.'
          : course?.description || 'Assign students, preview curriculum, and track progress.'
      }
      accent={COURSES_ACCENT}
      className="courses-page"
      actions={
        <>
          {course?.canEdit && (
            <Link
              className={course.status === 'published' ? 'vh-btn vh-btn-ghost' : 'vh-btn vh-btn--primary'}
              to={`/vendor-admin/courses/${courseId}/edit`}
            >
              <FiEdit3 /> Edit curriculum
            </Link>
          )}
          {course?.status === 'published' && (
            <Link className="vh-btn vh-btn--primary" to={`/vendor-admin/courses/${courseId}/assign`}>
              <FiUsers /> Assign students
            </Link>
          )}
        </>
      }
    >
      {error && <p className="vh-error">{error}</p>}
      {message && <p className="vh-success">{message}</p>}

      {course && (
        <>
          <div className="vh-stats">
            <div className="vh-stat vh-stat--accent">
              <span className="vh-stat-label">Enrolled</span>
              <span className="vh-stat-value">{computedSummary.enrolled}</span>
            </div>
            <div className="vh-stat">
              <span className="vh-stat-label">Avg. progress</span>
              <span className="vh-stat-value">{computedSummary.avgProgress}%</span>
            </div>
            <div className="vh-stat">
              <span className="vh-stat-label">Completed</span>
              <span className="vh-stat-value">{computedSummary.completed}</span>
            </div>
            <div className="vh-stat">
              <span className="vh-stat-label">Modules</span>
              <span className="vh-stat-value">{(course.modules || []).length}</span>
            </div>
            <div className="vh-stat">
              <span className="vh-stat-label">Lectures</span>
              <span className="vh-stat-value">{lectureCount}</span>
            </div>
            <div className="vh-stat">
              <span className="vh-stat-label">Quizzes</span>
              <span className="vh-stat-value">{quizCount}</span>
            </div>
            <div className="vh-stat">
              <span className="vh-stat-label">Module access</span>
              <span className="vh-stat-value" style={{ fontSize: '1.05rem' }}>
                {course.unlockMode === 'open' ? 'Open' : 'In order'}
              </span>
            </div>
          </div>

          <div className="courses-tabs" role="tablist">
            {[
              { id: 'overview', label: 'Overview', icon: FiSave },
              { id: 'curriculum', label: 'Curriculum', icon: FiBook },
              { id: 'students', label: 'Students & analytics', icon: FiBarChart2 },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                role="tab"
                className={`courses-tab ${tab === id ? 'is-active' : ''}`}
                onClick={() => setTab(id)}
              >
                <Icon size={14} /> {label}
              </button>
            ))}
          </div>

          {tab === 'overview' && (
            <div className="vc-overview-grid">
              <section className="courses-panel">
                <h3 className="courses-panel-title">Vendor settings</h3>
                <p className="courses-muted" style={{ marginTop: -8, marginBottom: 16 }}>
                  {course.canEdit
                    ? 'Control who sees this course and when it is due. Edit curriculum from the editor.'
                    : 'Control who sees this course and when it is due. Platform curriculum cannot be edited.'}
                </p>
                <div className="courses-form-grid">
                  <div className="courses-field">
                    <label htmlFor="visibility">Student visibility</label>
                    <select
                      id="visibility"
                      className="vh-input"
                      value={visibility}
                      onChange={(e) => setVisibility(e.target.value)}
                    >
                      <option value="visible">Visible — students can start</option>
                      <option value="hidden">Hidden — not shown on dashboards</option>
                    </select>
                  </div>
                  <div className="courses-field">
                    <label htmlFor="dueAt">Due date (optional)</label>
                    <input
                      id="dueAt"
                      className="vh-input"
                      type="datetime-local"
                      value={dueAt}
                      onChange={(e) => setDueAt(e.target.value)}
                    />
                  </div>
                </div>
                <button
                  type="button"
                  className="vh-btn vh-btn--primary"
                  style={{ marginTop: 16 }}
                  disabled={saving}
                  onClick={saveSettings}
                >
                  <FiSave /> {saving ? 'Saving…' : 'Save settings'}
                </button>
              </section>

              <section className="courses-panel">
                <h3 className="courses-panel-title">Assignment</h3>
                <p className="vc-assign-blurb">
                  Assign this course to a classroom or pick individual students.
                  {course.unlockMode === 'open'
                    ? ' All modules will be available as soon as they start.'
                    : ' They will move through modules in order.'}
                </p>
                <div className="vc-assign-stats">
                  <div>
                    <strong>{computedSummary.enrolled}</strong>
                    <span>enrolled</span>
                  </div>
                  <div>
                    <strong>{computedSummary.inProgress}</strong>
                    <span>in progress</span>
                  </div>
                  <div>
                    <strong>{computedSummary.notStarted}</strong>
                    <span>not started</span>
                  </div>
                </div>
                {course.status === 'published' ? (
                  <Link className="vh-btn vh-btn--primary" to={`/vendor-admin/courses/${courseId}/assign`}>
                    <FiUsers /> Assign students
                  </Link>
                ) : (
                  <p className="courses-muted" style={{ marginBottom: 0 }}>
                    Publish the course in the editor before assigning students.
                  </p>
                )}
                {course.status === 'published' && !computedSummary.enrolled && (
                  <p className="courses-muted" style={{ marginTop: 12, marginBottom: 0 }}>
                    Nobody is enrolled yet. Assign a classroom or students to get started.
                  </p>
                )}
              </section>
            </div>
          )}

          {tab === 'curriculum' && (
            <section className="courses-panel">
              <h3 className="courses-panel-title">
                <FiBook /> Course content
              </h3>
              <p className="courses-muted" style={{ marginTop: -8, marginBottom: 16 }}>
                {course.canEdit
                  ? 'Preview what students will see. Use Edit curriculum to add modules, lectures, and optional quizzes.'
                  : 'Preview modules, lectures, and assessments. Platform content is read-only.'}
              </p>
              {course.canEdit && (
                <Link
                  className="vh-btn vh-btn--primary"
                  style={{ marginBottom: 16 }}
                  to={`/vendor-admin/courses/${courseId}/edit`}
                >
                  <FiEdit3 /> Edit curriculum
                </Link>
              )}
              <VendorCourseCurriculum courseId={courseId} modules={course.modules || []} />
            </section>
          )}

          {tab === 'students' && (
            <section className="courses-panel">
              <div className="vc-students-head">
                <div>
                  <h3 className="courses-panel-title" style={{ marginBottom: 4 }}>
                    <FiBarChart2 /> Student progress
                  </h3>
                  <p className="courses-muted" style={{ margin: 0 }}>
                    {computedSummary.completed} completed · {computedSummary.inProgress} in progress ·{' '}
                    {computedSummary.notStarted} not started
                  </p>
                </div>
                <div className="vc-search vc-student-search">
                  <FiSearch size={15} />
                  <input
                    type="search"
                    placeholder="Search students…"
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                  />
                </div>
              </div>

              {chartData.length > 0 && (
                <div className="courses-chart-wrap">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--vh-border, #e5e7eb)" />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Bar dataKey="progress" fill={COURSES_ACCENT} radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {!filteredEnrollments.length ? (
                <p className="courses-muted">
                  {enrollments.length
                    ? 'No students match your search.'
                    : 'No students enrolled yet. Assign students to get started.'}
                </p>
              ) : (
                <ul className="vc-enroll-list">
                  {filteredEnrollments.map((e) => {
                    const pct = e.progress?.percentComplete || 0;
                    const bucket = progressBucket(pct);
                    return (
                      <li key={e._id} className="vc-enroll-row">
                        <div className="vc-enroll-who">
                          <strong>{e.studentId?.name || 'Student'}</strong>
                          <span>{e.studentId?.email}</span>
                        </div>
                        <div className="vc-enroll-bar">
                          <div className="courses-progress-bar">
                            <span style={{ width: `${pct}%` }} />
                          </div>
                          <span className="vc-enroll-pct">{pct}%</span>
                        </div>
                        <span className={`vc-pill ${bucket === 'completed' ? 'is-on' : ''}`}>
                          {bucket === 'completed' && <FiCheckCircle size={12} />}
                          {bucket === 'completed'
                            ? 'Completed'
                            : bucket === 'inProgress'
                              ? 'In progress'
                              : 'Not started'}
                        </span>
                        <button
                          type="button"
                          className="vc-unassign"
                          title="Unassign"
                          disabled={unassigningId === e.studentId?._id}
                          onClick={() => unassign(e.studentId?._id)}
                        >
                          <FiTrash2 size={14} />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          )}
        </>
      )}
    </VendorHubPage>
  );
};

export default VendorCourseDetail;
