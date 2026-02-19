import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axiosInstance from '../../utils/axios';
import './Dashboard.css';

const VendorAdminDashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
    
    // Refresh stats when component becomes visible (user navigates back)
    const handleFocus = () => {
      fetchStats();
    };
    window.addEventListener('focus', handleFocus);
    
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  const fetchStats = async () => {
    try {
      console.log('📥 Fetching dashboard stats...');
      const response = await axiosInstance.get('/vendor-admin/dashboard/stats');
      console.log('✅ Dashboard stats:', response.data);
      setStats(response.data);
    } catch (error) {
      console.error('❌ Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const testTypeCards = [
    {
      key: 'coding',
      title: 'Coding Tests',
      description: 'DSA problems with automated evaluation.',
      icon: '💻',
      actions: [
        { label: 'Create Questions', to: '/vendor-admin/questions/coding/create' },
        { label: 'Create Test', to: '/vendor-admin/tests/create?type=coding' }
      ]
    },
    {
      key: 'aptitude',
      title: 'Aptitude Tests',
      description: 'Quantitative, logical, and analytical aptitude.',
      icon: '🧠',
      actions: [
        { label: 'Create Questions', to: '/vendor-admin/questions/aptitude/create' },
        { label: 'Create Test', to: '/vendor-admin/tests/create?type=aptitude' }
      ]
    },
    {
      key: 'mcq',
      title: 'MCQ Tests',
      description: 'Single/multiple correct objective questions.',
      icon: '❓',
      actions: [
        { label: 'Create Questions', to: '/vendor-admin/questions/mcq/create' },
        { label: 'Create Test', to: '/vendor-admin/tests/create?type=mcq' }
      ]
    },
    {
      key: 'english',
      title: 'Verbal & English',
      description: 'Grammar, vocabulary, reading, writing, speaking, and listening.',
      icon: '🗣️',
      actions: [
        { label: 'Create Test', to: '/vendor-admin/english-tests/create' },
        { label: 'View Tests', to: '/vendor-admin/tests?type=english' }
      ]
    },
    {
      key: 'theory',
      title: 'Core CS / Theoretical',
      description: 'OS, DBMS, Networks, OOP fundamentals.',
      icon: '📚',
      actions: [
        { label: 'Create Questions', to: '/vendor-admin/questions/theory/create' },
        { label: 'Create Test', to: '/vendor-admin/tests/create?type=theory' }
      ]
    },
    {
      key: 'project',
      title: 'Project Evaluation (AI)',
      description: 'AI-based project review and scoring.',
      icon: '🤖',
      actions: [
        { label: 'Create Assignment', to: '/vendor-admin/create-assignment' },
        { label: 'View Assignments', to: '/vendor-admin/assignments' }
      ]
    },
    {
      key: 'interview',
      title: 'Interview',
      description: 'Voice-based interview tests.',
      icon: '🎤',
      actions: [
        { label: 'Create Test', to: '/vendor-admin/interviews/create' },
        { label: 'View Tests', to: '/vendor-admin/tests?type=interview' }
      ]
    },
    {
      key: 'system',
      title: 'System Design',
      description: 'Architecture and scalability assessments.',
      icon: '🏗️',
      actions: [
        { label: 'Create Problem', to: '/vendor-admin/system-designs/create' },
        { label: 'View Problems', to: '/vendor-admin/system-designs' }
      ]
    },
    {
      key: 'tools',
      title: 'Practical Tools (SQL)',
      description: 'SQL exams with dataset templates and output-based evaluation.',
      icon: '🧰',
      actions: [
        { label: 'Dataset Templates', to: '/vendor-admin/dataset-templates' },
        { label: 'Create SQL Test', to: '/vendor-admin/sql-tests/create' }
      ]
    },
    {
      key: 'company',
      title: 'Company Specific',
      description: 'Company-focused test templates.',
      icon: '🏢',
      comingSoon: true
    }
  ];

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="container vendor-dashboard">
      <h1 className="page-title">Vendor Admin Dashboard</h1>

      <div className="stats-grid-vendor">
        <div className="stat-card-vendor tests">
          <h3>Total Tests</h3>
          <p className="stat-number-vendor">{stats?.totalTests || 0}</p>
        </div>
        <div className="stat-card-vendor students">
          <h3>Total Students</h3>
          <p className="stat-number-vendor">{stats?.totalStudents || 0}</p>
        </div>
        <div className="stat-card-vendor results">
          <h3>Total Results</h3>
          <p className="stat-number-vendor">{stats?.totalResults || 0}</p>
        </div>
        <div className="stat-card-vendor completed">
          <h3>Completed Results</h3>
          <p className="stat-number-vendor">{stats?.completedResults || 0}</p>
        </div>
      </div>

      <div className="test-type-section">
        <div className="section-header">
          <h2>Test Types</h2>
          <Link to="/vendor-admin/tests" className="btn btn-secondary btn-sm">
            View All Tests
          </Link>
        </div>
        <div className="test-type-grid">
          {testTypeCards.map(card => (
            <div key={card.key} className={`test-type-card ${card.comingSoon ? 'coming-soon' : ''}`}>
              <div className="test-type-card-header">
                <span className="test-type-icon">{card.icon}</span>
                <div>
                  <h3>{card.title}</h3>
                  {card.comingSoon && <span className="coming-soon-badge">Coming Soon</span>}
                </div>
              </div>
              <p className="test-type-description">{card.description}</p>
              <div className="test-type-actions">
                {card.actions ? (
                  card.actions.map(action => (
                    <Link key={action.label} to={action.to} className="btn btn-primary btn-sm">
                      {action.label}
                    </Link>
                  ))
                ) : (
                  <>
                    <button className="btn btn-secondary btn-sm" disabled>
                      Create Questions
                    </button>
                    <button className="btn btn-secondary btn-sm" disabled>
                      Create Test
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="action-buttons-vendor">
        <Link to="/vendor-admin/tests/create" className="action-card action-card-primary">
          <span className="action-card-icon">➕</span>
          <h3 className="action-card-title">Create Test</h3>
        </Link>
        <Link to="/vendor-admin/classrooms/create" className="action-card action-card-primary">
          <span className="action-card-icon">🏫</span>
          <h3 className="action-card-title">Create Classroom</h3>
        </Link>
        <Link to="/vendor-admin/tests" className="action-card">
          <span className="action-card-icon">📋</span>
          <h3 className="action-card-title">View Tests</h3>
        </Link>
        <Link to="/vendor-admin/classrooms" className="action-card">
          <span className="action-card-icon">👥</span>
          <h3 className="action-card-title">View Classrooms</h3>
        </Link>
        <Link to="/vendor-admin/questions" className="action-card">
          <span className="action-card-icon">❓</span>
          <h3 className="action-card-title">Manage Questions</h3>
        </Link>
        <Link to="/vendor-admin/students" className="action-card">
          <span className="action-card-icon">👨‍🎓</span>
          <h3 className="action-card-title">Manage Students</h3>
        </Link>
        <Link to="/vendor-admin/analytics" className="action-card">
          <span className="action-card-icon">📊</span>
          <h3 className="action-card-title">Analytics</h3>
        </Link>
        <Link to="/vendor-admin/settings" className="action-card">
          <span className="action-card-icon">⚙️</span>
          <h3 className="action-card-title">Settings</h3>
        </Link>
      </div>
    </div>
  );
};

export default VendorAdminDashboard;

