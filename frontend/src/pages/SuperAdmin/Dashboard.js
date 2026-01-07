import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axiosInstance from '../../utils/axios';
import './Dashboard.css';

const SuperAdminDashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await axiosInstance.get('/super-admin/stats');
      setStats(response.data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="container">
      <h1 className="page-title">Super Admin Dashboard</h1>

      <div className="stats-grid">
        <div className="stat-card">
          <h3>Total Vendors</h3>
          <p className="stat-number">{stats?.totalVendors || 0}</p>
        </div>
        <div className="stat-card">
          <h3>Active Vendors</h3>
          <p className="stat-number">{stats?.activeVendors || 0}</p>
        </div>
        <div className="stat-card">
          <h3>Total Users</h3>
          <p className="stat-number">{stats?.totalUsers || 0}</p>
        </div>
        <div className="stat-card">
          <h3>Total Tests</h3>
          <p className="stat-number">{stats?.totalTests || 0}</p>
        </div>
        <div className="stat-card">
          <h3>Total Results</h3>
          <p className="stat-number">{stats?.totalResults || 0}</p>
        </div>
      </div>

      <div className="action-buttons">
        <Link to="/super-admin/vendors" className="btn btn-primary">
          Manage Vendors
        </Link>
        <Link to="/super-admin/global-questions" className="btn btn-primary">
          Global Question Bank
        </Link>
      </div>
    </div>
  );
};

export default SuperAdminDashboard;

