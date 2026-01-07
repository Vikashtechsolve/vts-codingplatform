import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { FiSun, FiMoon, FiLogOut, FiUser } from 'react-icons/fi';
import './Navbar.css';

const Navbar = () => {
  const { user, logout, isAuthenticated } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getDashboardLink = () => {
    if (!user) return '/login';
    switch (user.role) {
      case 'super_admin':
        return '/super-admin/dashboard';
      case 'vendor_admin':
        return '/vendor-admin/dashboard';
      case 'student':
        return '/student/dashboard';
      default:
        return '/login';
    }
  };

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <Link to={getDashboardLink()} className="navbar-brand">
          <span className="gradient-text">Coding Platform</span>
        </Link>

        <div className="navbar-menu">
          {isAuthenticated && user && (
            <>
              {user.role === 'super_admin' && (
                <>
                  <Link to="/super-admin/dashboard" className="navbar-link">Dashboard</Link>
                  <Link to="/super-admin/vendors" className="navbar-link">Vendors</Link>
                </>
              )}

              {user.role === 'vendor_admin' && (
                <>
                  <Link to="/vendor-admin/dashboard" className="navbar-link">Dashboard</Link>
                  <Link to="/vendor-admin/tests" className="navbar-link">Tests</Link>
                  <Link to="/vendor-admin/questions" className="navbar-link">Questions</Link>
                  <Link to="/vendor-admin/students" className="navbar-link">Students</Link>
                  <Link to="/vendor-admin/classrooms" className="navbar-link">Classrooms</Link>
                  <Link to="/vendor-admin/analytics" className="navbar-link">Analytics</Link>
                  <Link to="/vendor-admin/settings" className="navbar-link">Settings</Link>
                </>
              )}

              {user.role === 'student' && (
                <>
                  <Link to="/student/dashboard" className="navbar-link">Dashboard</Link>
                </>
              )}

              <div className="navbar-user">
                <span className="user-name">
                  <FiUser /> {user.name}
                </span>
                <button onClick={toggleTheme} className="theme-toggle">
                  {theme === 'dark' ? <FiSun /> : <FiMoon />}
                </button>
                <button onClick={handleLogout} className="logout-btn">
                  <FiLogOut /> Logout
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;

