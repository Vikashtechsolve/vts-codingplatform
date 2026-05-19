import React from 'react';
import { FiCheckCircle, FiClock, FiTarget, FiAlertCircle, FiTrendingUp, FiList } from 'react-icons/fi';

const StatCard = ({ icon: Icon, label, value, sub, accent }) => (
  <div className="section-stat-card">
    <span className="section-stat-icon" style={{ '--stat-accent': accent }}>
      <Icon />
    </span>
    <div>
      <p className="section-stat-label">{label}</p>
      <p className="section-stat-value">{value}</p>
      {sub && <p className="section-stat-sub">{sub}</p>}
    </div>
  </div>
);

const SectionDetailStats = ({ stats, sectionAccent }) => (
  <div className="section-stats-grid">
    <StatCard icon={FiList} label="Total assigned" value={stats.total} accent={sectionAccent} />
    <StatCard
      icon={FiCheckCircle}
      label="Completed"
      value={stats.completed}
      sub={stats.total > 0 ? `${stats.completionRate}% done` : null}
      accent="#059669"
    />
    <StatCard icon={FiClock} label="In progress" value={stats.inProgress} accent="#d97706" />
    <StatCard icon={FiTarget} label="To do" value={stats.todo} accent="#2563eb" />
    {stats.pending > 0 && (
      <StatCard icon={FiTrendingUp} label="Under review" value={stats.pending} accent="#7c3aed" />
    )}
    {stats.overdue > 0 && (
      <StatCard icon={FiAlertCircle} label="Overdue" value={stats.overdue} accent="#dc2626" />
    )}
    {stats.avgScore != null && (
      <StatCard
        icon={FiTrendingUp}
        label="Average score"
        value={`${stats.avgScore}%`}
        sub={`from ${stats.scoredCount} scored`}
        accent={sectionAccent}
      />
    )}
  </div>
);

export default SectionDetailStats;
