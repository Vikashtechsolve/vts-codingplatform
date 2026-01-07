import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axiosInstance from '../../utils/axios';
import './TestResult.css';

const TestResult = () => {
  const { resultId, testId } = useParams();
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchResult();
  }, [resultId, testId]);

  const fetchResult = async () => {
    try {
      setLoading(true);
      setError(null);
      
      let response;
      if (testId) {
        // Route: /student/result/test/:testId
        console.log('📥 Fetching result by test ID:', testId);
        response = await axiosInstance.get(`/results/test/${testId}`);
      } else if (resultId) {
        // Route: /student/result/:resultId
        console.log('📥 Fetching result by result ID:', resultId);
        response = await axiosInstance.get(`/results/${resultId}`);
      } else {
        throw new Error('No result ID or test ID provided');
      }
      
      console.log('✅ Result fetched:', response.data);
      setResult(response.data);
    } catch (error) {
      console.error('❌ Error fetching result:', error);
      const errorMsg = error.response?.data?.message || error.message || 'Failed to load result';
      setError(errorMsg);
      console.error('Error details:', errorMsg);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  if (!result) {
    return (
      <div className="container test-result-page">
        <div className="error-message-modern">
          <h3>Result Not Found</h3>
          <p>{error || 'The result you\'re looking for doesn\'t exist or you don\'t have permission to view it.'}</p>
          {(resultId || testId) && (
            <p style={{ fontSize: '0.9em', marginTop: '10px' }}>
              {resultId ? `Result ID: ${resultId}` : `Test ID: ${testId}`}
            </p>
          )}
          <Link to="/student/dashboard" className="back-btn-modern">
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container test-result-page">
      <h1 className="page-title">{result.testId?.title || 'Test Result'}</h1>

      <div className="result-summary-modern">
        <div className="stat-card-modern score">
          <h3>Score</h3>
          <p className="stat-number-modern">{result.totalScore} / {result.maxScore}</p>
        </div>
        <div className="stat-card-modern percentage">
          <h3>Percentage</h3>
          <p className="stat-number-modern">{result.percentage}%</p>
        </div>
        <div className="stat-card-modern time">
          <h3>Time Spent</h3>
          <p className="stat-number-modern">{Math.floor(result.timeSpent / 60)}m {result.timeSpent % 60}s</p>
        </div>
      </div>

      <div className="questions-results-section">
        <h2 className="section-title-modern">Question-wise Results</h2>
        {result.answers?.map((answer, index) => {
          const isCorrect = answer.questionType === 'mcq' ? answer.isCorrect : 
                           (answer.testCasesPassed === answer.totalTestCases);
          return (
            <div key={index} className={`question-result-card ${isCorrect ? 'correct' : 'incorrect'}`}>
              <div className="question-result-header">
                <h4>Question {index + 1}</h4>
                <span className={`question-type-badge-result ${answer.questionType}`}>
                  {answer.questionType.toUpperCase()}
                </span>
              </div>
              
              <div className="points-display">
                <div className={`points-item ${isCorrect ? 'correct' : 'incorrect'}`}>
                  <strong>Points:</strong> {answer.points} / {answer.maxPoints}
                </div>
                {answer.questionType === 'coding' && (
                  <div className="points-item">
                    <strong>Test Cases:</strong> {answer.testCasesPassed} / {answer.totalTestCases} passed
                  </div>
                )}
                {answer.questionType === 'mcq' && (
                  <div className={`status-indicator ${answer.isCorrect ? 'correct' : 'incorrect'}`}>
                    {answer.isCorrect ? '✓ Correct' : '✗ Incorrect'}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      
      <div style={{ marginTop: '40px', textAlign: 'center' }}>
        <Link to="/student/dashboard" className="back-btn-modern">
          ← Back to Dashboard
        </Link>
      </div>
    </div>
  );
};

export default TestResult;
