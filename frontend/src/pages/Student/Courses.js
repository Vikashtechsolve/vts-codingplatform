import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FiBookOpen, FiCheckCircle, FiClock } from 'react-icons/fi';
import axiosInstance from '../../utils/axios';
import CourseListCard from '../../components/Courses/CourseListCard';
import { COURSE_SECTIONS } from '../../constants/studentSections';
import '../../styles/courses-pages.css';
import '../Student/Dashboard.css';

const COURSES_ACCENT = COURSE_SECTIONS[0]?.accent || '#0f766e';

const formatDue = (dueAt) => {
  if (!dueAt) return null;
  const d = new Date(dueAt);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const StudentCourses = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await axiosInstance.get('/student/courses', {
        params: { page: 1, limit: 50 },
      });
      setItems(data.items || []);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load courses');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const stats = useMemo(() => {
    const completed = items.filter((i) => i.progress?.completedAt || i.progress?.percentComplete >= 100)
      .length;
    const inProgress = items.filter(
      (i) => (i.progress?.percentComplete || 0) > 0 && !i.progress?.completedAt
    ).length;
    return { enrolled: items.length, inProgress, completed };
  }, [items]);

  if (loading) {
    return (
      <div className="student-page">
        <div className="student-dashboard-loading">
          <div className="student-loading-spinner" />
          <p>Loading your courses…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="student-page student-courses-page" style={{ '--courses-accent': COURSES_ACCENT }}>
      <header className="student-hero">
        <div className="student-hero-content">
          <p className="student-hero-eyebrow">Structured learning</p>
          <h1>Courses</h1>
          <p className="student-hero-sub">
            Lectures, notes, and optional quizzes assigned to you. Some courses unlock module by
            module; others let you open everything from the start.
          </p>
        </div>
        <div className="student-hero-visual" aria-hidden>
          <div className="student-hero-orb student-hero-orb-1" />
          <div className="student-hero-orb student-hero-orb-2" />
          <div className="student-hero-card-preview" style={{ color: COURSES_ACCENT }}>
            <FiBookOpen style={{ color: COURSES_ACCENT }} />
            <span>{stats.enrolled}</span>
            <small>assigned</small>
          </div>
        </div>
      </header>

      {error && (
        <div className="student-empty-card">
          <p>{error}</p>
        </div>
      )}

      {!error && items.length > 0 && (
        <section className="student-stats-grid" aria-label="Course statistics">
          <article className="student-stat-card">
            <span className="student-stat-icon" style={{ '--stat-color': COURSES_ACCENT }}>
              <FiBookOpen />
            </span>
            <div>
              <p className="student-stat-label">Assigned</p>
              <p className="student-stat-value">{stats.enrolled}</p>
              <p className="student-stat-hint">Courses from your instructor</p>
            </div>
          </article>
          <article className="student-stat-card">
            <span className="student-stat-icon" style={{ '--stat-color': '#d97706' }}>
              <FiClock />
            </span>
            <div>
              <p className="student-stat-label">In progress</p>
              <p className="student-stat-value">{stats.inProgress}</p>
              <p className="student-stat-hint">Pick up where you left off</p>
            </div>
          </article>
          <article className="student-stat-card">
            <span className="student-stat-icon" style={{ '--stat-color': '#059669' }}>
              <FiCheckCircle />
            </span>
            <div>
              <p className="student-stat-label">Completed</p>
              <p className="student-stat-value">{stats.completed}</p>
              <p className="student-stat-hint">Finished end to end</p>
            </div>
          </article>
        </section>
      )}

      {!items.length && !error ? (
        <div className="student-empty-card student-empty-hero">
          <div className="student-empty-illustration" aria-hidden>
            <FiBookOpen />
          </div>
          <h2>No courses assigned yet</h2>
          <p>
            When your instructor assigns a course, it will show up here and in the Courses section of
            the sidebar.
          </p>
        </div>
      ) : (
        <section className="student-section">
          <div className="student-section-head">
            <h2>Your courses</h2>
            <p className="student-section-desc">Open a course to watch lectures and read notes.</p>
          </div>
          <div className="courses-grid">
            {items.map((item) => {
              const due = formatDue(item.dueAt);
              const pct = Math.round(item.progress?.percentComplete || 0);
              const done = !!item.progress?.completedAt || pct >= 100;
              return (
                <CourseListCard
                  key={item.enrollmentId}
                  to={`/student/courses/${item.course._id}`}
                  title={item.course.title}
                  description={item.course.description || 'Continue where you left off'}
                  level={item.course.level}
                  estimatedHours={item.course.estimatedHours}
                  progress={pct}
                  accent={COURSES_ACCENT}
                  badge={done ? 'Completed' : pct > 0 ? 'In progress' : 'New'}
                  badgeVariant={done ? 'published' : pct > 0 ? 'ready' : 'default'}
                  meta={[
                    item.course.unlockMode === 'open' ? 'All modules open' : 'Unlock in order',
                    ...(due ? [`Due ${due}`] : []),
                  ]}
                  ctaLabel={done ? 'Review' : pct > 0 ? 'Continue' : 'Start course'}
                />
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
};

export default StudentCourses;
