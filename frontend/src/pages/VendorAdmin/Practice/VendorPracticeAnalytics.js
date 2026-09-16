import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FiUsers,
  FiCheckCircle,
  FiTrendingUp,
  FiTarget,
  FiAward,
  FiExternalLink,
} from 'react-icons/fi';
import axiosInstance from '../../../utils/axios';
import VendorPracticeLayout, {
  VendorPracticeInsight,
  VendorPracticeEmpty,
  getInitials,
  scoreTone,
} from '../../../components/VendorAdmin/Practice/VendorPracticeLayout';

const SettingToggle = ({ label, description, checked, onChange }) => (
  <div className="vp-setting-row">
    <div className="vp-setting-info">
      <strong>{label}</strong>
      {description && <span>{description}</span>}
    </div>
    <label className="vp-switch">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="vp-switch-slider" />
    </label>
  </div>
);

const VendorPracticeAnalytics = () => {
  const [overview, setOverview] = useState(null);
  const [students, setStudents] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      axiosInstance.get('/vendor-admin/practice/analytics/overview'),
      axiosInstance.get('/vendor-admin/practice/analytics/students', { params: { limit: 20 } }),
      axiosInstance.get('/vendor-admin/practice/settings'),
    ])
      .then(([o, s, set]) => {
        setOverview(o.data);
        setStudents(s.data.items || []);
        setSettings(set.data.practice);
      })
      .finally(() => setLoading(false));
  }, []);

  const updateSetting = async (key, value) => {
    const next = { ...settings, [key]: value };
    setSettings(next);
    setSaving(true);
    try {
      await axiosInstance.put('/vendor-admin/practice/settings', next);
    } catch {
      setSettings(settings);
    } finally {
      setSaving(false);
    }
  };

  const inactive = (overview?.totalStudents || 0) - (overview?.activeStudents || 0);
  const topics = (overview?.topicWeakness || []).slice(0, 6);

  return (
    <VendorPracticeLayout
      active="analytics"
      title="Practice Analytics"
      subtitle="Monitor student coding practice, tune visibility settings, and spot skill gaps across your batch."
      loading={loading}
      actions={
        <Link to="/vendor-admin/practice/leaderboard" className="vh-btn vh-btn--primary">
          <FiAward /> View leaderboard
        </Link>
      }
    >
      <div className="vp-insight-strip">
        <VendorPracticeInsight
          icon={FiUsers}
          value={overview?.activeStudents ?? 0}
          label="Active students"
          hint={`${overview?.totalStudents ?? 0} enrolled · ${inactive} not started`}
          accent
        />
        <VendorPracticeInsight
          icon={FiCheckCircle}
          value={overview?.avgSolved ?? 0}
          label="Avg problems solved"
          hint="Per active student"
        />
        <VendorPracticeInsight
          icon={FiTarget}
          value={overview?.avgCodingScore ?? 0}
          label="Avg coding score"
          hint="Practice performance index"
        />
        <VendorPracticeInsight
          icon={FiTrendingUp}
          value={`${overview?.successRate ?? 0}%`}
          label="Batch success rate"
          hint="Solved vs attempted"
        />
      </div>

      <div className="vp-grid-2">
        <section className="vh-panel">
          <div className="vh-panel-head">
            <div>
              <h2 className="vh-panel-title">Student progress</h2>
              <p className="vh-panel-desc">Top performers in your organization</p>
            </div>
            <Link to="/vendor-admin/practice/leaderboard" className="vh-btn vh-btn--secondary vh-btn--sm">
              Full rankings
            </Link>
          </div>
          <div className="vh-panel-body vh-panel-body--flush">
            {students.length ? (
              <div className="vh-table-wrap">
                <table className="vh-table">
                  <thead>
                    <tr>
                      <th>Student</th>
                      <th>Score</th>
                      <th>Solved</th>
                      <th>Success</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((row) => {
                      const name = row.studentId?.name || 'Student';
                      const tone = scoreTone(row.codingScore || 0);
                      return (
                        <tr key={row._id || row.studentId?._id}>
                          <td>
                            <div className="vp-student-cell">
                              <span className="vp-avatar" aria-hidden>{getInitials(name)}</span>
                              <div style={{ minWidth: 0 }}>
                                <div className="vp-student-name">{name}</div>
                                {row.studentId?.email && (
                                  <div className="vp-student-email">{row.studentId.email}</div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td>
                            <span className={`vp-score-pill vp-score-pill--${tone}`}>
                              {row.codingScore ?? 0}
                            </span>
                          </td>
                          <td>{row.problemsSolved ?? 0}</td>
                          <td>{row.successRate ?? 0}%</td>
                          <td>
                            <Link
                              to={`/vendor-admin/students/${row.studentId?._id}/analysis`}
                              className="vh-btn vh-btn--secondary vh-btn--sm"
                            >
                              <FiExternalLink /> Analysis
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ padding: 24 }}>
                <VendorPracticeEmpty
                  title="No practice activity yet"
                  description="Students haven't started solving practice problems. Enable practice and encourage them to begin."
                />
              </div>
            )}
          </div>
        </section>

        <section className="vh-panel">
          <div className="vh-panel-head">
            <div>
              <h2 className="vh-panel-title">Practice settings</h2>
              <p className="vh-panel-desc">
                Control what students see {saving ? '· Saving…' : ''}
              </p>
            </div>
          </div>
          <div className="vh-panel-body">
            <div className="vp-settings-grid">
              <SettingToggle
                label="Enable practice"
                description="Show the Practice section in the student panel"
                checked={settings?.enabled !== false}
                onChange={(v) => updateSetting('enabled', v)}
              />
              <SettingToggle
                label="Show leaderboard"
                description="Let students compare rankings within your org"
                checked={settings?.showLeaderboard !== false}
                onChange={(v) => updateSetting('showLeaderboard', v)}
              />
              <SettingToggle
                label="Show global rank"
                description="Display platform-wide percentile on student profiles"
                checked={settings?.showGlobalRank === true}
                onChange={(v) => updateSetting('showGlobalRank', v)}
              />
              <div className="vp-setting-row">
                <div className="vp-setting-info">
                  <strong>Daily goal default</strong>
                  <span>Target problems per day for new students</span>
                </div>
                <div className="vp-setting-input-wrap">
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={settings?.defaultDailyGoal ?? 2}
                    onChange={(e) => updateSetting('defaultDailyGoal', Number(e.target.value) || 2)}
                  />
                  <span className="vh-cell-muted">/ day</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      <section className="vh-panel">
        <div className="vh-panel-head">
          <div>
            <h2 className="vh-panel-title">Topic gaps</h2>
            <p className="vh-panel-desc">Topics where students need the most improvement</p>
          </div>
        </div>
        <div className="vh-panel-body">
          {topics.length ? (
            <div className="vp-topic-list">
              {topics.map((t) => {
                const pct = t.total ? Math.round((t.weak / t.total) * 100) : 0;
                return (
                  <div key={t.label} className="vp-topic-row">
                    <span className="vp-topic-label">{t.label}</span>
                    <div className="vp-topic-bar-wrap">
                      <div className="vp-topic-bar" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="vp-topic-pct">{pct}% weak</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <VendorPracticeEmpty
              title="No topic data yet"
              description="Topic weakness insights appear once students start practicing across different DSA topics."
            />
          )}
        </div>
      </section>
    </VendorPracticeLayout>
  );
};

export default VendorPracticeAnalytics;
