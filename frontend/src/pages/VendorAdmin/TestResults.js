import React, { useState, useEffect, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { FiDownload, FiBarChart2 } from 'react-icons/fi';
import axiosInstance from '../../utils/axios';
import ExportReportModal from '../../components/ExportReportModal';
import VendorAssessPage from '../../components/VendorAdmin/VendorAssessPage';
import VendorScoreBadge from '../../components/VendorAdmin/VendorScoreBadge';
import VendorStatusBadge from '../../components/VendorAdmin/VendorStatusBadge';
import { computeResultStats, formatDateTime, scoreTone } from '../../utils/vendorAssessmentUi';
import { matchesNestedStudentSearch } from '../../utils/studentBulkImport';

const SECTION_LABELS = {
  english_grammar: 'Grammar',
  english_vocabulary: 'Vocabulary',
  english_reading: 'Reading',
  english_essay: 'Writing',
  english_speaking: 'Speaking',
  english_listening: 'Listening',
};

const TYPE_ACCENTS = {
  coding: '#2563eb',
  mcq: '#7c3aed',
  aptitude: '#059669',
  theory: '#475569',
  mixed: '#0891b2',
  sql: '#ca8a04',
  english: '#db2777',
};

const TestResults = () => {
  const { testId } = useParams();
  const [results, setResults] = useState([]);
  const [test, setTest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [speakingAnalytics, setSpeakingAnalytics] = useState(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchResults();
    fetchTest();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [testId]);

  const fetchResults = async () => {
    try {
      const response = await axiosInstance.get(`/vendor-admin/tests/${testId}/results`);
      setResults(response.data);
    } catch (error) {
      console.error('Error fetching results:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTest = async () => {
    try {
      const response = await axiosInstance.get(`/tests/${testId}`);
      setTest(response.data);
      if (response.data?.type === 'english') fetchSpeakingAnalytics();
    } catch (error) {
      console.error('Error fetching test:', error);
    }
  };

  const fetchSpeakingAnalytics = async () => {
    try {
      const response = await axiosInstance.get(`/vendor-admin/tests/${testId}/speaking-analytics`);
      if (response.data?.totalSubmissions > 0) setSpeakingAnalytics(response.data);
    } catch {
      /* optional */
    }
  };

  const stats = useMemo(
    () => computeResultStats(results, (r) => r.percentage),
    [results]
  );

  const filteredResults = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return results;
    return results.filter((r) => matchesNestedStudentSearch(r, q));
  }, [results, search]);

  const sectionAnalytics = useMemo(() => {
    if (test?.type !== 'english' || results.length === 0) return null;
    const completed = results.filter((r) => r.status === 'completed');
    if (!completed.length) return null;
    const sectionTypes = [
      ...new Set(completed.flatMap((r) => (r.sectionScores || []).map((s) => s.sectionType))),
    ];
    return sectionTypes.map((type) => {
      const scores = completed
        .map((r) => (r.sectionScores || []).find((s) => s.sectionType === type))
        .filter(Boolean);
      const percentages = scores.map((s) =>
        s.maxScore > 0 ? Math.round((s.score / s.maxScore) * 100) : 0
      );
      return {
        type,
        label: SECTION_LABELS[type] || type,
        avgPercent:
          percentages.length > 0
            ? Math.round(percentages.reduce((a, b) => a + b, 0) / percentages.length)
            : 0,
        highest: percentages.length ? Math.max(...percentages) : 0,
        lowest: percentages.length ? Math.min(...percentages) : 0,
      };
    });
  }, [test, results]);

  const accent = TYPE_ACCENTS[test?.type] || '#2563eb';
  const backTo = test?.type ? `/vendor-admin/tests?type=${test.type}` : '/vendor-admin/tests';

  return (
    <VendorAssessPage
      loading={loading}
      backTo={backTo}
      backLabel="Back to tests"
      eyebrow="Test results"
      title={test?.title || 'Results'}
      subtitle={
        test
          ? `${test.type} test · ${test.duration} min · ${results.length} submission${results.length !== 1 ? 's' : ''}`
          : 'Review student submissions and scores.'
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
        optionsUrl={`/vendor-admin/tests/${testId}/report-options`}
        exportUrl={`/vendor-admin/tests/${testId}/export`}
        title={test?.title || 'Test report'}
      />

      {results.length > 0 && (
        <div className="va-stats">
          <div className="va-stat va-stat--accent">
            <span className="va-stat-label">Submissions</span>
            <span className="va-stat-value">{stats.total}</span>
          </div>
          <div className="va-stat">
            <span className="va-stat-label">Completed</span>
            <span className="va-stat-value">{stats.completed}</span>
          </div>
          <div className="va-stat">
            <span className="va-stat-label">Average</span>
            <span className="va-stat-value">{stats.average}%</span>
          </div>
          <div className="va-stat">
            <span className="va-stat-label">Highest</span>
            <span className="va-stat-value">{stats.highest}%</span>
          </div>
          <div className="va-stat">
            <span className="va-stat-label">Lowest</span>
            <span className="va-stat-value">{stats.lowest}%</span>
          </div>
        </div>
      )}

      <div className="va-panel">
        <div className="va-panel-header">
          <h2>
            <FiBarChart2 style={{ verticalAlign: 'middle', marginRight: 6 }} />
            Submissions
          </h2>
        </div>
        <div className="va-panel-body">
          {results.length > 0 && (
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

          {filteredResults.length === 0 ? (
            <div className="va-empty">
              <div className="va-empty-icon">📊</div>
              <h3>{search ? 'No matches' : 'No submissions yet'}</h3>
              <p>
                {search
                  ? 'Try another search term.'
                  : 'Results appear here when students complete this test.'}
              </p>
            </div>
          ) : (
            <div className="va-table-wrap">
              <table className="va-table">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Score</th>
                    <th>%</th>
                    <th>Status</th>
                    <th>Submitted</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredResults.map((result) => (
                    <tr key={result._id}>
                      <td>
                        <strong>{result.studentId?.name || 'N/A'}</strong>
                        <div className="va-cell-muted">
                          {result.studentId?.enrollmentNumber
                            ? `${result.studentId.enrollmentNumber} · ${result.studentId.email}`
                            : result.studentId?.email}
                        </div>
                      </td>
                      <td>
                        <strong>
                          {result.totalScore} / {result.maxScore}
                        </strong>
                      </td>
                      <td>
                        <VendorScoreBadge value={result.percentage} />
                      </td>
                      <td>
                        <VendorStatusBadge status={result.status} />
                      </td>
                      <td className="va-cell-muted">{formatDateTime(result.submittedAt)}</td>
                      <td>
                        <Link
                          to={`/vendor-admin/results/${result._id}`}
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

      {sectionAnalytics && sectionAnalytics.length > 0 && (
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

      {speakingAnalytics && (
        <div className="va-panel">
          <div className="va-panel-header">
            <h2>Speaking analytics</h2>
          </div>
          <div className="va-panel-body">
            <div className="va-stats" style={{ marginBottom: 16 }}>
              <div className="va-stat">
                <span className="va-stat-label">Submissions</span>
                <span className="va-stat-value">{speakingAnalytics.totalSubmissions}</span>
              </div>
              <div className="va-stat">
                <span className="va-stat-label">Avg WPM</span>
                <span className="va-stat-value">{speakingAnalytics.avgSpeakingRate}</span>
              </div>
              <div className="va-stat">
                <span className="va-stat-label">Filler words</span>
                <span className="va-stat-value">{speakingAnalytics.avgFillerWords}</span>
              </div>
              <div className="va-stat">
                <span className="va-stat-label">Vocab diversity</span>
                <span className="va-stat-value">{speakingAnalytics.avgVocabDiversity}%</span>
              </div>
            </div>
            <div className="va-analytics-grid">
              {Object.entries(speakingAnalytics.averages || {}).map(([key, val]) => (
                <div key={key} className="va-analytics-card">
                  <h3>{key.charAt(0).toUpperCase() + key.slice(1)}</h3>
                  <div className="va-bar-track">
                    <div
                      className={`va-bar-fill va-bar-fill--${scoreTone(val)}`}
                      style={{ width: `${val}%` }}
                    />
                  </div>
                  <div className="va-analytics-meta">
                    <strong>{val}%</strong>
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

export default TestResults;
