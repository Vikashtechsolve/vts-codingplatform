import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axiosInstance from '../../utils/axios';
import './SystemDesignList.css';

const CATEGORY_LABELS = {
  url_shortener: 'URL Shortener', chat_system: 'Chat System', ecommerce: 'E-Commerce',
  social_media: 'Social Media', streaming: 'Streaming', payment_system: 'Payment System',
  notification_system: 'Notifications', file_storage: 'File Storage', search_engine: 'Search Engine',
  rate_limiter: 'Rate Limiter', ride_sharing: 'Ride Sharing', food_delivery: 'Food Delivery',
  library_management: 'Library Mgmt', parking_lot: 'Parking Lot', hotel_booking: 'Hotel Booking', custom: 'Custom'
};

const SystemDesignList = () => {
  const navigate = useNavigate();
  const [problems, setProblems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterDifficulty, setFilterDifficulty] = useState('all');

  useEffect(() => { fetchProblems(); }, []);

  const fetchProblems = async () => {
    try {
      setLoading(true);
      const { data } = await axiosInstance.get('/system-design-problems');
      if (data.success) setProblems(data.problems);
      else setError(data.message);
    } catch (err) {
      setError('Failed to fetch system design problems');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this problem and all submissions? This cannot be undone.')) return;
    try {
      const { data } = await axiosInstance.delete(`/system-design-problems/${id}`);
      if (data.success) fetchProblems();
      else alert(data.message);
    } catch (err) {
      alert('Failed to delete');
    }
  };

  const filtered = problems.filter(p => {
    if (filterCategory !== 'all' && p.category !== filterCategory) return false;
    if (filterDifficulty !== 'all' && p.difficulty !== filterDifficulty) return false;
    return true;
  });

  const getDifficultyColor = (d) => d === 'easy' ? '#4caf50' : d === 'medium' ? '#ff9800' : '#f44336';

  if (loading) return <div className="sd-list-container"><div className="loading">Loading...</div></div>;

  return (
    <div className="sd-list-container">
      <div className="sd-list-header">
        <h1>System Design Problems</h1>
        <button className="sd-create-btn" onClick={() => navigate('/vendor-admin/system-designs/create')}>
          + Create Problem
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="sd-filters">
        <div className="filter-group">
          <label>Category:</label>
          <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
            <option value="all">All Categories</option>
            {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div className="filter-group">
          <label>Difficulty:</label>
          <select value={filterDifficulty} onChange={e => setFilterDifficulty(e.target.value)}>
            <option value="all">All</option>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="sd-empty">
          <p>No system design problems found.</p>
          <button onClick={() => navigate('/vendor-admin/system-designs/create')}>Create Your First Problem</button>
        </div>
      ) : (
        <div className="sd-grid">
          {filtered.map(p => (
            <div key={p._id} className="sd-card">
              <div className="sd-card-header">
                <h3>{p.title}</h3>
                <div className="sd-card-badges">
                  <span className="sd-badge difficulty" style={{ background: getDifficultyColor(p.difficulty) }}>
                    {p.difficulty}
                  </span>
                  <span className="sd-badge category">{CATEGORY_LABELS[p.category] || p.category}</span>
                </div>
              </div>

              <p className="sd-card-desc">{p.problemStatement?.replace(/<[^>]*>/g, '').substring(0, 150)}...</p>

              <div className="sd-card-meta">
                <span>Duration: {p.duration} min</span>
                <span className={`sd-active-badge ${p.isActive ? 'active' : 'inactive'}`}>
                  {p.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>

              <div className="sd-card-stats">
                <div className="sd-stat"><span className="sd-stat-val">{p.totalAssigned || 0}</span><span className="sd-stat-label">Assigned</span></div>
                <div className="sd-stat"><span className="sd-stat-val">{p.totalSubmitted || 0}</span><span className="sd-stat-label">Submitted</span></div>
                <div className="sd-stat"><span className="sd-stat-val">{p.totalEvaluated || 0}</span><span className="sd-stat-label">Evaluated</span></div>
              </div>

              <div className="sd-card-actions">
                <button className="sd-action-btn edit" onClick={() => navigate(`/vendor-admin/system-designs/${p._id}/edit`)}>Edit</button>
                <button className="sd-action-btn assign" onClick={() => navigate(`/vendor-admin/system-designs/${p._id}/assign`)}>Assign</button>
                <button className="sd-action-btn subs" onClick={() => navigate(`/vendor-admin/system-designs/${p._id}/submissions`)}>Submissions</button>
                <button className="sd-action-btn delete" onClick={() => handleDelete(p._id)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SystemDesignList;
