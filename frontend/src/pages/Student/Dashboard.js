import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useStudentPanel } from '../../context/StudentPanelContext';
import { COURSE_SECTIONS, TEST_SECTIONS, STUDENT_ACCENT } from '../../constants/studentSections';
import {
  FiArrowRight,
  FiBookOpen,
  FiCalendar,
  FiCheckCircle,
  FiClock,
  FiTarget,
  FiTrendingUp,
} from 'react-icons/fi';
import './Dashboard.css';

const SECTION_LABELS = {
  english_grammar: 'Grammar',
  english_vocabulary: 'Vocabulary',
  english_reading: 'Reading',
  english_essay: 'Writing',
  english_speaking: 'Speaking',
  english_listening: 'Listening',
};

const StudentDashboard = () => {
  const { user } = useAuth();
  const {
    tests,
    interviews,
    assignments,
    systemDesigns,
    courses,
    englishTrends,
    counts,
    stats,
    loading,
    error,
  } = useStudentPanel();

  const firstName = user?.name?.split(' ')[0] || 'Student';

  const continueItems = useMemo(() => {
    const items = [];

    tests
      .filter((t) => t.enrollmentStatus === 'in_progress' && t.canContinueAttempt !== false)
      .forEach((t) => {
        items.push({
          id: `test-${t._id}`,
          title: t.title,
          type: t.type === 'english' ? 'english' : t.type,
          status: 'in_progress',
          link: `${t.type === 'english' ? `/student/english-test/${t._id}` : `/student/test/${t._id}`}${
            t.contestId ? `?contestId=${t.contestId}` : ''
          }`,
          label: 'Continue test',
        });
      });

    interviews
      .filter((i) => !i.hasCompleted)
      .slice(0, 2)
      .forEach((i) => {
        items.push({
          id: `interview-${i._id}`,
          title: i.title,
          type: 'interview',
          status: 'assigned',
          link: `/student/interviews/${i._id}`,
          label: 'Start interview',
        });
      });

    assignments
      .filter((a) => ['assigned', 'in_progress'].includes(a.enrollmentStatus) && !a.isOverdue)
      .forEach((a) => {
        items.push({
          id: `assignment-${a.assignment?._id}`,
          title: a.assignment?.title,
          type: 'project',
          status: a.enrollmentStatus,
          link: `/student/submit-assignment/${a.assignment?._id}`,
          label: a.enrollmentStatus === 'in_progress' ? 'Submit project' : 'Start assignment',
        });
      });

    systemDesigns
      .filter((sd) => sd.submission && ['in_progress', 'follow_up'].includes(sd.submission.status))
      .forEach((sd) => {
        const status = sd.submission.status;
        items.push({
          id: `sd-${sd._id}`,
          title: sd.title,
          type: 'system',
          status,
          link:
            status === 'follow_up'
              ? `/student/system-design/${sd.submission._id}/follow-up`
              : `/student/system-design/${sd._id}`,
          label: status === 'follow_up' ? 'Answer follow-up' : 'Continue design',
        });
      });

    (courses || [])
      .filter((c) => {
        const pct = c.progress?.percentComplete || 0;
        return pct > 0 && pct < 100 && !c.progress?.completedAt;
      })
      .slice(0, 2)
      .forEach((c) => {
        items.push({
          id: `course-${c.enrollmentId || c.course?._id}`,
          title: c.course?.title,
          type: 'courses',
          status: 'in_progress',
          link: `/student/courses/${c.course?._id}`,
          label: `Continue course · ${Math.round(c.progress?.percentComplete || 0)}%`,
        });
      });

    return items.slice(0, 5);
  }, [tests, interviews, assignments, systemDesigns, courses]);

  if (loading) {
    return (
      <div className="student-page">
        <div className="student-dashboard-loading">
          <div className="student-loading-spinner" />
          <p>Loading your dashboard…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="student-page">
        <div className="student-empty-card">
          <p>{error}</p>
        </div>
      </div>
    );
  }

  const totalSections = TEST_SECTIONS.reduce((sum, s) => sum + (counts[s.id] || 0), 0);

  return (
    <div className="student-page student-dashboard">
      <header className="student-hero">
        <div className="student-hero-content">
          <p className="student-hero-eyebrow">Your learning space</p>
          <h1>Hello, {firstName}</h1>
          <p className="student-hero-sub">
            Track progress, pick up where you left off, and jump into any assessment type from the
            sidebar.
          </p>
          {(counts.courses > 0 || totalSections > 0) && (
            <Link
              to={counts.courses > 0 ? '/student/courses' : '/student/tests/coding'}
              className="student-hero-cta"
            >
              {counts.courses > 0 ? 'Open courses' : 'Browse assessments'} <FiArrowRight />
            </Link>
          )}
        </div>
        <div className="student-hero-visual" aria-hidden>
          <div className="student-hero-orb student-hero-orb-1" />
          <div className="student-hero-orb student-hero-orb-2" />
          <div className="student-hero-card-preview">
            <FiTarget style={{ color: STUDENT_ACCENT }} />
            <span>{stats.readinessScore}%</span>
            <small>readiness</small>
          </div>
        </div>
      </header>

      <section className="student-stats-grid" aria-label="Overview statistics">
        <article className="student-stat-card">
          <span className="student-stat-icon" style={{ '--stat-color': STUDENT_ACCENT }}>
            <FiTarget />
          </span>
          <div>
            <p className="student-stat-label">Readiness</p>
            <p className="student-stat-value">{stats.readinessScore}%</p>
            <p className="student-stat-hint">
              {stats.completedCount} of {stats.totalAssigned} completed
            </p>
          </div>
        </article>
        <article className="student-stat-card">
          <span className="student-stat-icon" style={{ '--stat-color': '#2563eb' }}>
            <FiCalendar />
          </span>
          <div>
            <p className="student-stat-label">Upcoming</p>
            <p className="student-stat-value">{stats.upcomingCount}</p>
            <p className="student-stat-hint">
              {stats.nextUpcoming ? stats.nextUpcoming.title : 'No scheduled tests'}
            </p>
          </div>
        </article>
        <article className="student-stat-card">
          <span className="student-stat-icon" style={{ '--stat-color': '#d97706' }}>
            <FiClock />
          </span>
          <div>
            <p className="student-stat-label">In progress</p>
            <p className="student-stat-value">{stats.pendingCount}</p>
            <p className="student-stat-hint">Tests & projects awaiting action</p>
          </div>
        </article>
        <article className="student-stat-card">
          <span className="student-stat-icon" style={{ '--stat-color': '#059669' }}>
            <FiCheckCircle />
          </span>
          <div>
            <p className="student-stat-label">Ready to start</p>
            <p className="student-stat-value">{stats.readyCount}</p>
            <p className="student-stat-hint">Assigned and waiting for you</p>
          </div>
        </article>
      </section>

      {continueItems.length > 0 && (
        <section className="student-section">
          <div className="student-section-head">
            <h2>Continue where you left off</h2>
          </div>
          <div className="student-continue-list">
            {continueItems.map((item) => {
              const section =
                item.type === 'courses'
                  ? COURSE_SECTIONS[0]
                  : TEST_SECTIONS.find((s) => s.id === item.type) || TEST_SECTIONS[0];
              const Icon = section?.icon || FiTrendingUp;
              return (
                <Link key={item.id} to={item.link} className="student-continue-card">
                  <span
                    className="student-continue-icon"
                    style={{ '--section-accent': section?.accent || '#64748b' }}
                  >
                    <Icon />
                  </span>
                  <div className="student-continue-body">
                    <h3>{item.title}</h3>
                    <p>{item.label}</p>
                  </div>
                  <FiArrowRight className="student-continue-arrow" />
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {englishTrends && (
        <section className="student-section student-english-widget">
          <div className="student-section-head">
            <h2>English skill trends</h2>
            <Link to="/student/tests/english" className="student-link-btn">
              View all <FiArrowRight />
            </Link>
          </div>
          <div className="english-trends-inner">
            <div className="trends-stats-row">
              <div className="trend-stat">
                <span className="trend-stat-value">{englishTrends.totalTests}</span>
                <span className="trend-stat-label">Tests taken</span>
              </div>
              <div className="trend-stat">
                <span className="trend-stat-value">{englishTrends.latestPercentage ?? '—'}%</span>
                <span className="trend-stat-label">Latest score</span>
              </div>
              {englishTrends.improvement !== null && (
                <div className="trend-stat">
                  <span
                    className={`trend-stat-value ${englishTrends.improvement >= 0 ? 'positive' : 'negative'}`}
                  >
                    {englishTrends.improvement >= 0 ? '+' : ''}
                    {englishTrends.improvement}%
                  </span>
                  <span className="trend-stat-label">vs previous</span>
                </div>
              )}
            </div>
            <div className="section-averages-grid">
              {Object.entries(englishTrends.sectionAverages || {}).map(([key, avg]) => {
                if (avg === null) return null;
                return (
                  <div key={key} className="section-avg-item">
                    <div className="section-avg-label">{SECTION_LABELS[key] || key}</div>
                    <div className="section-avg-bar-wrap">
                      <div
                        className={`section-avg-bar ${avg >= 70 ? 'excellent' : avg >= 50 ? 'good' : 'poor'}`}
                        style={{ width: `${avg}%` }}
                      />
                    </div>
                    <div className="section-avg-value">{avg}%</div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      <section className="student-section">
        <div className="student-section-head">
          <h2>Explore by category</h2>
          <p className="student-section-desc">Select a type to see all assigned work in that area.</p>
        </div>
        <div className="student-category-grid">
          {COURSE_SECTIONS.map((section) => {
            const Icon = section.icon || FiBookOpen;
            const count = counts.courses ?? 0;
            return (
              <Link
                key={section.id}
                to={section.path}
                className="student-category-card"
                style={{ '--card-accent': section.accent }}
              >
                <span className="student-category-icon">
                  <Icon />
                </span>
                <div className="student-category-body">
                  <h3>{section.label}</h3>
                  <p>{section.description}</p>
                </div>
                <div className="student-category-meta">
                  <span className="student-category-count">{count}</span>
                  <span className="student-category-unit">assigned</span>
                </div>
              </Link>
            );
          })}
          {TEST_SECTIONS.map((section) => {
            const Icon = section.icon;
            const count = counts[section.id] ?? 0;
            return (
              <Link
                key={section.id}
                to={section.path}
                className="student-category-card"
                style={{ '--card-accent': section.accent }}
              >
                <span className="student-category-icon">
                  <Icon />
                </span>
                <div className="student-category-body">
                  <h3>{section.label}</h3>
                  <p>{section.description}</p>
                </div>
                <div className="student-category-meta">
                  <span className="student-category-count">{count}</span>
                  <span className="student-category-unit">assigned</span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {stats.totalAssigned === 0 && !(counts.courses > 0) && (
        <div className="student-empty-card student-empty-hero">
          <div className="student-empty-illustration" aria-hidden>
            <FiTrendingUp />
          </div>
          <h2>No assessments yet</h2>
          <p>Your instructor will assign tests here. Check back soon or contact your coordinator.</p>
        </div>
      )}
    </div>
  );
};

export default StudentDashboard;
