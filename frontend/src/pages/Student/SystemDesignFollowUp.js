import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axiosInstance from '../../utils/axios';
import './SystemDesignFollowUp.css';

const SystemDesignFollowUp = () => {
  const { submissionId } = useParams();
  const navigate = useNavigate();
  const [submission, setSubmission] = useState(null);
  const [loading, setLoading] = useState(true);
  const [evaluating, setEvaluating] = useState(false);
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [answer, setAnswer] = useState('');
  const [submittingAnswer, setSubmittingAnswer] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const pollRef = useRef(null);

  const startPolling = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const { data } = await axiosInstance.get(`/system-design-submissions/${submissionId}`);
        if (!data.success) return;
        const sub = data.submission;

        if (sub.status === 'follow_up') {
          clearInterval(pollRef.current);
          pollRef.current = null;
          setSubmission(sub);
          setEvaluating(false);
          const firstUnanswered = (sub.followUpQuestions || []).findIndex(q => !q.answer);
          if (firstUnanswered >= 0) setCurrentQIndex(firstUnanswered);
        } else if (sub.status === 'evaluated') {
          clearInterval(pollRef.current);
          pollRef.current = null;
          navigate(`/student/system-design-result/${submissionId}`, { replace: true });
        }
      } catch (err) {
        console.error('Poll error:', err);
      }
    }, 4000);
  }, [submissionId, navigate]);

  const fetchSubmission = useCallback(async () => {
    try {
      const { data } = await axiosInstance.get(`/system-design-submissions/${submissionId}`);
      if (data.success) {
        const sub = data.submission;
        const status = sub.status;

        if (status === 'submitted' || status === 'evaluating') {
          setSubmission(sub);
          setEvaluating(true);
          setLoading(false);
          startPolling();
          return;
        }

        if (status === 'evaluated' && (!sub.followUpQuestions || sub.followUpQuestions.length === 0)) {
          navigate(`/student/system-design-result/${submissionId}`, { replace: true });
          return;
        }

        setSubmission(sub);
        setEvaluating(false);
        const firstUnanswered = (sub.followUpQuestions || []).findIndex(q => !q.answer);
        if (firstUnanswered >= 0) setCurrentQIndex(firstUnanswered);
        else setCurrentQIndex(sub.followUpQuestions?.length || 0);
      }
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  }, [submissionId, navigate, startPolling]);

  useEffect(() => {
    fetchSubmission();
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [fetchSubmission]);

  const handleSubmitAnswer = async () => {
    if (!answer.trim()) return;
    setSubmittingAnswer(true);
    setFeedback(null);
    try {
      const { data } = await axiosInstance.post(`/system-design-submissions/${submissionId}/follow-up-answer`, {
        questionIndex: currentQIndex,
        answer
      });
      if (data.success) {
        setFeedback({ score: data.score, feedback: data.feedback });

        // Update local state
        const updated = { ...submission };
        updated.followUpQuestions[currentQIndex].answer = answer;
        updated.followUpQuestions[currentQIndex].score = data.score;
        updated.followUpQuestions[currentQIndex].feedback = data.feedback;
        setSubmission(updated);

        if (data.allAnswered) {
          setTimeout(() => {
            navigate(`/student/system-design-result/${submissionId}`);
          }, 3000);
        }
      }
    } catch (err) {
      console.error('Error submitting answer:', err);
    } finally {
      setSubmittingAnswer(false);
    }
  };

  const goToNext = () => {
    setAnswer('');
    setFeedback(null);
    setCurrentQIndex(prev => prev + 1);
  };

  if (loading) return <div className="sdfu-container"><div className="sdfu-loading">Loading...</div></div>;
  if (!submission) return <div className="sdfu-container"><div className="sdfu-loading">Submission not found</div></div>;

  if (evaluating) {
    return (
      <div className="sdfu-container">
        <div className="sdfu-evaluating">
          <div className="sdfu-evaluating-icon">🤖</div>
          <h2>AI is Evaluating Your Design</h2>
          <p>The AI is analyzing your architecture, tradeoffs, and design decisions. This usually takes 30–60 seconds.</p>
          <div className="sdfu-evaluating-spinner" />
          <p className="sdfu-evaluating-hint">Please don't close this page. Follow-up questions will appear automatically once the evaluation is complete.</p>
        </div>
      </div>
    );
  }

  const questions = submission.followUpQuestions || [];
  const allAnswered = questions.every(q => q.answer);
  const currentQ = questions[currentQIndex];

  return (
    <div className="sdfu-container">
      <div className="sdfu-header">
        <h1>AI Follow-up Questions</h1>
        <p className="sdfu-desc">
          The AI has reviewed your design and has some questions. This simulates the defense phase of a real interview.
        </p>
        <div className="sdfu-progress">
          {questions.map((q, idx) => (
            <div key={idx} className={`sdfu-progress-dot ${q.answer ? 'answered' : ''} ${idx === currentQIndex ? 'current' : ''}`}>
              {idx + 1}
            </div>
          ))}
        </div>
      </div>

      {allAnswered ? (
        <div className="sdfu-complete">
          <div className="sdfu-complete-icon">🎉</div>
          <h2>All questions answered!</h2>
          <p>Your evaluation is complete. Redirecting to results...</p>
          <button className="sdfu-results-btn" onClick={() => navigate(`/student/system-design-result/${submissionId}`)}>
            View Results
          </button>
        </div>
      ) : currentQ ? (
        <div className="sdfu-question-area">
          <div className="sdfu-question-card">
            <div className="sdfu-question-num">Question {currentQIndex + 1} of {questions.length}</div>
            <p className="sdfu-question-text">{currentQ.question}</p>
          </div>

          {!currentQ.answer ? (
            <>
              <textarea
                className="sdfu-answer-input"
                value={answer}
                onChange={e => setAnswer(e.target.value)}
                placeholder="Type your answer here... Be specific and reference your design choices."
                rows={6}
                disabled={submittingAnswer}
              />
              <button
                className="sdfu-submit-btn"
                onClick={handleSubmitAnswer}
                disabled={submittingAnswer || !answer.trim()}
              >
                {submittingAnswer ? 'Evaluating...' : 'Submit Answer'}
              </button>
            </>
          ) : null}

          {(feedback || currentQ.answer) && (
            <div className="sdfu-feedback-card">
              {currentQ.answer && <div className="sdfu-your-answer"><strong>Your answer:</strong> {currentQ.answer}</div>}
              <div className="sdfu-score">
                Score: <span className={`sdfu-score-val ${(feedback?.score || currentQ.score) >= 7 ? 'good' : (feedback?.score || currentQ.score) >= 4 ? 'ok' : 'poor'}`}>
                  {feedback?.score || currentQ.score}/10
                </span>
              </div>
              <p className="sdfu-feedback-text">{feedback?.feedback || currentQ.feedback}</p>
              {currentQIndex < questions.length - 1 && (
                <button className="sdfu-next-btn" onClick={goToNext}>Next Question →</button>
              )}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
};

export default SystemDesignFollowUp;
