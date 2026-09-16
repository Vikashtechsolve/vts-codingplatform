import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axiosInstance from '../../../utils/axios';
import PracticePageLayout from '../../../components/Practice/PracticePageLayout';
import PracticeEmptyState from '../../../components/Practice/PracticeEmptyState';
import { formatStatus, statusClass } from '../../../components/Practice/practiceUtils';
import '../../../styles/practice-pages.css';

const PracticeSubmissions = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = () => {
    setLoading(true);
    axiosInstance.get('/practice/submissions', { params: { limit: 50 } })
      .then((res) => setItems(res.data.items || []))
      .catch((err) => setError(err.response?.data?.message || 'Failed to load submissions'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  return (
    <PracticePageLayout
      active="submissions"
      title="Submission History"
      subtitle="Review your recent practice attempts and revisit problems."
      compactHero
      loading={loading}
      error={error}
      onRetry={load}
    >
      {items.length ? (
        <div className="practice-table-wrap">
          <table className="practice-table">
            <thead>
              <tr>
                <th>Status</th>
                <th>Problem</th>
                <th>Tests</th>
                <th>Language</th>
                <th>Submitted</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((s) => (
                <tr key={s._id}>
                  <td>
                    <span className={`practice-status practice-status-${statusClass(s.status)}`}>
                      {formatStatus(s.status)}
                    </span>
                  </td>
                  <td className="practice-table-title">{s.questionId?.title || 'Question'}</td>
                  <td>{s.passedTests}/{s.totalTests}</td>
                  <td>{s.language}</td>
                  <td className="practice-meta-muted">
                    {new Date(s.submittedAt).toLocaleString()}
                  </td>
                  <td>
                    <Link
                      to={`/student/practice/solve/${s.questionId?._id || s.questionId}`}
                      className="practice-table-link"
                    >
                      Retry
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <PracticeEmptyState
          title="No submissions yet"
          description="Once you submit solutions, they'll appear here."
          actionLabel="Solve a problem"
          actionTo="/student/practice/problems"
        />
      )}
    </PracticePageLayout>
  );
};

export default PracticeSubmissions;
