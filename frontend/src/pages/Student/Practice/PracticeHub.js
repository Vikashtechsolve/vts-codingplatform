import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FiTarget,
  FiTrendingUp,
  FiZap,
  FiCheckCircle,
  FiAward,
} from 'react-icons/fi';
import axiosInstance from '../../../utils/axios';
import PracticePageLayout, { PracticeSection } from '../../../components/Practice/PracticePageLayout';
import {
  PracticeStatCard,
  PracticeStatsGrid,
  PracticeProblemCard,
  PracticeSubmissionRow,
} from '../../../components/Practice/PracticeCards';
import PracticeEmptyState from '../../../components/Practice/PracticeEmptyState';
import PracticeProgressRing from '../../../components/Practice/PracticeProgressRing';
import { capitalize } from '../../../components/Practice/practiceUtils';
import '../../../styles/practice-pages.css';

const PracticeHub = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = () => {
    setLoading(true);
    setError(null);
    axiosInstance
      .get('/practice/dashboard')
      .then((res) => setData(res.data))
      .catch((err) => setError(err.response?.data?.message || 'Failed to load practice'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const profile = data?.profile;
  const goalTarget = profile?.dailyGoal?.target || 2;
  const goalDone = profile?.dailyGoal?.completedToday || 0;

  return (
    <PracticePageLayout
      active="hub"
      title="Coding Practice"
      subtitle={`Sharpen your DSA skills with ${data?.totalPracticeQuestions || 0} problems. Track mastery, streaks, and climb the leaderboard.`}
      score={profile?.codingScore ?? 0}
      scoreLabel="Coding score"
      loading={loading}
      loadingMessage="Loading practice hub…"
      error={error}
      onRetry={load}
    >
      <PracticeStatsGrid>
        <PracticeStatCard value={profile?.problemsSolved || 0} label="Solved" variant="accent" icon={FiCheckCircle} />
        <PracticeStatCard value={profile?.problemsAttempted || 0} label="Attempted" icon={FiTarget} />
        <PracticeStatCard value={`${profile?.successRate || 0}%`} label="Success rate" icon={FiTrendingUp} />
        <PracticeStatCard value={profile?.streak?.current || 0} label="Day streak" variant="streak" icon={FiZap} />
      </PracticeStatsGrid>

      <div className="practice-bento-row">
        <div className="practice-goal-card">
          <PracticeProgressRing
            value={goalDone}
            max={goalTarget}
            size={88}
            stroke={7}
            sublabel="Today"
          />
          <div className="practice-goal-card-body">
            <div className="practice-goal-head">
              <strong>Daily goal</strong>
              <span>{goalDone} / {goalTarget} solved</span>
            </div>
            <div className="practice-goal-bar">
              <div
                className="practice-goal-fill"
                style={{ width: `${goalTarget ? Math.min(100, Math.round((goalDone / goalTarget) * 100)) : 0}%` }}
              />
            </div>
            <p className="practice-meta-muted" style={{ margin: '10px 0 0' }}>
              Keep your streak alive — solve {Math.max(0, goalTarget - goalDone)} more today.
            </p>
          </div>
        </div>

        {data?.dailyChallenge ? (
          <div className="practice-daily-card">
            <p className="practice-daily-card-label"><FiZap /> Daily challenge</p>
            <div className="practice-daily-card-body">
              <Link to={`/student/practice/solve/${data.dailyChallenge._id}`}>
                {data.dailyChallenge.title}
              </Link>
              <span className={`practice-diff practice-diff-${data.dailyChallenge.difficulty}`}>
                {capitalize(data.dailyChallenge.difficulty)}
              </span>
            </div>
          </div>
        ) : (
          <div className="practice-daily-card">
            <p className="practice-daily-card-label"><FiZap /> Daily challenge</p>
            <p className="practice-meta-muted" style={{ margin: 0 }}>
              No challenge today — pick any problem from the bank.
            </p>
            <Link to="/student/practice/problems" className="practice-btn practice-btn-primary" style={{ marginTop: 14 }}>
              Browse problems
            </Link>
          </div>
        )}
      </div>

      {(profile?.difficulty || data?.percentile) && (
        <PracticeStatsGrid columns={4}>
          <PracticeStatCard value={profile?.difficulty?.easy || 0} label="Easy solved" />
          <PracticeStatCard value={profile?.difficulty?.medium || 0} label="Medium solved" />
          <PracticeStatCard value={profile?.difficulty?.hard || 0} label="Hard solved" />
          {data?.percentile && (
            <PracticeStatCard
              value={`#${data.percentile.rank}`}
              label={`Top ${data.percentile.percentile}% in batch`}
              icon={FiAward}
            />
          )}
        </PracticeStatsGrid>
      )}

      <PracticeSection title="Recommended for you" linkLabel="View all" linkTo="/student/practice/problems">
        {(data?.recommendations || []).length ? (
          <div className="practice-problem-grid">
            {data.recommendations.slice(0, 6).map((q) => (
              <PracticeProblemCard key={q._id} question={q} />
            ))}
          </div>
        ) : (
          <PracticeEmptyState
            title="No recommendations yet"
            description="Solve a few problems and we'll suggest what to try next based on your skill gaps."
            actionLabel="Browse problems"
            actionTo="/student/practice/problems"
          />
        )}
      </PracticeSection>

      <PracticeSection title="Recent submissions" linkLabel="Full history" linkTo="/student/practice/submissions">
        {(profile?.recentSubmissions || []).length ? (
          <div className="practice-submission-list">
            {profile.recentSubmissions.slice(0, 5).map((s) => (
              <PracticeSubmissionRow
                key={s.submissionId}
                submission={{
                  ...s,
                  status: s.status === 'accepted' ? 'accepted' : s.status,
                  title: s.title,
                }}
                to={`/student/practice/solve/${s.questionId}`}
              />
            ))}
          </div>
        ) : (
          <PracticeEmptyState
            title="No submissions yet"
            description="Your practice attempts will appear here once you start solving."
            actionLabel="Start solving"
            actionTo="/student/practice/problems"
          />
        )}
      </PracticeSection>
    </PracticePageLayout>
  );
};

export default PracticeHub;
