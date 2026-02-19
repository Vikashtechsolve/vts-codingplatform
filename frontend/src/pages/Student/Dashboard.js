import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axiosInstance from '../../utils/axios';
import './Dashboard.css';

const SECTION_LABELS = {
  english_grammar: 'Grammar',
  english_vocabulary: 'Vocabulary',
  english_reading: 'Reading',
  english_essay: 'Writing',
  english_speaking: 'Speaking',
  english_listening: 'Listening',
};

const StudentDashboard = () => {
  const [tests, setTests] = useState([]);
  const [interviews, setInterviews] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [systemDesigns, setSystemDesigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [englishTrends, setEnglishTrends] = useState(null);

  useEffect(() => {
    fetchTests();
    fetchInterviews();
    fetchAssignments();
    fetchSystemDesigns();
    fetchEnglishTrends();
  }, []);

  const fetchEnglishTrends = async () => {
    try {
      const response = await axiosInstance.get('/students/english-trends');
      if (response.data?.totalTests > 0) setEnglishTrends(response.data);
    } catch (error) {
      // Silently ignore - widget is optional
    }
  };

  const fetchTests = async () => {
    try {
      setLoading(true);
      console.log('📥 Fetching assigned tests...');
      const response = await axiosInstance.get('/students/tests');
      console.log('✅ Tests fetched:', response.data?.length || 0);
      setTests(response.data || []);
    } catch (error) {
      console.error('❌ Error fetching tests:', error);
      alert('Error loading tests. Please refresh the page.');
    } finally {
      setLoading(false);
    }
  };

  const fetchInterviews = async () => {
    try {
      const response = await axiosInstance.get('/interviews/assigned');
      setInterviews(response.data || []);
    } catch (error) {
      console.error('❌ Error fetching interviews:', error);
    }
  };

  const fetchAssignments = async () => {
    try {
      const response = await axiosInstance.get('/assignments/student/my-assignments');
      const raw = response.data?.assignments ?? [];
      setAssignments(raw);
    } catch (error) {
      console.error('❌ Error fetching assignments:', error);
    }
  };

  const fetchSystemDesigns = async () => {
    try {
      const response = await axiosInstance.get('/system-design-problems/student-list');
      setSystemDesigns(response.data?.problems ?? []);
    } catch (error) {
      console.error('❌ Error fetching system designs:', error);
    }
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  const completedTests = tests.filter(test => test.enrollmentStatus === 'completed');
  const inProgressTests = tests.filter(test => test.enrollmentStatus === 'in_progress');
  const assignedTests = tests.filter(test => !test.enrollmentStatus || test.enrollmentStatus === 'assigned');
  const completedInterviews = interviews.filter(i => i.hasCompleted);
  const evaluatedAssignments = assignments.filter(a => a.enrollmentStatus === 'evaluated');
  const evaluatedSystemDesigns = systemDesigns.filter(sd => sd.submission && sd.submission.status === 'evaluated');
  const totalAssigned = tests.length + interviews.length + assignments.length + systemDesigns.length;
  const readinessScore = totalAssigned > 0
    ? Math.round(((completedTests.length + completedInterviews.length + evaluatedAssignments.length + evaluatedSystemDesigns.length) / totalAssigned) * 100)
    : 0;
  const upcomingTests = tests
    .filter(test => test.startDate && new Date(test.startDate) > new Date())
    .sort((a, b) => new Date(a.startDate) - new Date(b.startDate));

  const groupOrder = ['coding', 'aptitude', 'mcq', 'mixed', 'english', 'core'];
  const groupedTests = tests.reduce((acc, test) => {
    const rawType = test.type || 'other';
    const type = rawType === 'verbal' ? 'english' : rawType;
    if (!acc[type]) acc[type] = [];
    acc[type].push(test);
    return acc;
  }, {});
  groupedTests.core = tests.filter(test => test.type === 'theory');

  const renderTestCard = (test) => (
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
        {test.startDate && (
          <div className="test-meta-item">
            <strong>Starts:</strong> {new Date(test.startDate).toLocaleString()}
          </div>
        )}
      </div>
      
      <div className="test-status-section">
        <span className={`status-badge-modern ${test.enrollmentStatus || 'assigned'}`}>
          {test.enrollmentStatus || 'assigned'}
        </span>
        {(test.enrollmentStatus === 'assigned' || !test.enrollmentStatus) && (
          <Link 
            to={test.type === 'english' ? `/student/english-test/${test._id}` : `/student/test/${test._id}`} 
            className="test-action-btn btn-primary"
          >
            Start Test →
          </Link>
        )}
        {test.enrollmentStatus === 'in_progress' && (
          <Link 
            to={test.type === 'english' ? `/student/english-test/${test._id}` : `/student/test/${test._id}`} 
            className="test-action-btn btn-secondary"
          >
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

  const typeMeta = [
    { key: 'coding', title: 'Coding Tests', description: 'DSA practice and code-based tasks.', icon: '💻' },
    { key: 'aptitude', title: 'Aptitude Tests', description: 'Quantitative, logical and analytical.', icon: '🧠' },
    { key: 'mcq', title: 'MCQ Tests', description: 'Objective questions with instant checks.', icon: '❓' },
    { key: 'mixed', title: 'Mixed Tests', description: 'Combination of multiple question types.', icon: '🧩' },
    { key: 'english', title: 'English & Verbal', description: 'Grammar, vocabulary, reading, writing, speaking, listening.', icon: '🗣️' },
    { key: 'core', title: 'Core CS / Theoretical', description: 'OS, DBMS, Networks, OOP fundamentals.', icon: '📚' },
    { key: 'project', title: 'Project Evaluation (AI)', description: 'AI-based project review and scoring.', icon: '🤖' },
    { key: 'interview', title: 'Interview', description: 'Voice-based interview tests.', icon: '🎤' },
    { key: 'system', title: 'System Design', description: 'Architecture and scalability assessments.', icon: '🏗️' },
    { key: 'tools', title: 'Practical Tools', description: 'Git, SQL, Linux and tool-based tasks.', icon: '🧰' },
    { key: 'company', title: 'Company Specific', description: 'Company-focused test templates.', icon: '🏢' }
  ];

  const typeCounts = typeMeta.reduce((acc, type) => {
    if (type.key === 'interview') {
      acc[type.key] = interviews.length;
    } else if (type.key === 'project') {
      acc[type.key] = assignments.length;
    } else if (type.key === 'system') {
      acc[type.key] = systemDesigns.length;
    } else {
      acc[type.key] = groupedTests[type.key]?.length || 0;
    }
    return acc;
  }, {});

  const canStartInterview = (item) => !item.hasCompleted || item.allowMultipleAttempts === true;

  const renderAssignmentCard = (item) => {
    const assignment = item.assignment;
    const status = item.enrollmentStatus || 'assigned';
    const isOverdue = item.isOverdue;

    return (
      <div key={assignment?._id} className="test-card-modern">
        <div className="test-card-header">
          <div className="test-title-section">
            <h3>{assignment?.title}</h3>
            <span className="test-type-badge-modern project">project</span>
          </div>
        </div>
        <div className="test-meta">
          <div className="test-meta-item">
            <strong>Duration:</strong> {assignment?.duration} min
          </div>
          {assignment?.category && (
            <div className="test-meta-item">
              <strong>Category:</strong> {assignment.category}
            </div>
          )}
          {item.deadline && (
            <div className="test-meta-item">
              <strong>Deadline:</strong> {new Date(item.deadline).toLocaleString()}
            </div>
          )}
        </div>
        <div className="test-status-section">
          <span className={`status-badge-modern ${isOverdue && status !== 'evaluated' ? 'overdue' : status}`}>
            {isOverdue && status !== 'evaluated' ? 'overdue' : status}
          </span>
          {status === 'assigned' && !isOverdue && (
            <Link to={`/student/submit-assignment/${assignment?._id}`} className="test-action-btn btn-primary">
              Start Assignment →
            </Link>
          )}
          {status === 'in_progress' && !isOverdue && (
            <Link to={`/student/submit-assignment/${assignment?._id}`} className="test-action-btn btn-secondary">
              Submit Project →
            </Link>
          )}
          {status === 'submitted' && (
            <div className="test-action-buttons">
              {(item.submission?._id || item.submission) && (
                <Link
                  to={`/student/submission/${item.submission?._id || item.submission}/result`}
                  className="test-action-btn btn-primary"
                >
                  Check Status →
                </Link>
              )}
              {item.timerEndAt && new Date(item.timerEndAt) > new Date() && (
                <Link to={`/student/submit-assignment/${assignment?._id}`} className="test-action-btn btn-secondary">
                  View / Edit URL →
                </Link>
              )}
            </div>
          )}
          {status === 'evaluated' && (item.submission?._id || item.submission) && (
            <Link
              to={`/student/submission/${item.submission?._id || item.submission}/result`}
              className="test-action-btn btn-secondary"
            >
              View Result →
            </Link>
          )}
        </div>
      </div>
    );
  };

  const renderInterviewCard = (interview) => (
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
      </div>
      <div className="test-status-section">
        <span className={`status-badge-modern ${interview.hasCompleted ? 'completed' : 'assigned'}`}>
          {interview.hasCompleted ? 'completed' : 'assigned'}
        </span>
        {canStartInterview(interview) && (
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

  const getSystemDesignStatus = (sd) => {
    if (!sd.submission) return 'assigned';
    return sd.submission.status;
  };

  const getSystemDesignActionLink = (sd) => {
    const status = getSystemDesignStatus(sd);
    if (status === 'assigned' || status === 'not_started') return `/student/system-design/${sd._id}`;
    if (status === 'in_progress') return `/student/system-design/${sd._id}`;
    if (status === 'follow_up') return `/student/system-design/${sd.submission._id}/follow-up`;
    if (status === 'evaluated') return `/student/system-design-result/${sd.submission._id}`;
    return null;
  };

  const renderSystemDesignCard = (sd) => {
    const status = getSystemDesignStatus(sd);
    const actionLink = getSystemDesignActionLink(sd);
    const actionLabel = status === 'assigned' || status === 'not_started' ? 'Start Test →'
      : status === 'in_progress' ? 'Continue →'
      : status === 'follow_up' ? 'Answer Questions →'
      : status === 'evaluated' ? 'View Result →'
      : status === 'submitted' || status === 'evaluating' ? 'Evaluating...'
      : 'View →';

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
          {actionLink && !['submitted', 'evaluating'].includes(status) && (
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
  };

  const hasAnyTests = tests.length > 0 || interviews.length > 0 || assignments.length > 0 || systemDesigns.length > 0;

  return (
    <div className="container student-dashboard">
      <h1 className="page-title">Student Dashboard</h1>

      <div className="dashboard-summary">
        <div className="summary-card">
          <h3>Overall Readiness Score</h3>
          <div className="summary-value">{readinessScore}%</div>
          <div className="summary-subtext">{completedTests.length + completedInterviews.length} of {totalAssigned} completed</div>
        </div>
        <div className="summary-card">
          <h3>Upcoming Tests</h3>
          <div className="summary-value">{upcomingTests.length}</div>
          <div className="summary-subtext">
            {upcomingTests[0] ? `Next: ${upcomingTests[0].title}` : 'No upcoming tests'}
          </div>
        </div>
        <div className="summary-card">
          <h3>Pending Evaluations</h3>
          <div className="summary-value">
            {inProgressTests.length + assignments.filter(a => ['in_progress', 'submitted'].includes(a.enrollmentStatus)).length + systemDesigns.filter(sd => sd.submission && ['in_progress', 'submitted', 'evaluating'].includes(sd.submission.status)).length}
          </div>
          <div className="summary-subtext">In-progress tests & assignments</div>
        </div>
        <div className="summary-card">
          <h3>Assigned Tests</h3>
          <div className="summary-value">
            {assignedTests.length + interviews.filter(i => !i.hasCompleted).length + assignments.filter(a => a.enrollmentStatus === 'assigned').length + systemDesigns.filter(sd => !sd.submission).length}
          </div>
          <div className="summary-subtext">Ready to start</div>
        </div>
      </div>

      {englishTrends && (
        <div className="english-trends-widget">
          <div className="trends-widget-header">
            <h2>English Skill Trends</h2>
            <Link to="/student/tests/english" className="btn btn-sm btn-secondary">View All Tests</Link>
          </div>
          <div className="trends-stats-row">
            <div className="trend-stat">
              <span className="trend-stat-value">{englishTrends.totalTests}</span>
              <span className="trend-stat-label">Tests Taken</span>
            </div>
            <div className="trend-stat">
              <span className="trend-stat-value">{englishTrends.latestPercentage ?? '-'}%</span>
              <span className="trend-stat-label">Latest Score</span>
            </div>
            {englishTrends.improvement !== null && (
              <div className="trend-stat">
                <span className={`trend-stat-value ${englishTrends.improvement >= 0 ? 'positive' : 'negative'}`}>
                  {englishTrends.improvement >= 0 ? '+' : ''}{englishTrends.improvement}%
                </span>
                <span className="trend-stat-label">vs Previous</span>
              </div>
            )}
          </div>
          <div className="section-averages-grid">
            {Object.entries(englishTrends.sectionAverages || {}).map(([key, avg]) => {
              if (avg === null) return null;
              return (
                <div key={key} className="section-avg-item">
                  <div className="section-avg-label">{SECTION_LABELS[key] || key}</div>
                  <div className="section-avg-bar-wrap">
                    <div className={`section-avg-bar ${avg >= 70 ? 'excellent' : avg >= 50 ? 'good' : 'poor'}`} style={{ width: `${avg}%` }} />
                  </div>
                  <div className="section-avg-value">{avg}%</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="test-type-nav">
        {typeMeta.map(type => (
          <Link
            key={type.key}
            to={`/student/tests/${type.key}`}
            className="test-type-nav-card"
          >
            <div className="test-type-nav-title">
              <span className="test-type-nav-icon">{type.icon}</span>
              {type.title}
            </div>
            <div className="test-type-nav-count">{typeCounts[type.key]}</div>
            <div className="test-type-nav-subtext">{type.description}</div>
            <div className="test-type-nav-cta">View {type.key} tests →</div>
          </Link>
        ))}
      </div>

      {!hasAnyTests ? (
        <div className="empty-state">
          <div className="empty-state-icon">📝</div>
          <h2>No Tests Assigned</h2>
          <p>No tests assigned yet.</p>
          <p>Your instructor will assign tests to you.</p>
        </div>
      ) : (
        <>
          {groupOrder.map(type => (
            groupedTests[type] ? (
              <div key={type} className="test-section">
                <div className="test-section-header">
                  <div className="test-section-title">{type.toUpperCase()} Tests</div>
                  <span className="test-section-badge">{groupedTests[type].length} tests</span>
                </div>
                <div className="tests-grid">
                  {groupedTests[type].map(renderTestCard)}
                </div>
              </div>
            ) : null
          ))}
          {Object.keys(groupedTests).filter(type => !groupOrder.includes(type)).map(type => (
            <div key={type} className="test-section">
              <div className="test-section-header">
                <div className="test-section-title">{type.toUpperCase()} Tests</div>
                <span className="test-section-badge">{groupedTests[type].length} tests</span>
              </div>
              <div className="tests-grid">
                {groupedTests[type].map(renderTestCard)}
              </div>
            </div>
          ))}
          {assignments.length > 0 && (
            <div className="test-section">
              <div className="test-section-header">
                <div className="test-section-title">PROJECT EVALUATION (AI)</div>
                <span className="test-section-badge">{assignments.length} assignment{assignments.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="tests-grid">
                {assignments.map(renderAssignmentCard)}
              </div>
            </div>
          )}
          {interviews.length > 0 && (
            <div className="test-section">
              <div className="test-section-header">
                <div className="test-section-title">INTERVIEW TESTS</div>
                <span className="test-section-badge">{interviews.length} tests</span>
              </div>
              <div className="tests-grid">
                {interviews.map(renderInterviewCard)}
              </div>
            </div>
          )}
          {systemDesigns.length > 0 && (
            <div className="test-section">
              <div className="test-section-header">
                <div className="test-section-title">SYSTEM DESIGN</div>
                <span className="test-section-badge">{systemDesigns.length} problem{systemDesigns.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="tests-grid">
                {systemDesigns.map(renderSystemDesignCard)}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default StudentDashboard;

