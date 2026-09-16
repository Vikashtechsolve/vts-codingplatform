import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axiosInstance from '../../../utils/axios';
import VendorHubPage from '../../../components/VendorAdmin/VendorHubPage';
import { PracticeStatCard, PracticeStatsGrid } from '../../../components/Practice/PracticeCards';
import '../../../styles/practice-pages.css';

const PracticeAdminHub = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axiosInstance.get('/super-admin/practice/analytics')
      .then((res) => setStats(res.data))
      .finally(() => setLoading(false));
  }, []);

  return (
    <VendorHubPage title="Practice Platform" backTo="/super-admin/dashboard">
      <PracticeStatsGrid>
        <PracticeStatCard value={loading ? '—' : stats?.totalQuestions ?? 0} label="Practice questions" variant="accent" />
        <PracticeStatCard value={loading ? '—' : stats?.activeStudents ?? 0} label="Active students" />
        <PracticeStatCard value={loading ? '—' : stats?.totalSubmissions ?? 0} label="Submissions" />
        <PracticeStatCard value={loading ? '—' : `${stats?.successRate ?? 0}%`} label="Success rate" />
      </PracticeStatsGrid>

      <div className="practice-problem-grid" style={{ marginTop: 24 }}>
        <Link to="/super-admin/practice/topics" className="practice-problem-card">
          <h3>DSA Topics</h3>
          <p className="practice-meta-muted">Manage topic taxonomy for skill matrix</p>
        </Link>
        <Link to="/super-admin/practice/questions" className="practice-problem-card">
          <h3>Practice Questions</h3>
          <p className="practice-meta-muted">Enable global questions in the practice bank</p>
        </Link>
        <Link to="/super-admin/global-questions" className="practice-problem-card">
          <h3>Global Question Bank</h3>
          <p className="practice-meta-muted">Create and edit coding questions</p>
        </Link>
      </div>
    </VendorHubPage>
  );
};

export default PracticeAdminHub;
