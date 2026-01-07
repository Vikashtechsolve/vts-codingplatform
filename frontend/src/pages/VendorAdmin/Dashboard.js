import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axiosInstance from '../../utils/axios';
import { FiFileText, FiUsers, FiBarChart2, FiCheckCircle, FiPlus, FiEye, FiSettings } from 'react-icons/fi';
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

