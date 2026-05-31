import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FiDownload } from 'react-icons/fi';
import axiosInstance from '../../utils/axios';
import ExportReportModal from '../../components/ExportReportModal';
import VendorAssessPage from '../../components/VendorAdmin/VendorAssessPage';
import VendorScoreBadge from '../../components/VendorAdmin/VendorScoreBadge';
import VendorStatusBadge from '../../components/VendorAdmin/VendorStatusBadge';
import { formatDateTime } from '../../utils/vendorAssessmentUi';

const SystemDesignSubmissions = () => {
  const { id: problemId } = useParams();
  const navigate = useNavigate();
  const [problem, setProblem] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exportOpen, setExportOpen] = useState(false);
  const [search, setSearch] = useState('');

  const fetchSubmissions = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await axiosInstance.get(`/system-design-problems/${problemId}/submissions`);
      if (data.success) {
        setProblem(data.problem);
        setSubmissions(data.submissions);
      }
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  }, [problemId]);

  useEffect(() => {
    fetchSubmissions();
  }, [fetchSubmissions]);

  const formatTime = (seconds) => {
    if (!seconds) return '—';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s}s`;
  };

  const evaluated = submissions.filter((s) => s.status === 'evaluated');
  const avgScore =
    evaluated.length > 0
      ? Math.round(
          evaluated.reduce((sum, s) => sum + (s.percentage || 0), 0) / evaluated.length
        )
      : 0;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return submissions;
    return submissions.filter(
      (s) =>
        s.studentId?.name?.toLowerCase().includes(q) ||
        s.studentId?.email?.toLowerCase().includes(q)
    );
  }, [submissions, search]);

  const accent = '#ea580c';

  return (
    <VendorAssessPage
      loading={loading}
      backTo="/vendor-admin/tests?type=system"
      backLabel="Back to system design"
      eyebrow="System design"
      title={problem ? `Submissions: ${problem.title}` : 'Submissions'}
      subtitle={
        problem
          ? `${problem.category?.replace(/_/g, ' ')} · ${problem.difficulty} · architecture review`
          : 'Review diagrams, scores, and proctoring signals.'
      }
      accent={accent}
      actions={
        <button type="button" className="va-btn va-btn--primary" onClick={() => setExportOpen(true)}>
          <FiDownload /> Export report
        </button>
      }
    >
      <ExportReportModal
        isOpen={exportOpen}
        onClose={() => setExportOpen(false)}
        optionsUrl={`/vendor-admin/system-design/${problemId}/report-options`}
        exportUrl={`/vendor-admin/system-design/${problemId}/export`}
        title={problem?.title || 'System design report'}
      />

      {submissions.length > 0 && (
        <div className="va-stats">
          <div className="va-stat va-stat--accent">
            <span className="va-stat-label">Total</span>
            <span className="va-stat-value">{submissions.length}</span>
          </div>
          <div className="va-stat">
            <span className="va-stat-label">Evaluated</span>
            <span className="va-stat-value">{evaluated.length}</span>
          </div>
          <div className="va-stat">
            <span className="va-stat-label">Avg score</span>
            <span className="va-stat-value">{avgScore}%</span>
          </div>
        </div>
      )}

      <div className="va-panel">
        <div className="va-panel-header">
          <h2>All submissions</h2>
        </div>
        <div className="va-panel-body">
          {submissions.length > 0 && (
            <div className="va-toolbar" style={{ marginTop: 0 }}>
              <div className="va-search">
                <input
                  type="search"
                  placeholder="Search students…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
          )}

          {filtered.length === 0 ? (
            <div className="va-empty">
              <div className="va-empty-icon">🏗️</div>
              <h3>{search ? 'No matches' : 'No submissions yet'}</h3>
              <p>Student architecture submissions will show up here.</p>
            </div>
          ) : (
            <div className="va-table-wrap">
              <table className="va-table">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Status</th>
                    <th>Score</th>
                    <th>Time</th>
                    <th>Hints</th>
                    <th>Violations</th>
                    <th>Submitted</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((s) => (
                    <tr key={s._id}>
                      <td>
                        <strong>{s.studentId?.name || 'Unknown'}</strong>
                        <div className="va-cell-muted">{s.studentId?.email}</div>
                      </td>
                      <td>
                        <VendorStatusBadge status={s.status} />
                      </td>
                      <td>
                        {s.status === 'evaluated' ? (
                          <VendorScoreBadge value={s.percentage || 0} />
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="va-cell-muted">{formatTime(s.timeSpent)}</td>
                      <td>{s.hintsUsed?.length || 0}</td>
                      <td className={s.violationCount > 0 ? 'va-score va-score--poor' : ''}>
                        {s.violationCount || 0}
                      </td>
                      <td className="va-cell-muted">{formatDateTime(s.submittedAt)}</td>
                      <td>
                        <button
                          type="button"
                          className="va-btn va-btn--ghost va-btn--sm"
                          onClick={() => navigate(`/vendor-admin/system-design-result/${s._id}`)}
                        >
                          View details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </VendorAssessPage>
  );
};

export default SystemDesignSubmissions;
