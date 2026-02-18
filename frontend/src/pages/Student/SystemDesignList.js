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

const CATEGORY_ICONS = {
  url_shortener: '🔗', chat_system: '💬', ecommerce: '🛒', social_media: '📱',
  streaming: '🎬', payment_system: '💳', notification_system: '🔔', file_storage: '📁',
  search_engine: '🔍', rate_limiter: '⚡', ride_sharing: '🚗', food_delivery: '🍔',
  library_management: '📚', parking_lot: '🅿️', hotel_booking: '🏨', custom: '⚙️'
};

const SystemDesignList = () => {
  const navigate = useNavigate();
  const [problems, setProblems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => { fetchProblems(); }, []);

  const fetchProblems = async () => {
    try {
      setLoading(true);
      const { data } = await axiosInstance.get('/system-design-problems/student-list');
      if (data.success) setProblems(data.problems);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusInfo = (sub) => {
    if (!sub) return { label: 'Not Started', color: '#95a5a6', action: 'Start Design' };
    switch (sub.status) {
      case 'in_progress': return { label: 'In Progress', color: '#f39c12', action: 'Continue' };
      case 'submitted': return { label: 'Submitted', color: '#3498db', action: 'View' };
      case 'evaluating': return { label: 'Evaluating...', color: '#9b59b6', action: 'View' };
      case 'follow_up': return { label: 'Follow-up Required', color: '#e91e63', action: 'Answer Questions' };
      case 'evaluated': return { label: 'Evaluated', color: '#27ae60', action: 'View Results' };
      default: return { label: sub.status, color: '#95a5a6', action: 'View' };
    }
  };

  const getDifficultyColor = (d) => d === 'easy' ? '#27ae60' : d === 'medium' ? '#f39c12' : '#e74c3c';

  const handleAction = (problem) => {
    const sub = problem.submission;
    if (!sub || sub.status === 'not_started') {
      navigate(`/student/system-design/${problem._id}`);
    } else if (sub.status === 'in_progress') {
      navigate(`/student/system-design/${problem._id}`);
    } else if (sub.status === 'follow_up') {
      navigate(`/student/system-design/${sub._id}/follow-up`);
    } else if (sub.status === 'evaluated') {
      navigate(`/student/system-design-result/${sub._id}`);
    } else {
      navigate(`/student/system-design-result/${sub._id}`);
    }
  };

  const filtered = problems.filter(p => {
    if (filter === 'all') return true;
    if (filter === 'pending') return !p.submission || p.submission.status === 'not_started';
    if (filter === 'active') return p.submission && ['in_progress', 'follow_up'].includes(p.submission.status);
    if (filter === 'completed') return p.submission && ['submitted', 'evaluating', 'evaluated'].includes(p.submission.status);
    return true;
  });

  if (loading) return <div className="sds-container"><div className="sds-loading">Loading system design problems...</div></div>;

  return (
    <div className="sds-container">
      <div className="sds-header">
        <div>
          <h1 className="sds-title">System Design Challenges</h1>
          <p className="sds-subtitle">Design real-world systems and get AI-powered feedback</p>
        </div>
        <div className="sds-filter-tabs">
          {['all', 'pending', 'active', 'completed'].map(f => (
            <button key={f} className={`sds-filter-tab ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
              {f.charAt(0).toUpperCase() + f.slice(1)} ({f === 'all' ? problems.length : problems.filter(p => {
                if (f === 'pending') return !p.submission || p.submission.status === 'not_started';
                if (f === 'active') return p.submission && ['in_progress', 'follow_up'].includes(p.submission.status);
                if (f === 'completed') return p.submission && ['submitted', 'evaluating', 'evaluated'].includes(p.submission.status);
                return true;
              }).length})
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="sds-empty">
          <div className="sds-empty-icon">🏗️</div>
          <h2>No system design problems found</h2>
          <p>Check back later or contact your instructor.</p>
        </div>
      ) : (
        <div className="sds-grid">
          {filtered.map(p => {
            const statusInfo = getStatusInfo(p.submission);
            return (
              <div key={p._id} className="sds-card" onClick={() => handleAction(p)}>
                <div className="sds-card-top">
                  <span className="sds-card-icon">{CATEGORY_ICONS[p.category] || '⚙️'}</span>
                  <div className="sds-card-badges">
                    <span className="sds-difficulty-badge" style={{ background: getDifficultyColor(p.difficulty) }}>
                      {p.difficulty}
                    </span>
                  </div>
                </div>
                <h3 className="sds-card-title">{p.title}</h3>
                <p className="sds-card-category">{CATEGORY_LABELS[p.category] || p.category}</p>

                <div className="sds-card-info">
                  <span>⏱️ {p.duration} min</span>
                  {p.constraints?.estimatedUsers && <span>👥 {p.constraints.estimatedUsers}</span>}
                </div>

                <div className="sds-card-bottom">
                  <span className="sds-status-badge" style={{ background: statusInfo.color }}>
                    {statusInfo.label}
                  </span>
                  {p.submission?.status === 'evaluated' && (
                    <span className="sds-score">{p.submission.percentage}%</span>
                  )}
                </div>

                <button className="sds-action-btn" style={{ borderColor: statusInfo.color, color: statusInfo.color }}>
                  {statusInfo.action} →
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default SystemDesignList;
