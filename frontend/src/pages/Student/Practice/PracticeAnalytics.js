import React, { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { FiCheckCircle, FiTarget, FiTrendingUp, FiClock } from 'react-icons/fi';
import axiosInstance from '../../../utils/axios';
import PracticePageLayout, { PracticeSection } from '../../../components/Practice/PracticePageLayout';
import { PracticeStatCard, PracticeStatsGrid } from '../../../components/Practice/PracticeCards';
import { capitalize } from '../../../components/Practice/practiceUtils';
import PracticeProgressBoard from '../../../components/Practice/PracticeProgressBoard';
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

  const { profile, topicStats } = data || {};
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

      {data?.progress && <PracticeProgressBoard progress={data.progress} />}

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
          {(topicStats || []).map((t) => {
            const tried = t.attempted || 0;
            const rate = tried ? Math.round((t.solved / tried) * 100) : 0;
            return (
              <article key={t.topicId} className={`practice-stat-card ps-topic-card is-${t.strength}`}>
                <div className="practice-stat-body">
                  <strong className="ps-topic-label">{t.label}</strong>
                  <p className="ps-topic-meta">
                    {t.solved} solved · {t.attempted} attempted
                  </p>
                  <div className="ps-progress-track" aria-hidden>
                    <div
                      className="ps-progress-fill"
                      style={{
                        width: `${t.masteryScore || 0}%`,
                        background: t.strength === 'weak' ? '#dc2626' : t.strength === 'mastered' ? '#16a34a' : '#6366f1',
                      }}
                    />
                  </div>
                  <span className={`practice-diff practice-diff-${t.strength === 'mastered' ? 'easy' : t.strength === 'weak' ? 'hard' : 'medium'}`}>
                    {t.masteryScore}% · {capitalize(t.strength)}
                    {tried ? ` · ${rate}% success` : ''}
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      </PracticeSection>
    </PracticePageLayout>
  );
};

export default PracticeAnalytics;
