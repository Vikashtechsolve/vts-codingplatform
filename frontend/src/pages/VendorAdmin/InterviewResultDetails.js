import React, { useEffect, useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import axiosInstance from '../../utils/axios';
import VendorAssessPage from '../../components/VendorAdmin/VendorAssessPage';
import { formatDateTime, scoreTone } from '../../utils/vendorAssessmentUi';
import { getInterviewAnswerScoreDisplay } from '../../utils/interviewScoring';
import './InterviewResultDetails.css';

const SKILL_LABELS = [
  { key: 'correctness', label: 'Correctness' },
  { key: 'depth', label: 'Technical Depth' },
  { key: 'structure', label: 'Communication' },
  { key: 'confidence', label: 'Confidence' },
  { key: 'relevance', label: 'Real-world Relevance' },
];

const InterviewResultDetails = () => {
  const { sessionId } = useParams();
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const response = await axiosInstance.get(`/interview-sessions/${sessionId}`);
        setSession(response.data);
      } catch (error) {
        console.error('Error fetching interview session:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchSession();
  }, [sessionId]);

  const skillScores = useMemo(() => {
    if (!session?.answers?.length) return [];
    const sums = { correctness: 0, depth: 0, structure: 0, confidence: 0, relevance: 0 };
    session.answers.forEach((a) => {
      const e = a.evaluation;
      if (e) {
        SKILL_LABELS.forEach(({ key }) => {
          if (typeof e[key] === 'number') sums[key] += e[key];
        });
      }
    });
    const n = session.answers.length;
    return SKILL_LABELS.map(({ key, label }) => ({
      label,
      value: n ? Math.round((sums[key] || 0) / n) : 0,
    }));
  }, [session]);

  const allResources = useMemo(() => {
    if (!session?.answers?.length) return [];
    const set = new Set();
    session.answers.forEach((a) => {
      (a.evaluation?.resources || []).forEach((r) => set.add(r));
    });
    return [...set];
  }, [session]);

  const backUrl = session?.interviewId?._id
    ? `/vendor-admin/interviews/${session.interviewId._id}/results`
    : '/vendor-admin/tests?type=interview';

  if (loading) {
    return (
      <VendorAssessPage
        loading
        backTo={backUrl}
        backLabel="Back to results"
        accent="#7c3aed"
      />
    );
  }

  if (!session) {
    return (
      <VendorAssessPage
        backTo="/vendor-admin/tests?type=interview"
        backLabel="Back to interviews"
        title="Session not found"
        accent="#7c3aed"
      />
    );
  }

  const overallScore = session.overallScore ?? 0;
  const readinessPercent = session.readinessPercent ?? overallScore;
  const isPass = overallScore >= 60;

  return (
    <VendorAssessPage
      className="interview-result-details"
      backTo={backUrl}
      backLabel="Back to results"
      eyebrow="Interview submission"
      title={session.interviewId?.title || 'Interview result'}
      subtitle={`${session.studentId?.name} (${session.studentId?.email}) · ${session.interviewType} · ${session.topic} · ${session.difficulty} · ${formatDateTime(session.submittedAt)}`}
      accent="#7c3aed"
    >
      <div className="va-stats" style={{ marginBottom: 20 }}>
        <div className="va-stat va-stat--accent">
          <span className="va-stat-label">Overall score</span>
          <span className="va-stat-value">{overallScore}/100</span>
        </div>
        <div className="va-stat">
          <span className="va-stat-label">Readiness</span>
          <span className="va-stat-value">{readinessPercent}%</span>
        </div>
        <div className="va-stat">
          <span className="va-stat-label">Verdict</span>
          <span
            className="va-stat-value"
            style={{ color: isPass ? 'var(--va-pass, #16a34a)' : 'var(--va-warn, #ca8a04)' }}
          >
            {isPass ? 'Pass' : 'Needs improvement'}
          </span>
        </div>
        <div className="va-stat">
          <span className="va-stat-label">Questions</span>
          <span className="va-stat-value">{session.answers?.length || 0}</span>
        </div>
      </div>

      {skillScores.some((s) => s.value > 0) && (
        <div className="va-panel ird-skills-panel">
          <h2 className="va-panel-title">Skill breakdown</h2>
          <div className="ird-skill-grid">
            {skillScores.map((skill, idx) => (
              <div key={idx} className="ird-skill-row">
                <span className="ird-skill-label">{skill.label}</span>
                <div className="ird-skill-bar-wrap">
                  <div
                    className="ird-skill-bar"
                    style={{ width: `${Math.min(100, skill.value)}%` }}
                  />
                </div>
                <span className="ird-skill-val">{skill.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="ird-panels">
        <div className="va-panel">
          <h2 className="va-panel-title">Strengths</h2>
          <ul className="ird-list">
            {(session.finalFeedback?.strengths || []).length > 0
              ? session.finalFeedback.strengths.map((item, idx) => <li key={idx}>{item}</li>)
              : <li className="ird-muted">See question-by-question feedback below.</li>}
          </ul>
        </div>
        <div className="va-panel">
          <h2 className="va-panel-title">Where to improve</h2>
          <ul className="ird-list">
            {(session.finalFeedback?.improvements || []).length > 0
              ? session.finalFeedback.improvements.map((item, idx) => <li key={idx}>{item}</li>)
              : <li className="ird-muted">See question-by-question feedback below.</li>}
          </ul>
        </div>
      </div>

      {session.finalFeedback?.summary && (
        <div className="va-panel ird-summary-panel">
          <h2 className="va-panel-title">Summary</h2>
          <p className="ird-summary-text">{session.finalFeedback.summary}</p>
        </div>
      )}

      {allResources.length > 0 && (
        <div className="va-panel ird-resources-panel">
          <h2 className="va-panel-title">Learning resources</h2>
          <ul className="ird-list">
            {allResources.map((r, idx) => (
              <li key={idx}>{r}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="va-panel ird-answers-panel">
        <h2 className="va-panel-title">Question by question</h2>
        <div className="ird-answers">
          {(session.answers || []).map((answer, idx) => {
            const { points, maxPoints, percent } = getInterviewAnswerScoreDisplay(answer);
            const tonePct = percent ?? Math.round((points / maxPoints) * 100);
            return (
            <article key={idx} className="ird-answer-card">
              <div className="ird-answer-head">
                <h3>Q{idx + 1}</h3>
                <span className={`va-score va-score--${scoreTone(tonePct)}`}>
                  {points}/{maxPoints}
                </span>
              </div>
              <p className="ird-q-text">{answer.questionText}</p>
              <p className="ird-transcript">
                <strong>Student answer:</strong>{' '}
                {answer.transcript || '(no transcript)'}
              </p>
              <div className="ird-meta">
                <span>Confidence {answer.evaluation?.confidence ?? 0}</span>
                <span>Depth {answer.evaluation?.depth ?? 0}</span>
              </div>
              {answer.evaluation?.feedback && (
                <p className="ird-feedback">{answer.evaluation.feedback}</p>
              )}
            </article>
          );
          })}
        </div>
      </div>
    </VendorAssessPage>
  );
};

export default InterviewResultDetails;
