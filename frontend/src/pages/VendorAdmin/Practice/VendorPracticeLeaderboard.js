import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiAward, FiExternalLink } from 'react-icons/fi';
import axiosInstance from '../../../utils/axios';
import VendorPracticeLayout, {
  VendorPracticeEmpty,
  getInitials,
} from '../../../components/VendorAdmin/Practice/VendorPracticeLayout';

const PODIUM_ORDER = [1, 0, 2]; // display: 2nd, 1st, 3rd

const PodiumCard = ({ row, place }) => {
  if (!row) return <div className="vp-podium-card" aria-hidden />;

  const placeClass = place === 1 ? 'vp-podium-card--first' : place === 2 ? 'vp-podium-card--second' : 'vp-podium-card--third';

  return (
    <article className={`vp-podium-card ${placeClass}`}>
      <span className={`vp-podium-rank vp-podium-rank--${place}`}>{place}</span>
      <span className="vp-avatar vp-podium-avatar" aria-hidden>{getInitials(row.name)}</span>
      <h3 className="vp-podium-name">{row.name}</h3>
      <p className="vp-podium-score">{row.codingScore}</p>
      <p className="vp-podium-meta">
        {row.problemsSolved} solved · {row.streak}d streak
      </p>
    </article>
  );
};

const VendorPracticeLeaderboard = () => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axiosInstance
      .get('/vendor-admin/practice/leaderboard')
      .then((res) => setRows(res.data.leaderboard || []))
      .finally(() => setLoading(false));
  }, []);

  const topThree = rows.slice(0, 3);

  return (
    <VendorPracticeLayout
      active="leaderboard"
      title="Practice Leaderboard"
      subtitle="Rankings based on coding score, problems solved, and consistency across your student batch."
      loading={loading}
      backTo="/vendor-admin/practice"
      actions={
        <Link to="/vendor-admin/practice" className="vh-btn vh-btn--secondary">
          Back to overview
        </Link>
      }
    >
      {rows.length ? (
        <>
          {topThree.length >= 1 && (
            <div className="vp-podium">
              {PODIUM_ORDER.map((idx) => (
                <PodiumCard key={idx} row={topThree[idx]} place={idx + 1} />
              ))}
            </div>
          )}

          <section className="vh-panel">
            <div className="vh-panel-head">
              <div>
                <h2 className="vh-panel-title">Full rankings</h2>
                <p className="vh-panel-desc">{rows.length} students on the board</p>
              </div>
            </div>
            <div className="vh-panel-body vh-panel-body--flush">
              <div className="vh-table-wrap">
                <table className="vh-table">
                  <thead>
                    <tr>
                      <th>Rank</th>
                      <th>Student</th>
                      <th>Score</th>
                      <th>Solved</th>
                      <th>Streak</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.studentId}>
                        <td>
                          <span className={`vp-rank-badge ${row.rank <= 3 ? `vp-rank-badge--${row.rank}` : ''}`}>
                            {row.rank}
                          </span>
                        </td>
                        <td>
                          <div className="vp-student-cell">
                            <span className="vp-avatar" aria-hidden>{getInitials(row.name)}</span>
                            <div className="vp-student-name">{row.name}</div>
                          </div>
                        </td>
                        <td><strong>{row.codingScore}</strong></td>
                        <td>{row.problemsSolved}</td>
                        <td>{row.streak} days</td>
                        <td>
                          <Link
                            to={`/vendor-admin/students/${row.studentId}/analysis`}
                            className="vh-btn vh-btn--secondary vh-btn--sm"
                          >
                            <FiExternalLink /> View
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </>
      ) : (
        <section className="vh-panel">
          <div className="vh-panel-body">
            <VendorPracticeEmpty
              icon={FiAward}
              title="No rankings yet"
              description="Leaderboard fills in as students solve practice problems. Make sure practice is enabled in settings."
            />
          </div>
        </section>
      )}
    </VendorPracticeLayout>
  );
};

export default VendorPracticeLeaderboard;
