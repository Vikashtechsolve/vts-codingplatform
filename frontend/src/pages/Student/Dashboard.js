import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axiosInstance from '../../utils/axios';
import './Dashboard.css';

const StudentDashboard = () => {
  const [tests, setTests] = useState([]);
  const [interviews, setInterviews] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTests();
    fetchInterviews();
  }, []);

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

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  const completedTests = tests.filter(test => test.enrollmentStatus === 'completed');
  const inProgressTests = tests.filter(test => test.enrollmentStatus === 'in_progress');
  const assignedTests = tests.filter(test => !test.enrollmentStatus || test.enrollmentStatus === 'assigned');
  const completedInterviews = interviews.filter(i => i.hasCompleted);
  const totalAssigned = tests.length + interviews.length;
  const readinessScore = totalAssigned > 0 ? Math.round(((completedTests.length + completedInterviews.length) / totalAssigned) * 100) : 0;
  const upcomingTests = tests
    .filter(test => test.startDate && new Date(test.startDate) > new Date())
    .sort((a, b) => new Date(a.startDate) - new Date(b.startDate));

  const groupOrder = ['coding', 'aptitude', 'mcq', 'mixed', 'core'];
  const groupedTests = tests.reduce((acc, test) => {
    const type = test.type || 'other';
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
            to={`/student/test/${test._id}`} 
            className="test-action-btn btn-primary"
          >
            Start Test →
          </Link>
        )}
        {test.enrollmentStatus === 'in_progress' && (
          <Link 
            to={`/student/test/${test._id}`} 
            className="test-action-btn btn-secondary"
          >
            Continue →
          </Link>
        )}
        {test.enrollmentStatus === 'completed' && (
          <Link 
            to={test.resultId ? `/student/result/${test.resultId}` : `/student/result/test/${test._id}`} 
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
    { key: 'verbal', title: 'Verbal & English', description: 'Grammar, comprehension, and vocabulary.', icon: '🗣️' },
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
    } else {
      acc[type.key] = groupedTests[type.key]?.length || 0;
    }
    return acc;
  }, {});

  const canStartInterview = (item) => !item.hasCompleted || item.allowMultipleAttempts === true;

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

  const hasAnyTests = tests.length > 0 || interviews.length > 0;

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
          <div className="summary-value">{inProgressTests.length}</div>
          <div className="summary-subtext">In-progress tests</div>
        </div>
        <div className="summary-card">
          <h3>Assigned Tests</h3>
          <div className="summary-value">{assignedTests.length + interviews.length}</div>
          <div className="summary-subtext">Ready to start</div>
        </div>
      </div>

      <div className="test-type-nav">
        {typeMeta.map(type => (
          <Link
            key={type.key}
            to={type.key === 'interview' ? '/student/tests/interview' : `/student/tests/${type.key}`}
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
        </>
      )}
    </div>
  );
};

export default StudentDashboard;

