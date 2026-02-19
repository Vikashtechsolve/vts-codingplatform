import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import axiosInstance from '../../utils/axios';
import './Dashboard.css';
import './TestsByType.css';

const TestsByType = () => {
  const { type } = useParams();
  const [tests, setTests] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [systemDesigns, setSystemDesigns] = useState([]);
  const [loading, setLoading] = useState(true);

  const typeMeta = {
    coding: { title: 'Coding Tests', description: 'DSA practice and code-based tasks.', icon: '💻' },
    aptitude: { title: 'Aptitude Tests', description: 'Quantitative, logical and analytical.', icon: '🧠' },
    mcq: { title: 'MCQ Tests', description: 'Objective questions with instant checks.', icon: '❓' },
    mixed: { title: 'Mixed Tests', description: 'Combination of multiple question types.', icon: '🧩' },
    english: { title: 'English & Verbal', description: 'Grammar, vocabulary, reading, writing, speaking, and listening.', icon: '🗣️' },
    verbal: { title: 'Verbal & English', description: 'Grammar, comprehension, and vocabulary.', icon: '🗣️' },
    core: { title: 'Core CS / Theoretical', description: 'OS, DBMS, Networks, OOP fundamentals.', icon: '📚' },
    project: { title: 'Project Evaluation (AI)', description: 'AI-based project review and scoring.', icon: '🤖' },
    interview: { title: 'Interview', description: 'Voice-based interview tests.', icon: '🎤' },
    system: { title: 'System Design', description: 'Architecture and scalability assessments.', icon: '🏗️' },
    tools: { title: 'Practical Tools', description: 'Git, SQL, Linux and tool-based tasks.', icon: '🧰' },
    company: { title: 'Company Specific', description: 'Company-focused test templates.', icon: '🏢' }
  };
  const normalizedType = Object.keys(typeMeta).includes(type) ? type : null;

  useEffect(() => {
    const fetchData = async () => {
      try {
        if (normalizedType === 'interview') {
          const response = await axiosInstance.get('/interviews/assigned');
          setTests(response.data || []);
        } else if (normalizedType === 'project') {
          const response = await axiosInstance.get('/assignments/student/my-assignments');
          const raw = response.data?.assignments ?? [];
          const transformed = raw.map(item => ({
            ...(item.assignment || {}),
            deadline: item.deadline,
            timerEndAt: item.timerEndAt,
            enrollmentData: {
              status: item.enrollmentStatus,
              submissionId: item.submission?._id ?? item.submission
            }
          }));
          setAssignments(transformed);
        } else if (normalizedType === 'system') {
          const response = await axiosInstance.get('/system-design-problems/student-list');
          setSystemDesigns(response.data?.problems ?? []);
        } else {
          const response = await axiosInstance.get('/students/tests');
          setTests(response.data || []);
        }
      } catch (error) {
        console.error('❌ Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [normalizedType]);

  if (!normalizedType) {
    return (
      <div className="container student-dashboard">
        <div className="tests-by-type-header">
          <h1>Test Type Not Found</h1>
          <Link to="/student/dashboard" className="btn btn-secondary">
            Back to Dashboard
          </Link>
        </div>
        <p>Invalid test type.</p>
      </div>
    );
  }

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  const isInterviewType = normalizedType === 'interview';
  const isProjectType = normalizedType === 'project';
  const isSystemType = normalizedType === 'system';
  const filtered = isInterviewType
    ? tests
    : isProjectType
      ? assignments
      : isSystemType
        ? systemDesigns
          : normalizedType === 'core'
            ? tests.filter(test => test.type === 'theory')
            : normalizedType === 'tools'
              ? tests.filter(test => test.type === 'sql')
              : (normalizedType === 'verbal' || normalizedType === 'english')
                ? tests.filter(test => test.type === 'english' || test.type === 'verbal')
                : tests.filter(test => test.type === normalizedType);

  const canStartInterview = (item) => {
    if (!item.hasCompleted) return true;
    return item.allowMultipleAttempts === true;
  };

  return (
    <div className="container student-dashboard">
      <div className="tests-by-type-hero">
        <div className="tests-by-type-header">
          <div className="tests-by-type-title">
            <span className="tests-by-type-icon">{typeMeta[normalizedType].icon}</span>
            <div>
              <h1>{typeMeta[normalizedType].title}</h1>
              <p className="tests-by-type-subtext">
                {typeMeta[normalizedType].description} · {filtered.length} test(s)
              </p>
            </div>
          </div>
          <Link to="/student/dashboard" className="btn btn-secondary">
            Back to Dashboard
          </Link>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📝</div>
          <h2>No {normalizedType.toUpperCase()} Tests</h2>
          <p>No tests available right now.</p>
        </div>
      ) : (
        <div className="tests-grid">
          {filtered.map(item => {
            if (isSystemType) {
              const sd = item;
              const status = sd.submission ? sd.submission.status : 'assigned';
              const actionLink = (status === 'assigned' || status === 'not_started')
                ? `/student/system-design/${sd._id}`
                : status === 'in_progress'
                  ? `/student/system-design/${sd._id}`
                  : status === 'follow_up'
                    ? `/student/system-design/${sd.submission._id}/follow-up`
                    : status === 'evaluated'
                      ? `/student/system-design-result/${sd.submission._id}`
                      : null;
              const actionLabel = (status === 'assigned' || status === 'not_started') ? 'Start Test →'
                : status === 'in_progress' ? 'Continue →'
                : status === 'follow_up' ? 'Answer Questions →'
                : status === 'evaluated' ? 'View Result →'
                : null;

              return (
                <div key={sd._id} className="test-card-modern">
                  <div className="test-card-header">
                    <div className="test-title-section">
                      <h3>{sd.title}</h3>
                      <span className="test-type-badge-modern system">system design</span>
                    </div>
                  </div>
                  <div className="test-meta">
                    <div className="test-meta-item">
                      <strong>Duration:</strong> {sd.duration} min
                    </div>
                    {sd.difficulty && (
                      <div className="test-meta-item">
                        <strong>Difficulty:</strong> {sd.difficulty}
                      </div>
                    )}
                    {sd.category && (
                      <div className="test-meta-item">
                        <strong>Category:</strong> {sd.category}
                      </div>
                    )}
                  </div>
                  <div className="test-status-section">
                    <span className={`status-badge-modern ${status}`}>
                      {status.replace('_', ' ')}
                    </span>
                    {actionLink && actionLabel && (
                      <Link to={actionLink} className={`test-action-btn ${status === 'evaluated' || status === 'follow_up' ? 'btn-secondary' : 'btn-primary'}`}>
                        {actionLabel}
                      </Link>
                    )}
                    {['submitted', 'evaluating'].includes(status) && (
                      <span className="test-action-btn btn-info">Evaluating...</span>
                    )}
                    {status === 'evaluated' && sd.submission?.percentage !== undefined && (
                      <span className="test-action-btn btn-info" style={{ marginLeft: 4 }}>
                        Score: {Math.round(sd.submission.percentage)}%
                      </span>
                    )}
                  </div>
                </div>
              );
            }
            if (isInterviewType) {
              const interview = item;
              const showStart = canStartInterview(interview);
              return (
                <div key={interview._id} className="test-card-modern">
                  <div className="test-card-header">
                    <div className="test-title-section">
                      <h3>{interview.title}</h3>
                      <span className="test-type-badge-modern interview">interview</span>
                    </div>
                  </div>
                  <div className="test-meta">
                    <div className="test-meta-item">
                      <strong>Duration:</strong> {interview.duration} min
                    </div>
                    <div className="test-meta-item">
                      <strong>Type:</strong> {interview.interviewType} · {interview.topic}
                    </div>
                  </div>
                  <div className="test-status-section">
                    <span className={`status-badge-modern ${interview.hasCompleted ? 'completed' : (interview.enrollmentStatus || 'assigned')}`}>
                      {interview.hasCompleted ? 'completed' : (interview.enrollmentStatus || 'assigned')}
                    </span>
                    {showStart && (
                      <Link to={`/student/interviews/${interview._id}`} className="test-action-btn btn-primary">
                        Start Test →
                      </Link>
                    )}
                    {interview.hasCompleted && interview.lastSessionId && (
                      <Link
                        to={`/student/interviews/feedback/${interview.lastSessionId}`}
                        className="test-action-btn btn-secondary"
                      >
                        View Result →
                      </Link>
                    )}
                  </div>
                </div>
              );
            }
            if (isProjectType) {
              const assignment = item;
              const enrollmentData = assignment.enrollmentData || {};
              const status = enrollmentData.status || 'assigned';
              const isOverdue = assignment.deadline && new Date(assignment.deadline) < new Date();
              
              return (
                <div key={assignment._id} className="test-card-modern">
                  <div className="test-card-header">
                    <div className="test-title-section">
                      <h3>{assignment.title}</h3>
                      <span className="test-type-badge-modern project">project</span>
                    </div>
                  </div>
                  <div className="test-meta">
                    <div className="test-meta-item">
                      <strong>Duration:</strong> {assignment.duration} min
                    </div>
                    <div className="test-meta-item">
                      <strong>Category:</strong> {assignment.category}
                    </div>
                    <div className="test-meta-item">
                      <strong>Difficulty:</strong> {assignment.difficulty}
                    </div>
                    {assignment.deadline && (
                      <div className="test-meta-item">
                        <strong>Deadline:</strong> {new Date(assignment.deadline).toLocaleString()}
                      </div>
                    )}
                  </div>
                  <div className="test-status-section">
                    <span className={`status-badge-modern ${isOverdue ? 'overdue' : status}`}>
                      {isOverdue && status !== 'evaluated' ? 'overdue' : status}
                    </span>
                    {status === 'assigned' && !isOverdue && (
                      <Link to={`/student/submit-assignment/${assignment._id}`} className="test-action-btn btn-primary">
                        Start Assignment →
                      </Link>
                    )}
                    {status === 'in_progress' && !isOverdue && (
                      <Link to={`/student/submit-assignment/${assignment._id}`} className="test-action-btn btn-secondary">
                        Submit Project →
                      </Link>
                    )}
                    {status === 'submitted' && (
                      <div className="test-action-buttons">
                        {enrollmentData.submissionId && (
                          <Link
                            to={`/student/submission/${enrollmentData.submissionId}/result`}
                            className="test-action-btn btn-primary"
                          >
                            Check Status →
                          </Link>
                        )}
                        {assignment.timerEndAt && new Date(assignment.timerEndAt) > new Date() && (
                          <Link to={`/student/submit-assignment/${assignment._id}`} className="test-action-btn btn-secondary">
                            View / Edit URL →
                          </Link>
                        )}
                        {!enrollmentData.submissionId && (
                          <span className="test-action-btn btn-info">Evaluation Pending...</span>
                        )}
                      </div>
                    )}
                    {status === 'evaluated' && enrollmentData.submissionId && (
                      <Link
                        to={`/student/submission/${enrollmentData.submissionId}/result`}
                        className="test-action-btn btn-secondary"
                      >
                        View Result →
                      </Link>
                    )}
                  </div>
                </div>
              );
            }
            const test = item;
            return (
              <div key={test._id} className="test-card-modern">
                <div className="test-card-header">
                  <div className="test-title-section">
                    <h3>{test.title}</h3>
                    <span className={`test-type-badge-modern ${test.type}`}>
                      {test.type}
                    </span>
                  </div>
                </div>
                <div className="test-meta">
                  <div className="test-meta-item">
                    <strong>Duration:</strong> {test.duration} min
                  </div>
                </div>
                <div className="test-status-section">
                  <span className={`status-badge-modern ${test.enrollmentStatus || 'assigned'}`}>
                    {test.enrollmentStatus || 'assigned'}
                  </span>
                  {(test.enrollmentStatus === 'assigned' || !test.enrollmentStatus) && (
                    <Link to={test.type === 'english' ? `/student/english-test/${test._id}` : `/student/test/${test._id}`} className="test-action-btn btn-primary">
                      Start Test →
                    </Link>
                  )}
                  {test.enrollmentStatus === 'in_progress' && (
                    <Link to={test.type === 'english' ? `/student/english-test/${test._id}` : `/student/test/${test._id}`} className="test-action-btn btn-secondary">
                      Continue →
                    </Link>
                  )}
                  {test.enrollmentStatus === 'completed' && (
                    <Link
                      to={test.type === 'english'
                        ? (test.resultId ? `/student/english-result/${test.resultId}` : `/student/english-result/test/${test._id}`)
                        : (test.resultId ? `/student/result/${test.resultId}` : `/student/result/test/${test._id}`)}
                      className="test-action-btn btn-secondary"
                    >
                      View Result →
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default TestsByType;

