import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { FiDownload, FiRefreshCw } from 'react-icons/fi';
import axiosInstance from '../../utils/axios';
import ExportReportModal from '../../components/ExportReportModal';
import VendorAssessPage from '../../components/VendorAdmin/VendorAssessPage';
import VendorScoreBadge from '../../components/VendorAdmin/VendorScoreBadge';
import VendorStatusBadge from '../../components/VendorAdmin/VendorStatusBadge';
import { formatDateTime } from '../../utils/vendorAssessmentUi';
import { matchesNestedStudentSearch } from '../../utils/studentBulkImport';

const AssignmentSubmissions = () => {
  const { id: assignmentId } = useParams();
  const [submissions, setSubmissions] = useState([]);
  const [assignment, setAssignment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exportOpen, setExportOpen] = useState(false);
  const [search, setSearch] = useState('');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [submissionsRes, assignmentRes] = await Promise.all([
        axiosInstance.get(`/project-submissions/assignment/${assignmentId}`),
        axiosInstance.get(`/assignments/${assignmentId}`),
      ]);
      if (submissionsRes.data?.success) {
        setSubmissions(submissionsRes.data.submissions || []);
      }
      if (assignmentRes.data?.success) {
        setAssignment(assignmentRes.data.assignment);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }, [assignmentId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRetry = async (submissionId) => {
    if (!window.confirm('Retry AI evaluation for this submission?')) return;
    try {
      await axiosInstance.post(`/project-submissions/${submissionId}/retry-evaluation`);
      fetchData();
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to retry');
    }
  };

  const evaluated = submissions.filter((s) => s.status === 'evaluated');
  const avgPct =
    evaluated.length > 0
      ? Math.round(
          evaluated.reduce((sum, s) => sum + (s.evaluationResult?.percentage || 0), 0) /
            evaluated.length
        )
      : 0;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return submissions;
    return submissions.filter((s) => matchesNestedStudentSearch(s, q));
  }, [submissions, search]);

  const accent = '#6366f1';

  return (
    <VendorAssessPage
      loading={loading}
      backTo="/vendor-admin/tests?type=project"
      backLabel="Back to projects"
      eyebrow="Project evaluation"
      title={assignment?.title ? `Submissions: ${assignment.title}` : 'Submissions'}
      subtitle="AI-graded repository submissions with feature checklist scores."
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
        optionsUrl={`/vendor-admin/assignments/${assignmentId}/report-options`}
        exportUrl={`/vendor-admin/assignments/${assignmentId}/export`}
        title={assignment?.title || 'Assignment report'}
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
            <span className="va-stat-value">{avgPct}%</span>
          </div>
          <div className="va-stat">
            <span className="va-stat-label">Max marks</span>
            <span className="va-stat-value">{assignment?.totalMarks ?? '—'}</span>
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
                  placeholder="Search by name, email, or enrollment number…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
          )}

          {filtered.length === 0 ? (
            <div className="va-empty">
              <div className="va-empty-icon">📁</div>
              <h3>{search ? 'No matches' : 'No submissions yet'}</h3>
              <p>Students will appear here after they submit their project repository.</p>
            </div>
          ) : (
            <div className="va-table-wrap">
              <table className="va-table">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Score</th>
                    <th>Grade</th>
                    <th>Status</th>
                    <th>Submitted</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((sub) => (
                    <tr key={sub._id}>
                      <td>
                        <strong>{sub.studentId?.name || 'N/A'}</strong>
                        <div className="va-cell-muted">
                          {sub.studentId?.enrollmentNumber
                            ? `${sub.studentId.enrollmentNumber} · ${sub.studentId.email}`
                            : sub.studentId?.email}
                        </div>
                      </td>
                      <td>
                        {sub.evaluationResult ? (
                          <strong>
                            {sub.evaluationResult.totalScore} / {assignment?.totalMarks || 100}
                          </strong>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>
                        {sub.evaluationResult?.grade ? (
                          <VendorScoreBadge
                            value={`${sub.evaluationResult.grade} (${sub.evaluationResult.percentage}%)`}
                            suffix=""
                          />
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>
                        <VendorStatusBadge status={sub.status} />
                      </td>
                      <td className="va-cell-muted">{formatDateTime(sub.submittedAt)}</td>
                      <td className="va-cell-actions">
                        {sub.status === 'evaluated' && (
                          <Link
                            to={`/vendor-admin/submission/${sub._id}/result`}
                            state={{
                              backPath: `/vendor-admin/assignments/${assignmentId}/submissions`,
                              backLabel: 'Back to submissions',
                            }}
                            className="va-btn va-btn--ghost va-btn--sm"
                          >
                            View result
                          </Link>
                        )}
                        {sub.status === 'failed' && (
                          <button
                            type="button"
                            className="va-btn va-btn--secondary va-btn--sm"
                            onClick={() => handleRetry(sub._id)}
                          >
                            <FiRefreshCw /> Retry
                          </button>
                        )}
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

export default AssignmentSubmissions;
