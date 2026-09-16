import React, { useEffect, useState } from 'react';
import axiosInstance from '../../../utils/axios';
import PracticePageLayout from '../../../components/Practice/PracticePageLayout';
import PracticeEmptyState from '../../../components/Practice/PracticeEmptyState';
import '../../../styles/practice-pages.css';

const PracticeLeaderboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = () => {
    setLoading(true);
    axiosInstance.get('/practice/leaderboard')
      .then((res) => setData(res.data))
      .catch((err) => setError(err.response?.data?.message || 'Failed to load leaderboard'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const rows = data?.leaderboard || [];

  return (
    <PracticePageLayout
      active="leaderboard"
      title="Leaderboard"
      subtitle={
        data?.you
          ? `You are ranked #${data.you.rank} of ${data.you.total} (top ${data.you.percentile}% of your batch).`
          : 'See how you rank among your batch.'
      }
      compactHero
      loading={loading}
      error={error}
      onRetry={load}
    >
      {rows.length ? (
        <div className="practice-table-wrap">
          <table className="practice-leaderboard-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Student</th>
                <th>Score</th>
                <th>Solved</th>
                <th>Success</th>
                <th>Streak</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.studentId}>
                  <td>
                    <span className={`practice-rank-badge ${row.rank <= 3 ? `practice-rank-${row.rank}` : ''}`}>
                      {row.rank}
                    </span>
                  </td>
                  <td><strong>{row.name}</strong></td>
                  <td>{row.codingScore}</td>
                  <td>{row.problemsSolved}</td>
                  <td>{row.successRate}%</td>
                  <td>{row.streak}d</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <PracticeEmptyState
          title="No rankings yet"
          description="Be the first in your batch to solve a practice problem."
          actionLabel="Start practicing"
          actionTo="/student/practice/problems"
        />
      )}
    </PracticePageLayout>
  );
};

export default PracticeLeaderboard;
