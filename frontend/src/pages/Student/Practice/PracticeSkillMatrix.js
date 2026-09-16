import React, { useEffect, useState } from 'react';
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer,
} from 'recharts';
import axiosInstance from '../../../utils/axios';
import PracticePageLayout, { PracticeSection } from '../../../components/Practice/PracticePageLayout';
import PracticeEmptyState from '../../../components/Practice/PracticeEmptyState';
import '../../../styles/practice-pages.css';

const PracticeSkillMatrix = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = () => {
    setLoading(true);
    axiosInstance.get('/practice/skill-matrix')
      .then((res) => setData(res.data))
      .catch((err) => setError(err.response?.data?.message || 'Failed to load skill matrix'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const matrix = data?.matrix || [];
  const radarData = matrix
    .filter((t) => t.attempted > 0)
    .map((t) => ({ topic: t.label.length > 12 ? `${t.label.slice(0, 11)}…` : t.label, score: t.masteryScore }));

  return (
    <PracticePageLayout
      active="skill-matrix"
      title="Skill Matrix"
      subtitle="See where you excel and which topics need more practice."
      compactHero
      loading={loading}
      error={error}
      onRetry={load}
    >
      {radarData.length > 0 ? (
        <PracticeSection title="Topic radar">
          <div className="practice-chart-card" style={{ height: 340 }}>
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData}>
                <PolarGrid stroke="var(--border-color)" />
                <PolarAngleAxis dataKey="topic" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10 }} />
                <Radar name="Mastery" dataKey="score" stroke="#7c3aed" fill="#7c3aed" fillOpacity={0.35} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </PracticeSection>
      ) : (
        <PracticeEmptyState
          title="No topic data yet"
          description="Solve problems across different topics to build your skill matrix."
          actionLabel="Browse problems"
          actionTo="/student/practice/problems"
        />
      )}

      <PracticeSection title="All topics">
        <div className="practice-matrix-grid">
          {matrix.map((t) => (
            <div key={t.topicId} className={`practice-matrix-cell ${t.strength}`}>
              <div className="practice-matrix-label">{t.label}</div>
              <div className="practice-matrix-score">{t.masteryScore}%</div>
              <div className="practice-matrix-meta">{t.solved} solved · {t.attempted} tried</div>
            </div>
          ))}
        </div>
      </PracticeSection>
    </PracticePageLayout>
  );
};

export default PracticeSkillMatrix;
