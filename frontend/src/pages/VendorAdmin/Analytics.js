import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  FiBarChart2,
  FiUsers,
  FiFileText,
  FiTrendingUp,
  FiCheckCircle,
  FiSearch,
  FiRefreshCw,
  FiChevronLeft,
  FiChevronRight,
  FiGrid,
  FiExternalLink,
  FiClock,
  FiAlertCircle,
  FiBookOpen,
} from 'react-icons/fi';
import axiosInstance from '../../utils/axios';
import VendorHubPage from '../../components/VendorAdmin/VendorHubPage';
import {
  normalizeOverview,
  hasScoreDistributionData,
  pieChartData,
  filterAndPaginateTests,
} from '../../utils/analyticsUtils';
import './Analytics.css';

const CHART_GRID = '#e5e7eb';

const SCORE_COLORS = ['#ef4444', '#f59e0b', '#3b82f6', '#10b981'];
const TREND_DAYS = [7, 30];

const formatShortDate = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const formatRelativeDate = (dateStr) => {
  if (!dateStr) return 'Never';
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return 'Never';

  const diffMs = Date.now() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatShortDate(dateStr);
};

const studentStatusMeta = (status) => {
  if (status === 'complete') {
    return { label: 'Up to date', tone: 'good' };
  }
  if (status === 'in_progress') {
    return { label: 'In progress', tone: 'mid' };
  }
  return { label: 'Not started', tone: 'low' };
};

const scoreTone = (score) => {
  if (score >= 80) return 'good';
  if (score >= 60) return 'mid';
  if (score > 0) return 'low';
  return 'muted';
};

