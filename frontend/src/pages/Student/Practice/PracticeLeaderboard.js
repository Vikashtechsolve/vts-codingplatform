import React, { useEffect, useMemo, useState } from 'react';
import { FiZap } from 'react-icons/fi';
import axiosInstance from '../../../utils/axios';
import { useAuth } from '../../../context/AuthContext';
import PracticePageLayout from '../../../components/Practice/PracticePageLayout';
import PracticeEmptyState from '../../../components/Practice/PracticeEmptyState';
import '../../../styles/practice-pages.css';

const initials = (name = '') => {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return parts.slice(0, 2).map((p) => p[0].toUpperCase()).join('');
};

const PracticeLeaderboard = () => {
  const { user } = useAuth();
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

  const rows = useMemo(() => data?.leaderboard || [], [data]);
  const youMeta = data?.you;
  const myId = (user?.id || user?._id) ? String(user.id || user._id) : '';
  const youRow = useMemo(
    () => rows.find((row) => String(row.studentId) === myId),
    [rows, myId],
  );

  return (
    <PracticePageLayout
      active="leaderboard"
      title="Rankings"
      subtitle={
        youMeta
          ? `You're #${youMeta.rank} of ${youMeta.total} in your batch.`
          : 'See how you stack up against your batch.'
      }
      compactHero
      loading={loading}
      loadingVariant="rankings"
      loadingMessage="Loading rankings…"
      error={error}
      onRetry={load}
    >
      {rows.length ? (
        <>
          {youMeta && (
            <div className="ps-rank-summary" aria-label="Your ranking">
              <div className="ps-rank-summary-place">
                <span className="ps-rank-summary-kicker">Your rank</span>
                <strong>#{youMeta.rank}</strong>
                <span className="ps-rank-summary-of">of {youMeta.total}</span>
              </div>
              <ul className="ps-rank-summary-stats">
                <li>
                  <em>{youMeta.percentile}%</em>
                  percentile
                </li>
                <li>
                  <em>{youRow?.codingScore ?? '—'}</em>
                  score
                </li>
                <li>
                  <em>{youRow?.problemsSolved ?? '—'}</em>
                  solved
                </li>
                <li>
                  <em>{youRow?.streak ?? 0}d</em>
                  streak
                </li>
              </ul>
            </div>
          )}

          <div className="ps-rank-panel">
            <table className="ps-rank-table">
              <thead>
                <tr>
                  <th className="ps-rank-col-rank">Rank</th>
                  <th>Student</th>
                  <th>Score</th>
                  <th>Solved</th>
                  <th>Success</th>
                  <th>Streak</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const isYou = String(row.studentId) === myId;
                  return (
                    <tr
                      key={row.studentId}
                      className={`${isYou ? 'is-you' : ''} ${row.rank <= 3 ? `is-place-${row.rank}` : ''}`}
                      aria-current={isYou ? 'true' : undefined}
                    >
                      <td className="ps-rank-col-rank">
                        <span className={`practice-rank-badge ${row.rank <= 3 ? `practice-rank-${row.rank}` : ''}`}>
                          {row.rank}
                        </span>
                      </td>
                      <td>
                        <div className="ps-rank-student">
                          <span className="ps-rank-avatar" aria-hidden>{initials(row.name)}</span>
                          <span className="ps-rank-name">
                            {row.name}
                            {isYou ? <span className="ps-you-pill">You</span> : null}
                          </span>
                        </div>
                      </td>
                      <td className="ps-rank-num">{row.codingScore}</td>
                      <td className="ps-rank-num">{row.problemsSolved}</td>
                      <td className="ps-rank-num">{row.successRate}%</td>
                      <td className="ps-rank-num ps-rank-streak">
                        <FiZap aria-hidden />
                        {row.streak}d
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
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
