import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import axiosInstance from '../../utils/axios';
import './SystemDesignResult.css';

const SECTION_LABELS = {
  requirements: 'Requirements', capacityEstimation: 'Capacity Estimation', coreEntities: 'Core Entities',
  apiDesign: 'API Design', architecture: 'Architecture', dataFlow: 'Data Flow',
  databaseDesign: 'Database Design', scalingStrategy: 'Scaling Strategy', deepDive: 'Deep Dive', tradeoffs: 'Tradeoffs'
};

const SECTION_ICONS = {
  requirements: '📝', capacityEstimation: '🧮', coreEntities: '🗂️', apiDesign: '🔌',
  architecture: '🏗️', dataFlow: '🔄', databaseDesign: '💾', scalingStrategy: '📈', deepDive: '🔬', tradeoffs: '⚖️'
};

const SystemDesignResult = () => {
  const { submissionId } = useParams();
  const navigate = useNavigate();
  const [submission, setSubmission] = useState(null);
  const [referenceAnswer, setReferenceAnswer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedSections, setExpandedSections] = useState({});
  const [showComparison, setShowComparison] = useState({});

  const fetchResult = useCallback(async () => {
    try {
      const { data } = await axiosInstance.get(`/system-design-submissions/${submissionId}`);
      if (data.success) {
        setSubmission(data.submission);
        setReferenceAnswer(data.referenceAnswer);
      }
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  }, [submissionId]);

  useEffect(() => { fetchResult(); }, [fetchResult]);

  const toggleSection = (key) => setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  const toggleComparison = (key) => setShowComparison(prev => ({ ...prev, [key]: !prev[key] }));

  const getScoreColor = (score) => score >= 7 ? '#27ae60' : score >= 4 ? '#f39c12' : '#e74c3c';
  const getGrade = (pct) => pct >= 90 ? 'A' : pct >= 80 ? 'B' : pct >= 70 ? 'C' : pct >= 60 ? 'D' : 'F';
  const getGradeColor = (pct) => pct >= 70 ? '#27ae60' : pct >= 50 ? '#f39c12' : '#e74c3c';

  if (loading) return <div className="sdr-container"><div className="sdr-loading">Loading results...</div></div>;
  if (!submission) return <div className="sdr-container"><div className="sdr-loading">Result not found</div></div>;

  const evaluation = submission.evaluation || {};
  const percentage = submission.percentage || 0;
  const sectionKeys = Object.keys(SECTION_LABELS);

  // Radar chart data
  const radarData = evaluation.skillRadar ? Object.entries({
    'Requirements': evaluation.skillRadar.requirements,
    'Estimation': evaluation.skillRadar.estimation,
    'Modeling': evaluation.skillRadar.modeling,
    'API Design': evaluation.skillRadar.apiDesign,
    'Architecture': evaluation.skillRadar.architecture,
    'Databases': evaluation.skillRadar.databases,
    'Scaling': evaluation.skillRadar.scaling,
    'Tradeoffs': evaluation.skillRadar.tradeoffs
  }).map(([key, val]) => ({ subject: key, score: val || 0, fullMark: 10 })) : [];

  // Time per section for bar chart
  const timeData = submission.sectionTimeSpent ? Object.entries(submission.sectionTimeSpent)
    .filter(([key]) => SECTION_LABELS[key])
    .map(([key, val]) => ({ name: SECTION_LABELS[key].slice(0, 10), minutes: Math.round((val || 0) / 60) })) : [];

  return (
    <div className="sdr-container">
      <button className="sdr-back-btn" onClick={() => navigate(-1)}>← Back</button>

      {/* Overall Score Header */}
      <div className="sdr-score-header">
        <div className="sdr-score-circle" style={{ borderColor: getGradeColor(percentage) }}>
          <span className="sdr-score-pct">{Math.round(percentage)}%</span>
          <span className="sdr-score-grade" style={{ color: getGradeColor(percentage) }}>{getGrade(percentage)}</span>
        </div>
        <div className="sdr-score-info">
          <h1>{submission.problemId?.title || 'System Design Result'}</h1>
          <div className="sdr-score-meta">
            <span>Score: {submission.totalScore}/{submission.maxScore}</span>
            {evaluation.hintPenalty > 0 && <span className="sdr-penalty">Hint penalty: -{evaluation.hintPenalty}%</span>}
            {evaluation.followUpScore > 0 && <span>Follow-up: {evaluation.followUpScore}/10</span>}
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="sdr-charts-row">
        {radarData.length > 0 && (
          <div className="sdr-chart-card">
            <h3>Skill Radar</h3>
            <ResponsiveContainer width="100%" height={280}>
              <RadarChart data={radarData}>
                <PolarGrid />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11, fill: 'var(--text-secondary, #666)' }} />
                <PolarRadiusAxis angle={30} domain={[0, 10]} tick={{ fontSize: 10 }} />
                <Radar name="Score" dataKey="score" stroke="#6c5ce7" fill="#6c5ce7" fillOpacity={0.3} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        )}
        {timeData.length > 0 && timeData.some(d => d.minutes > 0) && (
          <div className="sdr-chart-card">
            <h3>Time Distribution</h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={timeData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--text-secondary, #666)' }} angle={-30} textAnchor="end" height={60} />
                <YAxis tick={{ fontSize: 11 }} label={{ value: 'min', position: 'insideLeft' }} />
                <Tooltip />
                <Bar dataKey="minutes" fill="#6c5ce7" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Overall Feedback */}
      {evaluation.overallFeedback && (
        <div className="sdr-overall-feedback">
          <h3>Overall Feedback</h3>
          <p>{evaluation.overallFeedback}</p>
        </div>
      )}

      {/* Per-Section Results */}
      <h2 className="sdr-section-title">Section-by-Section Results</h2>
      <div className="sdr-sections">
        {sectionKeys.map(key => {
          const sectionEval = evaluation[key] || {};
          const score = sectionEval.score || 0;
          const isExpanded = expandedSections[key];
          const isComparing = showComparison[key];

          return (
            <div key={key} className={`sdr-section-card ${isExpanded ? 'expanded' : ''}`}>
              <div className="sdr-section-header" onClick={() => toggleSection(key)}>
                <span className="sdr-section-icon">{SECTION_ICONS[key]}</span>
                <span className="sdr-section-name">{SECTION_LABELS[key]}</span>
                <div className="sdr-section-score-bar">
                  <div className="sdr-score-bar-fill" style={{ width: `${score * 10}%`, background: getScoreColor(score) }} />
                </div>
                <span className="sdr-section-score" style={{ color: getScoreColor(score) }}>{score}/10</span>
                <span className="sdr-expand-icon">{isExpanded ? '▼' : '▶'}</span>
              </div>

              {isExpanded && (
                <div className="sdr-section-body">
                  {sectionEval.feedback && <p className="sdr-feedback">{sectionEval.feedback}</p>}

                  <div className="sdr-chips-row">
                    {sectionEval.strengths?.length > 0 && (
                      <div className="sdr-chips">
                        <label>Strengths:</label>
                        {sectionEval.strengths.map((s, i) => <span key={i} className="sdr-chip green">{s}</span>)}
                      </div>
                    )}
                    {sectionEval.improvements?.length > 0 && (
                      <div className="sdr-chips">
                        <label>Improve:</label>
                        {sectionEval.improvements.map((s, i) => <span key={i} className="sdr-chip orange">{s}</span>)}
                      </div>
                    )}
                    {sectionEval.missingConcepts?.length > 0 && (
                      <div className="sdr-chips">
                        <label>Missing:</label>
                        {sectionEval.missingConcepts.map((s, i) => <span key={i} className="sdr-chip red">{s}</span>)}
                      </div>
                    )}
                  </div>

                  {referenceAnswer && referenceAnswer[key] && (
                    <button className="sdr-compare-btn" onClick={() => toggleComparison(key)}>
                      {isComparing ? 'Hide Comparison' : 'Compare with Reference'}
                    </button>
                  )}

                  {isComparing && referenceAnswer?.[key] && (
                    <div className="sdr-comparison">
                      <div className="sdr-compare-col">
                        <h4>Your Answer</h4>
                        <pre className="sdr-compare-content">{JSON.stringify(submission.sections?.[key], null, 2)}</pre>
                      </div>
                      <div className="sdr-compare-col reference">
                        <h4>Reference Answer</h4>
                        {typeof referenceAnswer[key] === 'string' && referenceAnswer[key].includes('<') ? (
                          <div className="sdr-compare-content sdr-rich-content" dangerouslySetInnerHTML={{ __html: referenceAnswer[key] }} />
                        ) : (
                          <pre className="sdr-compare-content">{typeof referenceAnswer[key] === 'string' ? referenceAnswer[key] : JSON.stringify(referenceAnswer[key], null, 2)}</pre>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Follow-up Q&A */}
      {submission.followUpQuestions?.length > 0 && (
        <div className="sdr-followup-section">
          <h2>Follow-up Questions</h2>
          {submission.followUpQuestions.map((q, idx) => (
            <div key={idx} className="sdr-followup-card">
              <div className="sdr-followup-q"><strong>Q{idx + 1}:</strong> {q.question}</div>
              {q.answer && <div className="sdr-followup-a"><strong>Your answer:</strong> {q.answer}</div>}
              <div className="sdr-followup-score">
                Score: <span style={{ color: getScoreColor(q.score) }}>{q.score}/10</span>
                {q.feedback && <span className="sdr-followup-feedback"> - {q.feedback}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SystemDesignResult;
