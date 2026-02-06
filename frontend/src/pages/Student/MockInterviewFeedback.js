import React, { useEffect, useState, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import axiosInstance from '../../utils/axios';
import './MockInterviewFeedback.css';

const SKILL_LABELS = [
  { key: 'correctness', label: 'Correctness' },
  { key: 'depth', label: 'Technical Depth' },
  { key: 'structure', label: 'Communication' },
  { key: 'confidence', label: 'Confidence' },
  { key: 'relevance', label: 'Real-world Relevance' }
];

const MockInterviewFeedback = () => {
  const { sessionId } = useParams();
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const response = await axiosInstance.get(`/interview-sessions/${sessionId}`);
        setSession(response.data);
      } catch (error) {
        console.error('❌ Error fetching session:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchSession();
  }, [sessionId]);

  const skillScores = useMemo(() => {
    if (!session?.answers?.length) return [];
    const sums = { correctness: 0, depth: 0, structure: 0, confidence: 0, relevance: 0 };
    session.answers.forEach(a => {
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
      value: n ? Math.round((sums[key] || 0) / n) : 0
    }));
  }, [session]);

  const allResources = useMemo(() => {
    if (!session?.answers?.length) return [];
    const set = new Set();
    session.answers.forEach(a => {
      (a.evaluation?.resources || []).forEach(r => set.add(r));
    });
    return [...set];
  }, [session]);

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  if (!session) {
    return (
      <div className="container student-dashboard">
        <div className="empty-state">
          <div className="empty-state-icon">📉</div>
          <h2>Feedback not available</h2>
          <Link to="/student/tests/interview" className="btn btn-secondary">
            Back to Interviews
          </Link>
        </div>
      </div>
    );
  }

  const overallScore = session.overallScore ?? 0;
  const readinessPercent = session.readinessPercent ?? overallScore;
  const isPass = overallScore >= 60;

  return (
    <div className="container interview-feedback">
      <div className="feedback-header">
        <div>
          <h1>{session.interviewId?.title || 'Interview Result Analysis'}</h1>
          <p>{session.interviewType} · {session.topic} · {session.difficulty}</p>
          <p className="feedback-subtitle">Your score, readiness, and detailed feedback</p>
        </div>
        <Link to="/student/tests/interview" className="btn btn-secondary">
          Back to Interviews
        </Link>
      </div>

      <div className="feedback-summary">
        <div className="summary-card">
          <h3>Overall Score</h3>
          <div className="summary-value">{overallScore}/100</div>
        </div>
        <div className="summary-card">
          <h3>Interview Readiness</h3>
          <div className="summary-value">{readinessPercent}%</div>
        </div>
        <div className={`summary-card verdict-card ${isPass ? 'pass' : 'needs-improvement'}`}>
          <h3>Verdict</h3>
          <div className="summary-value verdict-value">
            {isPass ? '✓ Pass' : 'Needs Improvement'}
          </div>
        </div>
        <div className="summary-card">
          <h3>Questions Answered</h3>
          <div className="summary-value">{session.answers?.length || 0}</div>
        </div>
      </div>

      {skillScores.length > 0 && (
        <div className="feedback-skill-radar">
          <h2>Skill breakdown</h2>
          <div className="skill-radar-grid">
            {skillScores.map((skill, idx) => (
              <div key={idx} className="skill-radar-item">
                <div className="skill-radar-label">{skill.label}</div>
                <div className="skill-radar-bar-wrap">
                  <div
                    className="skill-radar-bar"
                    style={{ width: `${Math.min(100, skill.value)}%` }}
                  />
                </div>
                <span className="skill-radar-value">{skill.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="feedback-panels">
        <div className="feedback-panel">
          <h2>✅ What you did well</h2>
          <ul>
            {(session.finalFeedback?.strengths || []).length > 0
              ? (session.finalFeedback.strengths).map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))
              : <li>Review your question-by-question feedback for strengths.</li>}
          </ul>
        </div>
        <div className="feedback-panel">
          <h2>🛠 Where to improve</h2>
          <ul>
            {(session.finalFeedback?.improvements || []).length > 0
              ? (session.finalFeedback.improvements).map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))
              : <li>Review your question-by-question feedback for improvement areas.</li>}
          </ul>
        </div>
      </div>

      {session.finalFeedback?.summary && (
        <div className="feedback-panel feedback-summary-text">
          <h2>Summary</h2>
          <p>{session.finalFeedback.summary}</p>
        </div>
      )}

      {allResources.length > 0 && (
        <div className="feedback-panel feedback-resources">
          <h2>📚 Learning resources</h2>
          <ul>
            {allResources.map((r, idx) => (
              <li key={idx}>{r}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="feedback-answers">
        <h2>Question by question</h2>
        {(session.answers || []).map((answer, idx) => (
          <div key={idx} className="answer-card">
            <h3>Q{idx + 1}: {answer.questionText}</h3>
            <p><strong>Your answer:</strong> {answer.transcript || '(no transcript)'}</p>
            <div className="answer-score">
              <span>Score: {answer.evaluation?.overall ?? 0}/100</span>
              <span>Confidence: {answer.evaluation?.confidence ?? 0}</span>
              <span>Depth: {answer.evaluation?.depth ?? 0}</span>
            </div>
            {answer.evaluation?.feedback && <p className="answer-feedback">{answer.evaluation.feedback}</p>}
          </div>
        ))}
      </div>
    </div>
  );
};

export default MockInterviewFeedback;
