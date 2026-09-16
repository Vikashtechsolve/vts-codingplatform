import React from 'react';
import { Link } from 'react-router-dom';
import {
  FiTarget,
  FiGrid,
  FiBarChart2,
  FiAward,
  FiList,
  FiHome,
} from 'react-icons/fi';

const TABS = [
  { path: '/student/practice', label: 'Overview', id: 'hub', icon: FiHome },
  { path: '/student/practice/problems', label: 'Problems', id: 'problems', icon: FiList },
  { path: '/student/practice/analytics', label: 'Analytics', id: 'analytics', icon: FiBarChart2 },
  { path: '/student/practice/skill-matrix', label: 'Skills', id: 'skill-matrix', icon: FiGrid },
  { path: '/student/practice/leaderboard', label: 'Rankings', id: 'leaderboard', icon: FiAward },
  { path: '/student/practice/submissions', label: 'History', id: 'submissions', icon: FiTarget },
];

const PracticeNav = ({ active }) => (
  <nav className="practice-nav" aria-label="Practice sections">
    <div className="practice-nav-scroll">
      {TABS.map((tab) => {
        const Icon = tab.icon;
        return (
          <Link
            key={tab.id}
            to={tab.path}
            className={`practice-nav-tab ${active === tab.id ? 'is-active' : ''}`}
          >
            <Icon className="practice-nav-tab-icon" aria-hidden />
            <span>{tab.label}</span>
          </Link>
        );
      })}
    </div>
  </nav>
);

export default PracticeNav;
