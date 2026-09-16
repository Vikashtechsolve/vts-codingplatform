import React, { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { FiCheckCircle, FiTarget, FiTrendingUp, FiClock } from 'react-icons/fi';
import axiosInstance from '../../../utils/axios';
import PracticePageLayout, { PracticeSection } from '../../../components/Practice/PracticePageLayout';
import { PracticeStatCard, PracticeStatsGrid } from '../../../components/Practice/PracticeCards';
import { capitalize } from '../../../components/Practice/practiceUtils';
import '../../../styles/practice-pages.css';

const PracticeAnalytics = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = () => {
    setLoading(true);
    axiosInstance.get('/practice/analytics')
      .then((res) => setData(res.data))
      .catch((err) => setError(err.response?.data?.message || 'Failed to load analytics'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const { profile, topicStats, difficulty } = data || {};
  const weekly = (profile?.weeklyProgress || []).map((d) => ({
    name: d.date?.slice(5) || '',
    solved: d.solved,
    attempted: d.attempted,
  }));
  const hours = Math.round((profile?.totalCodingTimeMs || 0) / 3600000);
  const avgMin = profile?.avgSolveTimeMs ? Math.round(profile.avgSolveTimeMs / 60000) : 0;

  return (
    <PracticePageLayout
      active="analytics"
      title="Practice Analytics"
      subtitle="Deep dive into your coding performance and topic progress."
      compactHero
      loading={loading}
      error={error}
      onRetry={load}
    >
      <PracticeStatsGrid>
        <PracticeStatCard value={profile?.problemsSolved || 0} label="Problems solved" variant="accent" icon={FiCheckCircle} />
        <PracticeStatCard value={profile?.problemsAttempted || 0} label="Attempted" icon={FiTarget} />
        <PracticeStatCard value={`${profile?.successRate || 0}%`} label="Success rate" icon={FiTrendingUp} />
        <PracticeStatCard value={`${hours}h`} label="Total coding time" icon={FiClock} />
        <PracticeStatCard value={`${avgMin}m`} label="Avg solve time" icon={FiClock} />
      </PracticeStatsGrid>

      <PracticeSection title="By difficulty">
        <div style={{ maxWidth: 520 }}>
          <PracticeStatsGrid>
          <PracticeStatCard value={difficulty?.easy || 0} label="Easy solved" />
          <PracticeStatCard value={difficulty?.medium || 0} label="Medium solved" />
          <PracticeStatCard value={difficulty?.hard || 0} label="Hard solved" />
          </PracticeStatsGrid>
        </div>
      </PracticeSection>

      {weekly.length > 0 && (
        <PracticeSection title="Weekly progress">
          <div className="practice-chart-card">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weekly}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="solved" fill="#7c3aed" name="Solved" radius={[4, 4, 0, 0]} />
                <Bar dataKey="attempted" fill="#c4b5fd" name="Attempted" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </PracticeSection>
      )}

      <PracticeSection title="By topic">
        <div className="practice-problem-grid">
          {(topicStats || []).map((t) => (
            <article key={t.topicId} className="practice-stat-card">
              <div className="practice-stat-body">
                <strong style={{ fontSize: '0.95rem' }}>{t.label}</strong>
                <p style={{ margin: '6px 0 0', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                  {t.solved} solved · {t.attempted} attempted
                </p>
                <div style={{ marginTop: 8 }}>
                  <span className={`practice-diff practice-diff-${t.strength === 'mastered' ? 'easy' : t.strength === 'weak' ? 'hard' : 'medium'}`}>
                    {t.masteryScore}% · {capitalize(t.strength)}
                  </span>
                </div>
              </div>
            </article>
          ))}
        </div>
      </PracticeSection>
    </PracticePageLayout>
  );
};

export default PracticeAnalytics;