const Analytics = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [trendDays, setTrendDays] = useState(30);
  const [overview, setOverview] = useState(null);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [overviewError, setOverviewError] = useState('');

  const [testSearch, setTestSearch] = useState('');
  const [testSort, setTestSort] = useState('submissions');
  const [testPage, setTestPage] = useState(1);
  const [remoteTests, setRemoteTests] = useState(null);
  const [remoteTestsLoading, setRemoteTestsLoading] = useState(false);
  const [remoteTestsError, setRemoteTestsError] = useState('');
  const [remoteTestsAttempted, setRemoteTestsAttempted] = useState(false);

  const [selectedClassroomId, setSelectedClassroomId] = useState(null);
  const [classroomDetail, setClassroomDetail] = useState(null);
  const [classroomLoading, setClassroomLoading] = useState(false);
  const [classroomSearch, setClassroomSearch] = useState('');
  const [classroomPage, setClassroomPage] = useState(1);
  const [classroomPagination, setClassroomPagination] = useState({ total: 0, totalPages: 1 });

  const fetchOverview = useCallback(async (days = trendDays) => {
    try {
      setOverviewLoading(true);
      setOverviewError('');
      let raw = null;

      try {
        const { data } = await axiosInstance.get(`/vendor-admin/analytics/overview?days=${days}`);
        raw = data;
      } catch (primaryError) {
        if (primaryError.response?.status === 404) {
          const { data } = await axiosInstance.get(`/vendor-admin/analytics?days=${days}`);
          raw = data;
        } else {
          throw primaryError;
        }
      }

      const normalized = normalizeOverview(raw);
      if (!normalized) {
        setOverview(null);
        setOverviewError('Analytics data could not be read. Please refresh.');
        return;
      }
      setOverview(normalized);
    } catch (error) {
      console.error('Error fetching analytics overview:', error);
      setOverview(null);
      setOverviewError(
        error.response?.data?.message || 'Failed to load analytics. Check your connection and try again.'
      );
    } finally {
      setOverviewLoading(false);
    }
  }, [trendDays]);

  const fetchClassroomDetail = useCallback(async () => {
    if (!selectedClassroomId) return;
    try {
      setClassroomLoading(true);
      const { data } = await axiosInstance.get(
        `/vendor-admin/analytics/classrooms/${selectedClassroomId}`,
        {
          params: {
            page: classroomPage,
            limit: 15,
            search: classroomSearch,
          },
        }
      );
      setClassroomDetail(data);
      setClassroomPagination(data.pagination || { total: 0, totalPages: 1, page: 1 });
    } catch (error) {
      console.error('Error fetching classroom analytics:', error);
      setClassroomDetail(null);
    } finally {
      setClassroomLoading(false);
    }
  }, [selectedClassroomId, classroomPage, classroomSearch]);

  useEffect(() => {
    fetchOverview(trendDays);
  }, [fetchOverview, trendDays]);

  useEffect(() => {
    if (activeTab === 'classrooms' && selectedClassroomId) {
      fetchClassroomDetail();
    }
  }, [activeTab, selectedClassroomId, fetchClassroomDetail]);

  useEffect(() => {
    setTestPage(1);
  }, [testSearch, testSort]);

  useEffect(() => {
    setClassroomPage(1);
  }, [classroomSearch]);

  useEffect(() => {
    setClassroomDetail(null);
    setClassroomPage(1);
  }, [selectedClassroomId]);

  const testCatalog = useMemo(() => {
    if (overview?.allTests?.length) {
      return overview.allTests;
    }
    if (remoteTests?.length) {
      return remoteTests;
    }
    return [];
  }, [overview, remoteTests]);

  const { tests: paginatedTests, pagination: testPagination } = useMemo(
    () =>
      filterAndPaginateTests(testCatalog, {
        search: testSearch,
        sort: testSort,
        page: testPage,
        limit: 12,
      }),
    [testCatalog, testSearch, testSort, testPage]
  );

  useEffect(() => {
    if (activeTab !== 'tests' || overviewLoading || !overview) return;
    if (overview.allTests?.length || remoteTestsAttempted) return;

    let cancelled = false;

    (async () => {
      try {
        setRemoteTestsLoading(true);
        setRemoteTestsError('');
        const { data } = await axiosInstance.get('/vendor-admin/analytics/tests', {
          params: { page: 1, limit: 50, sort: 'submissions' },
        });
        if (!cancelled) {
          setRemoteTests(data.tests || []);
        }
      } catch (error) {
        console.error('Error fetching test analytics:', error);
        if (!cancelled) {
          setRemoteTestsError(
            error.response?.data?.message || 'Could not load test performance data.'
          );
        }
      } finally {
        if (!cancelled) {
          setRemoteTestsLoading(false);
          setRemoteTestsAttempted(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeTab, overview, overviewLoading, remoteTestsAttempted]);

  const selectedClassroomSummary = useMemo(
    () =>
      classroomDetail?.classroom ||
      overview?.classroomSummaries?.find(
        (c) => String(c.classroomId) === String(selectedClassroomId)
      ),
    [overview, selectedClassroomId, classroomDetail]
  );

  const classroomAssignedTests = classroomDetail?.assignedTests || [];
  const classroomScoreDistribution = classroomDetail?.scoreDistribution || [];
  const classroomDistributionChartData = pieChartData(classroomScoreDistribution);
  const classroomNeedsAttention = classroomDetail?.studentsNeedingAttention || [];
  const hasAssignedTests = (selectedClassroomSummary?.assignedTestsCount || 0) > 0;

  const trendData = useMemo(
    () =>
      (overview?.activityTrend || []).map((point) => ({
        ...point,
        label: formatShortDate(point.date),
      })),
    [overview]
  );

  const scoreDistribution = overview?.scoreDistribution || [];
  const distributionChartData = pieChartData(scoreDistribution);

  const renderOverview = () => {
    if (overviewLoading && !overview) {
      return <div className="vanalytics-skeleton">Loading overview…</div>;
    }

    if (overviewError && !overview) {
      return (
        <div className="vanalytics-empty">
          <FiBarChart2 />
          <h3>Could not load analytics</h3>
          <p>{overviewError}</p>
          <button type="button" className="vh-btn vh-btn--primary" onClick={() => fetchOverview(trendDays)}>
            <FiRefreshCw /> Try again
          </button>
        </div>
      );
    }

    if (!overview?.summary) {
      return (
        <div className="vanalytics-empty">
          <FiBarChart2 />
          <h3>No analytics yet</h3>
          <p>Create tests, enroll students, and collect submissions to see insights here.</p>
        </div>
      );
    }

    const { summary } = overview;

    return (
      <>
        <div className="vh-stats vanalytics-stats">
          <div className="vh-stat vh-stat--accent">
            <span className="vh-stat-label">Students</span>
            <span className="vh-stat-value">{summary.totalStudents}</span>
          </div>
          <div className="vh-stat">
            <span className="vh-stat-label">Active learners</span>
            <span className="vh-stat-value">{summary.activeStudents}</span>
          </div>
          <div className="vh-stat">
            <span className="vh-stat-label">Avg score</span>
            <span className="vh-stat-value">{summary.averageScore}%</span>
          </div>
          <div className="vh-stat">
            <span className="vh-stat-label">Completion</span>
            <span className="vh-stat-value">{summary.completionRate}%</span>
          </div>
          <div className="vh-stat">
            <span className="vh-stat-label">Submissions</span>
            <span className="vh-stat-value">{summary.totalSubmissions}</span>
          </div>
          <div className="vh-stat">
            <span className="vh-stat-label">Tests</span>
            <span className="vh-stat-value">{summary.totalTests}</span>
          </div>
        </div>

        <div className="vanalytics-grid">
          <section className="vh-panel vanalytics-panel">
            <div className="vh-panel-head">
              <div>
                <h2 className="vh-panel-title">Submission activity</h2>
                <p className="vh-panel-desc">Completed test submissions over time.</p>
              </div>
              <div className="vanalytics-range">
                {TREND_DAYS.map((days) => (
                  <button
                    key={days}
                    type="button"
                    className={`vanalytics-range-btn ${trendDays === days ? 'is-active' : ''}`}
                    onClick={() => setTrendDays(days)}
                  >
                    {days}d
                  </button>
                ))}
              </div>
            </div>
            <div className="vh-panel-body">
              {trendData.length === 0 ? (
                <p className="vanalytics-muted">No submissions in this period.</p>
              ) : (
                <div className="vanalytics-chart-wrap">
                  <ResponsiveContainer width="100%" height={260}>
                    <AreaChart data={trendData}>
                    <defs>
                      <linearGradient id="vanalyticsTrend" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} className="vanalytics-chart-grid" />
                    <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                    <Tooltip
                      formatter={(value) => [value, 'Submissions']}
                      labelFormatter={(_, payload) =>
                        payload?.[0]?.payload?.date
                          ? new Date(`${payload[0].payload.date}T00:00:00`).toLocaleDateString()
                          : ''
                      }
                    />
                    <Area
                      type="monotone"
                      dataKey="count"
                      stroke="#6366f1"
                      fill="url(#vanalyticsTrend)"
                      strokeWidth={2}
                    />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </section>

          <section className="vh-panel vanalytics-panel">
            <div className="vh-panel-head">
              <div>
                <h2 className="vh-panel-title">Score distribution</h2>
                <p className="vh-panel-desc">How students scored across completed attempts.</p>
              </div>
            </div>
            <div className="vh-panel-body vanalytics-distribution">
              {!hasScoreDistributionData(scoreDistribution) ? (
                <p className="vanalytics-muted">No completed submissions yet.</p>
              ) : (
                <>
                  <div className="vanalytics-chart-wrap vanalytics-chart-wrap--pie">
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie
                          data={distributionChartData}
                          dataKey="count"
                          nameKey="label"
                          innerRadius={55}
                          outerRadius={85}
                          paddingAngle={3}
                        >
                          {distributionChartData.map((entry, index) => (
                            <Cell key={entry.label} fill={SCORE_COLORS[index % SCORE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="vanalytics-legend">
                    {scoreDistribution.map((bucket, index) => (
                      <div key={bucket.label} className="vanalytics-legend-item">
                        <span
                          className="vanalytics-legend-dot"
                          style={{ background: SCORE_COLORS[index % SCORE_COLORS.length] }}
                        />
                        <span>{bucket.label}</span>
                        <strong>{bucket.count}</strong>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </section>
        </div>

        <div className="vanalytics-grid vanalytics-grid--compact">
          <section className="vh-panel vanalytics-panel">
            <div className="vh-panel-head">
              <div>
                <h2 className="vh-panel-title">Top tests</h2>
                <p className="vh-panel-desc">Most attempted assessments.</p>
              </div>
              <button type="button" className="vh-btn vh-btn--ghost vh-btn--sm" onClick={() => setActiveTab('tests')}>
                View all
              </button>
            </div>
            <div className="vh-panel-body">
              {(overview.topTests || []).length === 0 ? (
                <p className="vanalytics-muted">No test submissions yet.</p>
              ) : (
                <div className="vanalytics-chart-wrap">
                  <ResponsiveContainer width="100%" height={Math.max(180, overview.topTests.length * 34)}>
                    <BarChart
                      data={overview.topTests}
                      layout="vertical"
                      margin={{ left: 8, right: 16, top: 4, bottom: 4 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={CHART_GRID} />
                      <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
                      <YAxis
                        type="category"
                        dataKey="testTitle"
                        width={120}
                        tick={{ fontSize: 11 }}
                        tickFormatter={(value) =>
                          value && value.length > 18 ? `${value.slice(0, 18)}…` : value
                        }
                      />
                      <Tooltip />
                      <Bar dataKey="totalSubmissions" fill="#6366f1" radius={[0, 6, 6, 0]} name="Submissions" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </section>

          <section className="vh-panel vanalytics-panel">
            <div className="vh-panel-head">
              <div>
                <h2 className="vh-panel-title">Top classrooms</h2>
                <p className="vh-panel-desc">Highest average scores (min. 1 student).</p>
              </div>
              <button
                type="button"
                className="vh-btn vh-btn--ghost vh-btn--sm"
                onClick={() => setActiveTab('classrooms')}
              >
                Explore
              </button>
            </div>
            <div className="vh-panel-body vanalytics-classroom-mini">
              {(overview.topClassrooms || []).length === 0 ? (
                <p className="vanalytics-muted">Create classrooms and collect results to compare batches.</p>
              ) : (
                overview.topClassrooms.map((classroom) => (
                  <button
                    key={classroom.classroomId}
                    type="button"
                    className="vanalytics-classroom-row"
                    onClick={() => {
                      setSelectedClassroomId(classroom.classroomId);
                      setActiveTab('classrooms');
                    }}
                  >
                    <div>
                      <strong>{classroom.classroomName}</strong>
                      <span>
                        {classroom.totalStudents} students ·{' '}
                        {classroom.assignedCompletionRate != null
                          ? `${classroom.assignedCompletionRate}% assigned done`
                          : `${classroom.attemptRate}% active`}
                      </span>
                    </div>
                    <span className={`vanalytics-score vanalytics-score--${scoreTone(classroom.averageScore)}`}>
                      {classroom.averageScore}%
                    </span>
                  </button>
                ))
              )}
            </div>
          </section>
        </div>
      </>
    );
  };

  const renderTests = () => {
    if (overviewLoading && !overview) {
      return <div className="vanalytics-skeleton">Loading tests…</div>;
    }

    if (overviewError && !overview) {
      return (
        <div className="vanalytics-empty">
          <FiFileText />
          <h3>Could not load tests</h3>
          <p>{overviewError}</p>
          <button type="button" className="vh-btn vh-btn--primary" onClick={() => fetchOverview(trendDays)}>
            <FiRefreshCw /> Try again
          </button>
        </div>
      );
    }

    if (remoteTestsLoading && testCatalog.length === 0) {
      return <div className="vanalytics-skeleton">Loading tests…</div>;
    }

    if (remoteTestsError && testCatalog.length === 0) {
      return (
        <div className="vanalytics-empty vanalytics-empty--compact">
          <FiFileText />
          <p>{remoteTestsError}</p>
        </div>
      );
    }

    return (
      <section className="vh-panel vanalytics-panel">
        <div className="vh-panel-head">
          <div>
            <h2 className="vh-panel-title">Test performance</h2>
            <p className="vh-panel-desc">
              {testPagination.total} test{testPagination.total === 1 ? '' : 's'} — open results for deeper review.
            </p>
          </div>
          <div className="vanalytics-toolbar">
            <div className="vh-search vanalytics-search">
              <FiSearch />
              <input
                type="search"
                placeholder="Search tests…"
                value={testSearch}
                onChange={(e) => setTestSearch(e.target.value)}
              />
            </div>
            <select
              className="vanalytics-select"
              value={testSort}
              onChange={(e) => setTestSort(e.target.value)}
            >
              <option value="submissions">Most submissions</option>
              <option value="score">Highest avg score</option>
              <option value="title">Title A–Z</option>
            </select>
          </div>
        </div>
        <div className="vh-panel-body vanalytics-panel-body--flush">
          {paginatedTests.length === 0 ? (
            <div className="vanalytics-empty vanalytics-empty--compact">
              <FiFileText />
              <p>
                {testCatalog.length === 0 && (overview?.summary?.totalTests || 0) > 0
                  ? 'Loading test list… try Refresh if this persists.'
                  : testCatalog.length === 0
                    ? 'No tests yet. Create a test to track performance here.'
                    : 'No tests match your filters.'}
              </p>
            </div>
          ) : (
            <>
              <div className="vh-table-wrap">
                <table className="vh-table vanalytics-table">
                  <thead>
                    <tr>
                      <th>Test</th>
                      <th>Type</th>
                      <th>Submissions</th>
                      <th>Students</th>
                      <th>Avg score</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedTests.map((test) => (
                      <tr key={String(test.testId)}>
                        <td className="vh-cell-title">{test.testTitle}</td>
                        <td>
                          <span className="vh-badge vh-badge--global">{test.testType || '—'}</span>
                        </td>
                        <td>{test.totalSubmissions}</td>
                        <td>{test.uniqueStudents}</td>
                        <td>
                          <span className={`vanalytics-score vanalytics-score--${scoreTone(test.averageScore)}`}>
                            {test.averageScore}%
                          </span>
                        </td>
                        <td>
                          <Link
                            to={`/vendor-admin/tests/${test.testId}/results`}
                            className="vh-btn vh-btn--ghost vh-btn--sm"
                          >
                            <FiExternalLink /> Results
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="vanalytics-pagination">
                <span>
                  Page {testPagination.page} of {testPagination.totalPages} · {testPagination.total} tests
                </span>
                <div className="vanalytics-pagination-actions">
                  <button
                    type="button"
                    className="vh-btn vh-btn--ghost vh-btn--sm"
                    disabled={testPagination.page <= 1}
                    onClick={() => setTestPage((p) => Math.max(1, p - 1))}
                  >
                    <FiChevronLeft /> Previous
                  </button>
                  <button
                    type="button"
                    className="vh-btn vh-btn--ghost vh-btn--sm"
                    disabled={testPagination.page >= testPagination.totalPages}
                    onClick={() => setTestPage((p) => p + 1)}
                  >
                    Next <FiChevronRight />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </section>
    );
  };

  const renderClassrooms = () => (
    <div className="vanalytics-classrooms-layout">
      <section className="vh-panel vanalytics-panel vanalytics-classroom-list-panel">
        <div className="vh-panel-head">
          <div>
            <h2 className="vh-panel-title">Classrooms</h2>
            <p className="vh-panel-desc">Select a classroom to inspect student performance.</p>
          </div>
        </div>
        <div className="vh-panel-body vanalytics-classroom-list">
          {overviewLoading && !overview ? (
            <div className="vanalytics-skeleton">Loading classrooms…</div>
          ) : (overview?.classroomSummaries || []).length === 0 ? (
            <div className="vanalytics-empty vanalytics-empty--compact">
              <FiGrid />
              <p>No classrooms yet.</p>
              <Link to="/vendor-admin/classrooms/create" className="vh-btn vh-btn--secondary vh-btn--sm">
                Create classroom
              </Link>
            </div>
          ) : (
            (overview?.classroomSummaries || []).map((classroom) => (
              <button
                key={classroom.classroomId}
                type="button"
                className={`vanalytics-classroom-card ${
                  String(selectedClassroomId) === String(classroom.classroomId) ? 'is-selected' : ''
                }`}
                onClick={() => setSelectedClassroomId(classroom.classroomId)}
              >
                <div className="vanalytics-classroom-card-top">
                  <strong>{classroom.classroomName}</strong>
                  <span className={`vanalytics-score vanalytics-score--${scoreTone(classroom.averageScore)}`}>
                    {classroom.averageScore}%
                  </span>
                </div>
                <div className="vanalytics-classroom-card-meta">
                  <span><FiUsers /> {classroom.totalStudents} students</span>
                  <span><FiBookOpen /> {classroom.assignedTestsCount || 0} assigned</span>
                  {classroom.assignedCompletionRate != null ? (
                    <span><FiCheckCircle /> {classroom.assignedCompletionRate}% assigned done</span>
                  ) : (
                    <span><FiTrendingUp /> {classroom.attemptRate}% active</span>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      </section>

      <section className="vh-panel vanalytics-panel vanalytics-classroom-detail-panel">
        {!selectedClassroomId ? (
          <div className="vanalytics-empty vanalytics-empty--panel">
            <FiGrid />
            <h3>Select a classroom</h3>
            <p>Pick a classroom on the left to load student-level analytics on demand.</p>
          </div>
        ) : classroomLoading && !classroomDetail ? (
          <div className="vanalytics-skeleton">Loading classroom details…</div>
        ) : (
          <>
            <div className="vh-panel-head vanalytics-classroom-head">
              <div>
                <h2 className="vh-panel-title">{selectedClassroomSummary?.classroomName || 'Classroom'}</h2>
                <p className="vh-panel-desc">
                  {selectedClassroomSummary?.description || 'Track assigned test progress and student performance.'}
                </p>
              </div>
              <div className="vanalytics-classroom-actions">
                <Link
                  to={`/vendor-admin/classrooms/${selectedClassroomId}/students`}
                  className="vh-btn vh-btn--ghost vh-btn--sm"
                >
                  <FiUsers /> Manage students
                </Link>
                <Link
                  to={`/vendor-admin/classrooms/${selectedClassroomId}/tests`}
                  className="vh-btn vh-btn--ghost vh-btn--sm"
                >
                  <FiBookOpen /> Assigned tests
                </Link>
              </div>
            </div>
            <div className="vh-panel-body">
              <div className="vh-stats vanalytics-classroom-kpis">
                <div className="vh-stat">
                  <span className="vh-stat-label">Students</span>
                  <span className="vh-stat-value">{selectedClassroomSummary?.totalStudents || 0}</span>
                </div>
                <div className="vh-stat">
                  <span className="vh-stat-label">Assigned tests</span>
                  <span className="vh-stat-value">{selectedClassroomSummary?.assignedTestsCount || 0}</span>
                </div>
                <div className="vh-stat">
                  <span className="vh-stat-label">Assignment progress</span>
                  <span className="vh-stat-value">
                    {selectedClassroomSummary?.assignedCompletionRate != null
                      ? `${selectedClassroomSummary.assignedCompletionRate}%`
                      : '—'}
                  </span>
                </div>
                <div className="vh-stat">
                  <span className="vh-stat-label">Avg score</span>
                  <span className="vh-stat-value">{selectedClassroomSummary?.averageScore || 0}%</span>
                </div>
                <div className="vh-stat">
                  <span className="vh-stat-label">Submissions</span>
                  <span className="vh-stat-value">{selectedClassroomSummary?.totalSubmissions || 0}</span>
                </div>
                <div className="vh-stat">
                  <span className="vh-stat-label">Not started</span>
                  <span className="vh-stat-value">{selectedClassroomSummary?.notAttemptedCount || 0}</span>
                </div>
              </div>

              <div className="vanalytics-classroom-insights">
                <section className="vanalytics-classroom-block">
                  <div className="vanalytics-classroom-block-head">
                    <div>
                      <h3>{hasAssignedTests ? 'Assigned test progress' : 'Tests taken by students'}</h3>
                      <p>
                        {hasAssignedTests
                          ? 'Completion across enrolled students for each assigned assessment.'
                          : 'No tests assigned yet — showing tests students have completed on their own.'}
                      </p>
                    </div>
                  </div>
                  {classroomAssignedTests.length === 0 ? (
                    <p className="vanalytics-muted">
                      {hasAssignedTests
                        ? 'Assigned tests will appear here once students submit work.'
                        : 'No completed test activity from this classroom yet.'}
                    </p>
                  ) : (
                    <div className="vh-table-wrap">
                      <table className="vh-table vanalytics-table vanalytics-table--compact">
                        <thead>
                          <tr>
                            <th>Test</th>
                            <th>Completed</th>
                            <th>Progress</th>
                            <th>Avg score</th>
                            <th />
                          </tr>
                        </thead>
                        <tbody>
                          {classroomAssignedTests.map((test) => (
                            <tr key={String(test.testId)}>
                              <td className="vh-cell-title">
                                <strong>{test.testTitle}</strong>
                                <span className="vanalytics-test-type">{test.testType || 'test'}</span>
                              </td>
                              <td>
                                {test.studentsCompleted}/{selectedClassroomSummary?.totalStudents || 0} students
                              </td>
                              <td>
                                <div className="vanalytics-progress-cell">
                                  <div className="vanalytics-progress-bar">
                                    <span style={{ width: `${test.completionRate || 0}%` }} />
                                  </div>
                                  <span>{test.completionRate || 0}%</span>
                                </div>
                              </td>
                              <td>
                                <span className={`vanalytics-score vanalytics-score--${scoreTone(test.averageScore)}`}>
                                  {test.averageScore}%
                                </span>
                              </td>
                              <td>
                                <Link
                                  to={`/vendor-admin/tests/${test.testId}/results`}
                                  className="vh-btn vh-btn--ghost vh-btn--sm"
                                >
                                  <FiExternalLink /> Results
                                </Link>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>

                <section className="vanalytics-classroom-block vanalytics-classroom-block--side">
                  <div className="vanalytics-classroom-block-head">
                    <div>
                      <h3>Score distribution</h3>
                      <p>How students in this classroom scored on completed attempts.</p>
                    </div>
                  </div>
                  {!hasScoreDistributionData(classroomScoreDistribution) ? (
                    <p className="vanalytics-muted">No completed submissions yet.</p>
                  ) : (
                    <>
                      <div className="vanalytics-chart-wrap vanalytics-chart-wrap--pie vanalytics-chart-wrap--classroom">
                        <ResponsiveContainer width="100%" height={180}>
                          <PieChart>
                            <Pie
                              data={classroomDistributionChartData}
                              dataKey="count"
                              nameKey="label"
                              innerRadius={42}
                              outerRadius={68}
                              paddingAngle={3}
                            >
                              {classroomDistributionChartData.map((entry, index) => (
                                <Cell key={entry.label} fill={SCORE_COLORS[index % SCORE_COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="vanalytics-legend vanalytics-legend--compact">
                        {classroomScoreDistribution.map((bucket, index) => (
                          <div key={bucket.label} className="vanalytics-legend-item">
                            <span
                              className="vanalytics-legend-dot"
                              style={{ background: SCORE_COLORS[index % SCORE_COLORS.length] }}
                            />
                            <span>{bucket.label}</span>
                            <strong>{bucket.count}</strong>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </section>
              </div>

              {classroomNeedsAttention.length > 0 && (
                <section className="vanalytics-classroom-block vanalytics-classroom-block--attention">
                  <div className="vanalytics-classroom-block-head">
                    <div>
                      <h3><FiAlertCircle /> Needs attention</h3>
                      <p>Students who have not started or are behind on assigned work.</p>
                    </div>
                  </div>
                  <div className="vanalytics-attention-list">
                    {classroomNeedsAttention.map((student) => {
                      const status = studentStatusMeta(student.status);
                      return (
                        <div key={String(student.studentId)} className="vanalytics-attention-item">
                          <div>
                            <strong>{student.name}</strong>
                            <span>
                              {student.enrollmentNumber
                                ? `${student.enrollmentNumber} · ${student.email}`
                                : student.email}
                            </span>
                          </div>
                          <div className="vanalytics-attention-meta">
                            <span className={`vanalytics-status vanalytics-status--${status.tone}`}>
                              {status.label}
                            </span>
                            {student.assignedTotal > 0 && (
                              <span>{student.assignedCompleted}/{student.assignedTotal} assigned</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              <section className="vanalytics-classroom-block">
                <div className="vanalytics-classroom-block-head">
                  <div>
                    <h3>Student roster</h3>
                    <p>Progress, scores, and last activity for every enrolled student.</p>
                  </div>
                  <div className="vh-search vanalytics-search">
                    <FiSearch />
                    <input
                      type="search"
                      placeholder="Search by name, email, or enrollment number…"
                      value={classroomSearch}
                      onChange={(e) => setClassroomSearch(e.target.value)}
                    />
                  </div>
                </div>

                {classroomLoading ? (
                  <div className="vanalytics-loading-inline">Updating roster…</div>
                ) : (classroomDetail?.students || []).length === 0 ? (
                  <p className="vanalytics-muted">No students match your search.</p>
                ) : (
                  <>
                    <div className="vh-table-wrap">
                      <table className="vh-table vanalytics-table">
                        <thead>
                          <tr>
                            <th>Student</th>
                            <th>Status</th>
                            <th>Assigned progress</th>
                            <th>Avg score</th>
                            <th>Last active</th>
                            <th />
                          </tr>
                        </thead>
                        <tbody>
                          {classroomDetail.students.map((student) => {
                            const status = studentStatusMeta(student.status);
                            return (
                              <tr key={String(student.studentId)}>
                                <td>
                                  <div className="vanalytics-student-cell">
                                    <strong>{student.name}</strong>
                                    <span>
                                      {student.enrollmentNumber
                                        ? `${student.enrollmentNumber} · ${student.email}`
                                        : student.email}
                                    </span>
                                  </div>
                                </td>
                                <td>
                                  <span className={`vanalytics-status vanalytics-status--${status.tone}`}>
                                    {status.label}
                                  </span>
                                </td>
                                <td>
                                  {student.assignedTotal > 0 ? (
                                    <div className="vanalytics-progress-cell">
                                      <div className="vanalytics-progress-bar">
                                        <span style={{ width: `${student.assignedProgress || 0}%` }} />
                                      </div>
                                      <span>
                                        {student.assignedCompleted}/{student.assignedTotal}
                                      </span>
                                    </div>
                                  ) : (
                                    <span className="vanalytics-muted">
                                      {student.completedTests} completed
                                    </span>
                                  )}
                                </td>
                                <td>
                                  <span
                                    className={`vanalytics-score vanalytics-score--${scoreTone(student.averageScore)}`}
                                  >
                                    {student.averageScore}%
                                  </span>
                                </td>
                                <td>
                                  <span className="vanalytics-last-active">
                                    <FiClock /> {formatRelativeDate(student.lastActivityAt)}
                                  </span>
                                </td>
                                <td>
                                  <Link
                                    to={`/vendor-admin/students/${student.studentId}/analysis`}
                                    className="vh-btn vh-btn--ghost vh-btn--sm"
                                  >
                                    View profile
                                  </Link>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    <div className="vanalytics-pagination">
                      <span>
                        Page {classroomPagination.page || classroomPage} of {classroomPagination.totalPages} ·{' '}
                        {classroomPagination.total} students
                      </span>
                      <div className="vanalytics-pagination-actions">
                        <button
                          type="button"
                          className="vh-btn vh-btn--ghost vh-btn--sm"
                          disabled={classroomPage <= 1 || classroomLoading}
                          onClick={() => setClassroomPage((p) => Math.max(1, p - 1))}
                        >
                          <FiChevronLeft /> Previous
                        </button>
                        <button
                          type="button"
                          className="vh-btn vh-btn--ghost vh-btn--sm"
                          disabled={
                            classroomPage >= classroomPagination.totalPages || classroomLoading
                          }
                          onClick={() => setClassroomPage((p) => p + 1)}
                        >
                          Next <FiChevronRight />
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </section>
            </div>
          </>
        )}
      </section>
    </div>
  );

  return (
    <VendorHubPage
      className="vanalytics-page"
      eyebrow="Insights"
      title="Analytics"
      subtitle="Track engagement, test performance, and classroom progress without loading everything at once."
      accent="#6366f1"
      actions={
        <button type="button" className="vh-btn vh-btn--ghost" onClick={() => fetchOverview(trendDays)}>
          <FiRefreshCw /> Refresh
        </button>
      }
    >
      <div className="vanalytics-tabs" role="tablist" aria-label="Analytics views">
        {[
          { key: 'overview', label: 'Overview', icon: FiBarChart2 },
          { key: 'tests', label: 'Tests', icon: FiFileText },
          { key: 'classrooms', label: 'Classrooms', icon: FiGrid },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={activeTab === key}
            className={`vanalytics-tab ${activeTab === key ? 'is-active' : ''}`}
            onClick={() => setActiveTab(key)}
          >
            <Icon /> {label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && renderOverview()}
      {activeTab === 'tests' && renderTests()}
      {activeTab === 'classrooms' && renderClassrooms()}
    </VendorHubPage>
  );
};

export default Analytics;
