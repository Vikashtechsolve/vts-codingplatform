import React, { useEffect, useState, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { FiDownload } from 'react-icons/fi';
import axiosInstance from '../../utils/axios';
import ExportReportModal from '../../components/ExportReportModal';
import VendorAssessPage from '../../components/VendorAdmin/VendorAssessPage';
import VendorScoreBadge from '../../components/VendorAdmin/VendorScoreBadge';
import VendorStatusBadge from '../../components/VendorAdmin/VendorStatusBadge';
import { formatDateTime } from '../../utils/vendorAssessmentUi';
import { matchesNestedStudentSearch } from '../../utils/studentBulkImport';

const InterviewResults = () => {
  const { interviewId } = useParams();
  const [sessions, setSessions] = useState([]);
  const [interview, setInterview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exportOpen, setExportOpen] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [sessionsRes, interviewRes] = await Promise.all([
          axiosInstance.get(`/interview-sessions/interview/${interviewId}`),
          axiosInstance.get(`/interviews/${interviewId}`).catch(() => ({ data: null })),
        ]);
        setSessions(sessionsRes.data || []);
        setInterview(interviewRes.data || null);
      } catch (error) {
        console.error('Error fetching interview sessions:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [interviewId]);

  const completed = sessions.filter((s) => s.status === 'completed');
  const avgScore =
    completed.length > 0
      ? Math.round(
          completed.reduce((sum, s) => sum + (s.overallScore ?? 0), 0) / completed.length
        )
      : 0;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sessions;
    return sessions.filter((s) => matchesNestedStudentSearch(s, q));
  }, [sessions, search]);

  const accent = '#c026d3';
  const title = interview?.title || 'Interview results';

  return (
    <VendorAssessPage
      loading={loading}
      backTo="/vendor-admin/tests?type=interview"
      backLabel="Back to interviews"
      eyebrow="Mock interview"
      title={title}
      subtitle={
        interview
          ? `${interview.interviewType} · ${interview.topic} · ${interview.difficulty}`
          : 'Session results and readiness scores.'
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
        optionsUrl={`/vendor-admin/interviews/${interviewId}/report-options`}
        exportUrl={`/vendor-admin/interviews/${interviewId}/export`}
        title={title}
      />

      {sessions.length > 0 && (
        <div className="va-stats">
          <div className="va-stat va-stat--accent">
            <span className="va-stat-label">Sessions</span>
            <span className="va-stat-value">{sessions.length}</span>
          </div>
          <div className="va-stat">
            <span className="va-stat-label">Completed</span>
            <span className="va-stat-value">{completed.length}</span>
          </div>
          <div className="va-stat">
            <span className="va-stat-label">Avg score</span>
            <span className="va-stat-value">{avgScore}/100</span>
          </div>
        </div>
      )}

      <div className="va-panel">
        <div className="va-panel-header">
          <h2>Sessions</h2>
        </div>
        <div className="va-panel-body">
          {sessions.length > 0 && (
            <div className="va-toolbar" style={{ marginTop: 0 }}>
              <div className="va-search">
                <input
                  type="search"
                  placeholder="Search by name, email, or enrollment number…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
          )}

          {filtered.length === 0 ? (
            <div className="va-empty">
              <div className="va-empty-icon">🎤</div>
              <h3>{search ? 'No matches' : 'No results yet'}</h3>
              <p>Results appear when students complete this interview session.</p>
            </div>
          ) : (
            <div className="va-table-wrap">
              <table className="va-table">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Status</th>
                    <th>Score</th>
                    <th>Readiness</th>
                    <th>Submitted</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((session) => (
                    <tr key={session._id}>
                      <td>
                        <strong>{session.studentId?.name}</strong>
                        <div className="va-cell-muted">
                          {session.studentId?.enrollmentNumber
                            ? `${session.studentId.enrollmentNumber} · ${session.studentId.email}`
                            : session.studentId?.email}
                        </div>
                      </td>
                      <td>
                        <VendorStatusBadge status={session.status} />
                      </td>
                      <td>
                        <strong>{session.overallScore ?? '—'}/100</strong>
                      </td>
                      <td>
                        {session.readinessPercent != null ? (
                          <VendorScoreBadge value={session.readinessPercent} />
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="va-cell-muted">{formatDateTime(session.submittedAt)}</td>
                      <td>
                        <Link
                          to={`/vendor-admin/interviews/results/${session._id}`}
                          className="va-btn va-btn--ghost va-btn--sm"
                        >
                          View details
                        </Link>
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

export default InterviewResults;
