import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axiosInstance from '../../utils/axios';
import './VendorAdminCommon.css';
import './ResultDetails.css';

const ResultDetails = () => {
  const { resultId } = useParams();
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [manualUpdates, setManualUpdates] = useState({});

  useEffect(() => {
    fetchResult();
  }, [resultId]);

  const fetchResult = async () => {
    try {
      const response = await axiosInstance.get(`/results/${resultId}`);
      setResult(response.data);
      const initialManual = {};
      (response.data?.answers || []).forEach(answer => {
        initialManual[answer._id] = {
          score: answer.manualOverride?.score ?? answer.points ?? 0,
          feedback: answer.manualOverride?.feedback || ''
        };
      });
      setManualUpdates(initialManual);
    } catch (error) {
      console.error('Error fetching result:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleManualChange = (answerId, field, value) => {
    setManualUpdates(prev => ({
      ...prev,
      [answerId]: {
        ...prev[answerId],
        [field]: value
      }
    }));
  };

  const handleManualSubmit = async (answerId) => {
    try {
      const payload = manualUpdates[answerId];
      await axiosInstance.patch(`/results/${resultId}/answers/${answerId}/manual-score`, {
        score: Number(payload?.score || 0),
        feedback: payload?.feedback || ''
      });
      await fetchResult();
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to update score');
    }
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  if (!result) {
    return <div className="error">Result not found</div>;
  }

  const isCorrect = (answer) => {
    if (answer.questionType === 'mcq' || answer.questionType === 'aptitude') return answer.isCorrect;
    if (answer.questionType === 'theory') {
      return (answer.points || 0) >= (answer.maxPoints || 1) * 0.6;
    }
    return answer.testCasesPassed === answer.totalTestCases;
  };

  return (
    <div className="container result-details-page">
      <div className="page-header">
        <Link to={`/vendor-admin/tests/${result.testId?._id}/results`} className="btn btn-secondary" style={{ marginBottom: '20px' }}>
          ← Back to Results
        </Link>
        <h1 className="page-title">Result Details</h1>
      </div>

      <div className="info-card-modern">
        <h2>Student Information</h2>
        <div className="info-item">
          <strong>Name:</strong>
          <span>{result.studentId?.name}</span>
        </div>
        <div className="info-item">
          <strong>Email:</strong>
          <span>{result.studentId?.email}</span>
        </div>
        <div className="info-item">
          <strong>Test:</strong>
          <span>{result.testId?.title}</span>
        </div>
        <div className="info-item">
          <strong>Started At:</strong>
          <span>{new Date(result.startedAt).toLocaleString()}</span>
        </div>
        <div className="info-item">
          <strong>Submitted At:</strong>
          <span>{result.submittedAt ? new Date(result.submittedAt).toLocaleString() : 'Not submitted'}</span>
        </div>
        <div className="info-item">
          <strong>Time Spent:</strong>
          <span>{Math.floor(result.timeSpent / 60)} minutes {result.timeSpent % 60} seconds</span>
        </div>
        {result.violationCount > 0 && (
          <>
            <div className="info-item">
              <strong>Violations:</strong>
              <span style={{ color: result.violationCount >= 3 ? '#ff4444' : '#ff9800', fontWeight: 'bold' }}>
                {result.violationCount}
              </span>
            </div>
            {result.autoSubmitted && (
              <div className="info-item">
                <strong>Status:</strong>
                <span style={{ color: '#ff4444', fontWeight: 'bold' }}>Auto-submitted due to violations</span>
              </div>
            )}
          </>
        )}
        {result.violations && result.violations.length > 0 && (
          <div className="info-item" style={{ gridColumn: '1 / -1', marginTop: '20px' }}>
            <strong>Violation Details:</strong>
            <div style={{ marginTop: '10px', padding: '15px', background: '#fff3cd', borderRadius: '8px', border: '1px solid #ffc107' }}>
              {result.violations.map((violation, idx) => (
                <div key={idx} style={{ padding: '8px', background: 'white', borderRadius: '5px', marginBottom: '8px', fontSize: '0.9em' }}>
                  <strong>{violation.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</strong>
                  {violation.details && <span style={{ color: '#666', marginLeft: '10px' }}>- {violation.details}</span>}
                  <span style={{ float: 'right', color: '#999' }}>
                    {new Date(violation.timestamp).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="info-card-modern">
        <h2>Score Summary</h2>
        <div className="score-summary-modern">
          <div className="stat-card-result">
            <h3>Total Score</h3>
            <p className="stat-number-result">{result.totalScore} / {result.maxScore}</p>
          </div>
          <div className="stat-card-result">
            <h3>Percentage</h3>
            <p className="stat-number-result">{result.percentage}%</p>
          </div>
          <div className="stat-card-result">
            <h3>Status</h3>
            <p className="stat-number-result" style={{ fontSize: '1.2em' }}>
              <span className={`status-badge ${result.status === 'completed' ? 'active' : 'inactive'}`}>
                {result.status}
              </span>
            </p>
          </div>
        </div>
      </div>

      <div className="info-card-modern">
        <h2>Question-wise Breakdown</h2>
        {result.answers?.map((answer, index) => {
          const correct = isCorrect(answer);
          return (
            <div key={index} className={`question-breakdown-card ${correct ? 'correct' : 'incorrect'}`}>
              <div className="question-breakdown-header">
                <h4>Question {index + 1}</h4>
                <span className={`question-type-badge-detail ${answer.questionType}`}>
                  {answer.questionType.toUpperCase()}
                </span>
              </div>
              
              <div className="breakdown-details">
                <div className={`detail-item ${correct ? 'correct' : 'incorrect'}`}>
                  <strong>Points:</strong> {answer.points} / {answer.maxPoints}
                </div>
                {answer.questionType === 'coding' && (
                  <>
                    <div className="detail-item">
                      <strong>Language:</strong> {answer.language || 'N/A'}
                    </div>
                    <div className="detail-item">
                      <strong>Test Cases:</strong> {answer.testCasesPassed || 0} / {answer.totalTestCases || 0} passed
                    </div>
                  </>
                )}
                {answer.questionType === 'mcq' && (
                  <div className="detail-item">
                    <strong>Selected:</strong> {answer.answer !== undefined ? `Option ${answer.answer + 1}` : 'Not answered'}
                  </div>
                )}
                {answer.questionType === 'aptitude' && (
                  <div className="detail-item">
                    <strong>Answer:</strong> {Array.isArray(answer.answer) ? answer.answer.map(val => val + 1).join(', ') : answer.answer ?? 'Not answered'}
                  </div>
                )}
                {answer.questionType === 'theory' && (
                  <div className="detail-item">
                    <strong>Answer:</strong> {answer.answer ? `${answer.answer.slice(0, 120)}...` : 'Not answered'}
                  </div>
                )}
              </div>

              {answer.questionType === 'theory' && (
                <div style={{ marginTop: '12px', padding: '12px', background: '#f5f5f5', borderRadius: '8px' }}>
                  <strong>AI Evaluation:</strong>
                  <div style={{ marginTop: '8px', display: 'grid', gap: '6px' }}>
                    <div>Similarity: {(answer.evaluation?.similarityScore || 0).toFixed(2)}</div>
                    <div>Concept Coverage: {(answer.evaluation?.conceptScore || 0).toFixed(2)}</div>
                    <div>Depth & Clarity: {(answer.evaluation?.depthScore || 0).toFixed(2)}</div>
                    {answer.evaluation?.penalty > 0 && (
                      <div>Penalty: -{answer.evaluation.penalty.toFixed(2)}</div>
                    )}
                  </div>
                  {answer.evaluation?.feedback && (
                    <div style={{ marginTop: '8px' }}>
                      <strong>Feedback:</strong>
                      <p style={{ marginTop: '4px' }}>{answer.evaluation.feedback}</p>
                    </div>
                  )}
                  {answer.evaluation?.missingConcepts?.length > 0 && (
                    <div style={{ marginTop: '6px' }}>
                      <strong>Missing Concepts:</strong> {answer.evaluation.missingConcepts.join(', ')}
                    </div>
                  )}
                </div>
              )}

              {answer.questionType === 'theory' && (
                <div style={{ marginTop: '12px', padding: '12px', background: '#fff8e1', borderRadius: '8px', border: '1px solid #ffecb3' }}>
                  <strong>Manual Override</strong>
                  <div style={{ display: 'flex', gap: '10px', marginTop: '8px', flexWrap: 'wrap' }}>
                    <input
                      type="number"
                      min="0"
                      max={answer.maxPoints || 10}
                      value={manualUpdates[answer._id]?.score ?? ''}
                      onChange={(e) => handleManualChange(answer._id, 'score', e.target.value)}
                      style={{ width: '120px' }}
                    />
                    <input
                      type="text"
                      placeholder="Feedback (optional)"
                      value={manualUpdates[answer._id]?.feedback ?? ''}
                      onChange={(e) => handleManualChange(answer._id, 'feedback', e.target.value)}
                      style={{ flex: 1, minWidth: '200px' }}
                    />
                    <button
                      type="button"
                      className="btn btn-sm btn-secondary"
                      onClick={() => handleManualSubmit(answer._id)}
                    >
                      Update Score
                    </button>
                  </div>
                  {answer.manualOverride?.isManual && (
                    <p style={{ marginTop: '6px', fontSize: '0.85em' }}>
                      Manual override applied on {new Date(answer.manualOverride.updatedAt).toLocaleString()}
                    </p>
                  )}
                </div>
              )}
              
              {answer.questionType === 'coding' && answer.answer && (
                <div className="code-block">
                  <strong>Code:</strong>
                  <pre>{answer.answer}</pre>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ResultDetails;

