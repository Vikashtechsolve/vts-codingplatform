import React, { useEffect, useState, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { FiDownload, FiBarChart2, FiAward } from 'react-icons/fi';
import axiosInstance from '../../utils/axios';
import ExportReportModal from '../../components/ExportReportModal';
import VendorAssessPage from '../../components/VendorAdmin/VendorAssessPage';
import VendorScoreBadge from '../../components/VendorAdmin/VendorScoreBadge';
import VendorStatusBadge from '../../components/VendorAdmin/VendorStatusBadge';
import { VENDOR_ACCENT } from '../../constants/vendorSections';
import { formatDateTime, scoreTone } from '../../utils/vendorAssessmentUi';

const ASSESSMENT_LABELS = {
  test: 'Test',
  interview: 'Interview',
  assignment: 'Assignment',
  system_design: 'System Design',
};

const getDetailLink = (contest, row) => {
  if (!row.resultId) return null;
  if (contest.assessmentType === 'test') {
    return `/vendor-admin/results/${row.resultId}`;
  }
  if (contest.assessmentType === 'interview') {
    return `/vendor-admin/interviews/results/${row.resultId}`;
  }
  if (contest.assessmentType === 'assignment') {
    return `/vendor-admin/submission/${row.resultId}/result`;
  }
  if (contest.assessmentType === 'system_design') {
    return `/vendor-admin/system-design-result/${row.resultId}`;
  }
  return null;
};

const ContestResults = () => {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [exportOpen, setExportOpen] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setFetchError('');
        const { data: res } = await axiosInstance.get(`/contests/vendor/${id}/results`);
        setData(res);
      } catch (error) {
        console.error('Error fetching contest results:', error);
        setFetchError(error.response?.data?.message || 'Failed to load contest results');
        setData(null);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  const contest = data?.contest;
  const rows = data?.rows || [];
  const analytics = data?.analytics;

  const sortByRank = (list) =>
    [...list].sort((a, b) => {
      if (a.rank == null && b.rank == null) return 0;
      if (a.rank == null) return 1;
      if (b.rank == null) return -1;
      return a.rank - b.rank;
    });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q
      ? rows.filter(
          (r) =>
            r.studentId?.name?.toLowerCase().includes(q) ||
            r.studentId?.email?.toLowerCase().includes(q) ||
            r.registrationMeta?.college?.toLowerCase().includes(q)
        )
      : rows;
    return sortByRank(list);
  }, [rows, search]);

  const sectionAnalytics = useMemo(() => {
    if (contest?.assessmentType !== 'test' || contest?.assessment?.type !== 'english') return null;
    const completed = rows.filter((r) => r.sectionScores?.length);
    if (!completed.length) return null;
    const sectionTypes = [...new Set(completed.flatMap((r) => r.sectionScores.map((s) => s.sectionType)))];
    return sectionTypes.map((type) => {
      const scores = completed
        .map((r) => r.sectionScores.find((s) => s.sectionType === type))
        .filter(Boolean);
      const percentages = scores.map((s) =>
        s.maxScore > 0 ? Math.round((s.score / s.maxScore) * 100) : 0
      );
      return {
        type,
        label: type.replace('english_', '').replace(/^\w/, (c) => c.toUpperCase()),
        avgPercent: percentages.length
          ? Math.round(percentages.reduce((a, b) => a + b, 0) / percentages.length)
          : 0,
        highest: percentages.length ? Math.max(...percentages) : 0,
        lowest: percentages.length ? Math.min(...percentages) : 0,
      };
    });
  }, [contest, rows]);

  const subtitle = contest
    ? `${ASSESSMENT_LABELS[contest.assessmentType]} · ${contest.assessment?.title || ''} · ${analytics?.registered ?? 0} registered`
    : 'Contest performance and submissions';

  return (
    <VendorAssessPage
      loading={loading}
      backTo="/vendor-admin/contests"
      backLabel="Back to contests"
      eyebrow="Contest analysis"
      title={contest?.title || 'Contest results'}
      subtitle={subtitle}
      accent={VENDOR_ACCENT}
      actions={
        <button type="button" className="va-btn va-btn--primary" onClick={() => setExportOpen(true)}>
          <FiDownload /> Export report
        </button>
      }
    >
      <ExportReportModal
        isOpen={exportOpen}
        onClose={() => setExportOpen(false)}
        optionsUrl={`/contests/vendor/${id}/report-options`}
        exportUrl={`/contests/vendor/${id}/export`}
        title={contest?.title ? `${contest.title} — contest report` : 'Contest report'}
      />

      {fetchError && (
        <div className="va-panel">
          <div className="va-panel-body">
            <div className="va-empty">
              <div className="va-empty-icon">⚠️</div>
              <h3>Could not load results</h3>
              <p>{fetchError}</p>
            </div>
          </div>
        </div>
      )}

      {!fetchError && analytics && (
        <div className="va-stats">
          <div className="va-stat va-stat--accent">
            <span className="va-stat-label">Registered</span>
            <span className="va-stat-value">{analytics.registered}</span>
          </div>
          <div className="va-stat">
            <span className="va-stat-label">Completed</span>
            <span className="va-stat-value">{analytics.completed}</span>
          </div>
          <div className="va-stat">
            <span className="va-stat-label">In progress</span>
            <span className="va-stat-value">{analytics.inProgress}</span>
          </div>
          <div className="va-stat">
            <span className="va-stat-label">Average</span>
            <span className="va-stat-value">{analytics.average}%</span>
          </div>
          <div className="va-stat">
            <span className="va-stat-label">Highest</span>
            <span className="va-stat-value">{analytics.highest}%</span>
          </div>
          <div className="va-stat">
            <span className="va-stat-label">Lowest</span>
            <span className="va-stat-value">{analytics.lowest}%</span>
          </div>
        </div>
      )}

      {!fetchError && analytics?.distribution && analytics.completed > 0 && (
        <div className="va-panel">
          <div className="va-panel-header">
            <h2>
              <FiBarChart2 style={{ verticalAlign: 'middle', marginRight: 6 }} />
              Score distribution
            </h2>
          </div>
          <div className="va-panel-body">
            <div className="va-analytics-grid">
              {[
                { key: 'excellent', label: 'Excellent (80%+)', color: 'excellent' },
                { key: 'good', label: 'Good (60–79%)', color: 'good' },
                { key: 'average', label: 'Average (40–59%)', color: 'neutral' },
                { key: 'poor', label: 'Below 40%', color: 'poor' },
              ].map(({ key, label, color }) => {
                const count = analytics.distribution[key] || 0;
                const pct = analytics.completed
                  ? Math.round((count / analytics.completed) * 100)
                  : 0;
                return (
                  <div key={key} className="va-analytics-card">
                    <h3>{label}</h3>
                    <div className="va-bar-track">
                      <div
                        className={`va-bar-fill va-bar-fill--${color}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="va-analytics-meta">
                      <strong>{count}</strong> students ({pct}%)
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {!fetchError && (
      <div className="va-panel">
        <div className="va-panel-header">
          <h2>
            <FiAward style={{ verticalAlign: 'middle', marginRight: 6 }} />
            Participants & results
          </h2>
        </div>
        <div className="va-panel-body">
          {rows.length > 0 && (
            <div className="va-toolbar" style={{ marginTop: 0 }}>
              <div className="va-search">
                <input
                  type="search"
                  placeholder="Search participants…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
          )}

          {filtered.length === 0 ? (
            <div className="va-empty">
              <div className="va-empty-icon">📊</div>
              <h3>{search ? 'No matches' : 'No participants yet'}</h3>
              <p>
                {search
                  ? 'Try another search term.'
                  : contest?.status === 'ended'
                    ? 'This contest has ended but no one registered or completed an attempt.'
                    : 'Results appear when contest participants complete their attempts.'}
              </p>
            </div>
          ) : (
            <div className="va-table-wrap">
              <table className="va-table">
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Participant</th>
                    <th>Contest status</th>
                    <th>Score</th>
                    <th>%</th>
                    <th>Attempt</th>
                    <th>Finished</th>
                    <th>Time</th>
                    <th>Registered</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row) => {
                    const detailLink = getDetailLink(contest, row);
                    const meta = [
                      row.registrationMeta?.college,
                      row.registrationMeta?.rollNumber,
                    ]
                      .filter(Boolean)
                      .join(' · ');
                    return (
                      <tr key={row.participantId}>
                        <td>{row.rank ?? '—'}</td>
                        <td>
                          <strong>{row.studentId?.name || '—'}</strong>
                          <div className="va-cell-muted">{row.studentId?.email}</div>
                          {meta && <div className="va-cell-muted">{meta}</div>}
                        </td>
                        <td>
                          <VendorStatusBadge status={row.participantStatus} />
                        </td>
                        <td>
                          {row.totalScore != null && row.maxScore != null ? (
                            <strong>
                              {row.totalScore} / {row.maxScore}
                            </strong>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td>
                          {row.percentage != null ? (
                            <VendorScoreBadge value={row.percentage} />
                          ) : (
                            '—'
                          )}
                        </td>
                        <td>
                          <VendorStatusBadge status={row.attemptStatus} />
                        </td>
                        <td className="va-cell-muted">{formatDateTime(row.submittedAt)}</td>
                        <td className="va-cell-muted">
                          {row.timeSpent != null
                            ? `${Math.round(row.timeSpent / 60)} min`
                            : '—'}
                        </td>
                        <td className="va-cell-muted">{formatDateTime(row.registeredAt)}</td>
                        <td>
                          {detailLink ? (
                            <Link to={detailLink} className="va-btn va-btn--ghost va-btn--sm">
                              View details
                            </Link>
                          ) : (
                            <span className="va-cell-muted">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      )}

      {!fetchError && sectionAnalytics && sectionAnalytics.length > 0 && (
        <div className="va-panel">
          <div className="va-panel-header">
            <h2>Section analytics</h2>
          </div>
          <div className="va-panel-body">
            <div className="va-analytics-grid">
              {sectionAnalytics.map((sec) => (
                <div key={sec.type} className="va-analytics-card">
                  <h3>{sec.label}</h3>
                  <div className="va-bar-track">
                    <div
                      className={`va-bar-fill va-bar-fill--${scoreTone(sec.avgPercent)}`}
                      style={{ width: `${sec.avgPercent}%` }}
                    />
                  </div>
                  <div className="va-analytics-meta">
                    <span>
                      Avg <strong>{sec.avgPercent}%</strong>
                    </span>
                    <span>
                      {sec.lowest}% – {sec.highest}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </VendorAssessPage>
  );
};

export default ContestResults;
