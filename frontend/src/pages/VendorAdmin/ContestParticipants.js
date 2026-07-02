import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { FiUsers, FiSearch, FiBarChart2 } from 'react-icons/fi';
import { Link } from 'react-router-dom';
import axiosInstance from '../../utils/axios';
import { useToast } from '../../context/ToastContext';
import VendorHubPage from '../../components/VendorAdmin/VendorHubPage';
import { VENDOR_ACCENT } from '../../constants/vendorSections';
import './ContestParticipants.css';

const formatDate = (d) =>
  d ? new Date(d).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—';

const STATUS_LABEL = {
  registered: 'Registered',
  in_progress: 'In progress',
  completed: 'Completed',
  disqualified: 'Disqualified',
};

const ContestParticipants = () => {
  const { id } = useParams();
  const { showToast } = useToast();
  const [contest, setContest] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [contestRes, participantsRes] = await Promise.all([
        axiosInstance.get(`/contests/vendor/${id}`),
        axiosInstance.get(`/contests/vendor/${id}/participants`),
      ]);
      setContest(contestRes.data);
      setParticipants(participantsRes.data.participants || []);
      setLeaderboard(participantsRes.data.leaderboard || []);
    } catch {
      showToast('Failed to load participants', 'error');
    } finally {
      setLoading(false);
    }
  }, [id, showToast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return participants;
    return participants.filter(
      (p) =>
        p.name?.toLowerCase().includes(q) ||
        p.email?.toLowerCase().includes(q) ||
        p.registrationMeta?.college?.toLowerCase().includes(q) ||
        p.registrationMeta?.rollNumber?.toLowerCase().includes(q)
    );
  }, [participants, search]);

  const stats = useMemo(() => ({
    total: participants.length,
    completed: participants.filter((p) => p.status === 'completed').length,
    inProgress: participants.filter((p) => p.status === 'in_progress').length,
  }), [participants]);

  return (
    <VendorHubPage
      className="vco-page"
      loading={loading && !contest}
      backTo="/vendor-admin/contests"
      backLabel="Back to contests"
      eyebrow="Contest roster"
      title={contest?.title || 'Participants'}
      subtitle="Contest-only registrants — not included in your main student management list."
      accent={VENDOR_ACCENT}
      actions={
        <Link to={`/vendor-admin/contests/${id}/results`} className="vh-btn vh-btn--primary">
          <FiBarChart2 /> Full analysis & export
        </Link>
      }
    >
      <div className="vh-stats vco-stats">
        <div className="vh-stat vh-stat--accent">
          <span className="vh-stat-label">Registered</span>
          <span className="vh-stat-value">{stats.total}</span>
        </div>
        <div className="vh-stat">
          <span className="vh-stat-label">In progress</span>
          <span className="vh-stat-value">{stats.inProgress}</span>
        </div>
        <div className="vh-stat">
          <span className="vh-stat-label">Completed</span>
          <span className="vh-stat-value">{stats.completed}</span>
        </div>
      </div>

      {leaderboard.length > 0 && (
        <section className="vh-panel vco-panel">
          <div className="vh-panel-head">
            <div>
              <h2 className="vh-panel-title">Leaderboard</h2>
              <p className="vh-panel-desc">Ranked by score after submission.</p>
            </div>
          </div>
          <div className="vh-panel-body vh-panel-body--flush">
            <div className="vh-table-wrap">
              <table className="vh-table">
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Name</th>
                    <th>Score</th>
                    <th>%</th>
                    <th>Finished</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map((row) => (
                    <tr key={row.rank}>
                      <td>
                        <span className={`vco-rank ${row.rank <= 3 ? 'vco-rank--top' : ''}`}>{row.rank}</span>
                      </td>
                      <td className="vh-cell-title">{row.studentName}</td>
                      <td>{row.score}/{row.maxScore}</td>
                      <td><strong>{row.percentage}%</strong></td>
                      <td className="vh-cell-muted">{formatDate(row.submittedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      <section className="vh-panel vco-panel">
        <div className="vh-panel-head">
          <div>
            <h2 className="vh-panel-title">All participants</h2>
            <p className="vh-panel-desc">{participants.length} registration{participants.length !== 1 ? 's' : ''}</p>
          </div>
          <div className="vh-search vco-participants-search">
            <FiSearch />
            <input
              type="search"
              placeholder="Search name, email, college, or roll number…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        <div className="vh-panel-body vh-panel-body--flush">
          {filtered.length === 0 ? (
            <div className="vco-empty vco-empty--compact">
              <div className="vh-empty-icon">
                <FiUsers />
              </div>
              <h2>{search ? 'No matches' : 'No registrations yet'}</h2>
              <p>{search ? 'Try another search.' : 'Share the contest link to start collecting registrations.'}</p>
            </div>
          ) : (
            <div className="vh-table-wrap">
              <table className="vh-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Status</th>
                    <th>Registered</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => (
                    <tr key={p.id}>
                      <td className="vh-cell-title">{p.name}</td>
                      <td className="vh-cell-muted">{p.email}</td>
                      <td>
                        <span className={`vco-participant-status vco-participant-status--${p.status}`}>
                          {STATUS_LABEL[p.status] || p.status}
                        </span>
                      </td>
                      <td className="vh-cell-muted">{formatDate(p.registeredAt)}</td>
                      <td className="vh-cell-muted">
                        {[p.registrationMeta?.college, p.registrationMeta?.rollNumber, p.registrationMeta?.phone]
                          .filter(Boolean)
                          .join(' · ') || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </VendorHubPage>
  );
};

export default ContestParticipants;
