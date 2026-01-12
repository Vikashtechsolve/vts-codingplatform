import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import axiosInstance from '../../utils/axios';
import './TestResult.css';

const TestResult = () => {
  const { resultId, testId } = useParams();
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [questionsData, setQuestionsData] = useState({}); // Store question details

  useEffect(() => {
    fetchResult();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      
      // Fetch question details for MCQ questions to show correct answers
      if (response.data.answers) {
        await fetchQuestionDetails(response.data.answers);
      }
    } catch (error) {
      console.error('❌ Error fetching result:', error);
      const errorMsg = error.response?.data?.message || error.message || 'Failed to load result';
      setError(errorMsg);
      console.error('Error details:', errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const fetchQuestionDetails = async (answers) => {
    try {
      const mcqQuestionIds = answers
        .filter(a => a.questionType === 'mcq' && a.questionId)
        .map(a => a.questionId);
      
      if (mcqQuestionIds.length === 0) return;
      
      // Fetch MCQ questions in parallel
      const questionPromises = mcqQuestionIds.map(id => 
        axiosInstance.get(`/questions/mcq/${id}`).catch(() => null)
      );
      
      const questionResponses = await Promise.all(questionPromises);
      const questionsMap = {};
      
      questionResponses.forEach((response, index) => {
        if (response && response.data) {
          questionsMap[mcqQuestionIds[index]] = response.data;
        }
      });
      
      setQuestionsData(questionsMap);
    } catch (error) {
      console.error('Error fetching question details:', error);
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
          const questionData = questionsData[answer.questionId];
          
          return (
            <div key={index} className={`question-result-card ${isCorrect ? 'correct' : 'incorrect'}`} style={{ marginBottom: '30px' }}>
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
                  <>
                    <div className="points-item">
                      <strong>Test Cases:</strong> {answer.testCasesPassed || 0} / {answer.totalTestCases || 0} passed
                    </div>
                    {answer.language && (
                      <div className="points-item">
                        <strong>Language:</strong> {answer.language.toUpperCase()}
                      </div>
                    )}
                  </>
                )}
                {answer.questionType === 'mcq' && (
                  <div className={`status-indicator ${answer.isCorrect ? 'correct' : 'incorrect'}`}>
                    {answer.isCorrect ? '✓ Correct' : '✗ Incorrect'}
                  </div>
                )}
              </div>

              {/* Show submitted code for coding questions */}
              {answer.questionType === 'coding' && answer.answer && (
                <div style={{ marginTop: '20px' }}>
                  <h5 style={{ marginBottom: '10px', color: 'var(--text-primary)' }}>Your Submitted Code:</h5>
                  <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
                    <Editor
                      height="300px"
                      language={answer.language || 'python'}
                      value={answer.answer}
                      theme={localStorage.getItem('theme') === 'dark' ? 'vs-dark' : 'light'}
                      options={{
                        readOnly: true,
                        minimap: { enabled: false },
                        fontSize: 14,
                        wordWrap: 'on',
                        lineNumbers: 'on',
                        scrollBeyondLastLine: false,
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Show MCQ answer details */}
              {answer.questionType === 'mcq' && questionData && (
                <div style={{ marginTop: '20px' }}>
                  <h5 style={{ marginBottom: '10px', color: 'var(--text-primary)' }}>Question:</h5>
                  <p style={{ marginBottom: '15px', padding: '10px', background: 'var(--bg-secondary)', borderRadius: '5px' }}>
                    {questionData.question}
                  </p>
                  
                  <h5 style={{ marginBottom: '10px', color: 'var(--text-primary)' }}>Options:</h5>
                  <div style={{ display: 'grid', gap: '10px' }}>
                    {questionData.options?.map((option, optIndex) => {
                      const isSelected = answer.answer !== undefined && parseInt(answer.answer) === optIndex;
                      const isCorrectOption = option.isCorrect;
                      
                      return (
                        <div
                          key={optIndex}
                          style={{
                            padding: '12px',
                            borderRadius: '8px',
                            border: '2px solid',
                            borderColor: isCorrectOption 
                              ? '#4CAF50' 
                              : isSelected 
                                ? '#ff4444' 
                                : 'var(--border-color)',
                            background: isCorrectOption 
                              ? '#e8f5e9' 
                              : isSelected 
                                ? '#ffebee' 
                                : 'var(--bg-secondary)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px'
                          }}
                        >
                          <span style={{ 
                            fontWeight: 'bold',
                            color: isCorrectOption ? '#4CAF50' : isSelected ? '#ff4444' : 'var(--text-secondary)'
                          }}>
                            {String.fromCharCode(65 + optIndex)}.
                          </span>
                          <span style={{ flex: 1 }}>{option.text}</span>
                          {isCorrectOption && (
                            <span style={{ color: '#4CAF50', fontWeight: 'bold' }}>✓ Correct Answer</span>
                          )}
                          {isSelected && !isCorrectOption && (
                            <span style={{ color: '#ff4444', fontWeight: 'bold' }}>Your Answer</span>
                          )}
                          {isSelected && isCorrectOption && (
                            <span style={{ color: '#4CAF50', fontWeight: 'bold' }}>✓ Your Answer (Correct)</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  
                  {questionData.explanation && (
                    <div style={{ marginTop: '15px', padding: '12px', background: '#e3f2fd', borderRadius: '8px', border: '1px solid #2196F3' }}>
                      <strong style={{ color: '#1976D2' }}>Explanation:</strong>
                      <p style={{ marginTop: '5px', marginBottom: 0 }}>{questionData.explanation}</p>
                    </div>
                  )}
                </div>
              )}
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
