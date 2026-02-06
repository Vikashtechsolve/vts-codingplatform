import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { FiSun, FiMoon, FiLogOut, FiUser } from 'react-icons/fi';
import './Navbar.css';

const Navbar = () => {
  const { user, logout, isAuthenticated } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [showStudentTestsMenu, setShowStudentTestsMenu] = useState(false);
  const dropdownRef = React.useRef(null);

  React.useEffect(() => {
    if (!showStudentTestsMenu) return;
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowStudentTestsMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showStudentTestsMenu]);

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
                  <Link to="/super-admin/interview-credits" className="navbar-link">Interview Credits</Link>
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
                  <div
                    ref={dropdownRef}
                    className="navbar-dropdown"
                    onMouseEnter={() => setShowStudentTestsMenu(true)}
                    onMouseLeave={() => setShowStudentTestsMenu(false)}
                  >
                    <button
                      type="button"
                      className="navbar-link navbar-link-button"
                      onClick={() => setShowStudentTestsMenu((prev) => !prev)}
                      aria-expanded={showStudentTestsMenu}
                      aria-haspopup="true"
                    >
                      Tests ▾
                    </button>
                    {showStudentTestsMenu && (
                      <div className="navbar-dropdown-menu">
                        <Link to="/student/tests/coding" className="navbar-dropdown-item" onClick={() => setShowStudentTestsMenu(false)}>Coding Tests</Link>
                        <Link to="/student/tests/aptitude" className="navbar-dropdown-item" onClick={() => setShowStudentTestsMenu(false)}>Aptitude Tests</Link>
                        <Link to="/student/tests/mcq" className="navbar-dropdown-item" onClick={() => setShowStudentTestsMenu(false)}>MCQ Tests</Link>
                        <Link to="/student/tests/mixed" className="navbar-dropdown-item" onClick={() => setShowStudentTestsMenu(false)}>Mixed Tests</Link>
                        <Link to="/student/tests/verbal" className="navbar-dropdown-item" onClick={() => setShowStudentTestsMenu(false)}>Verbal & English</Link>
                        <Link to="/student/tests/core" className="navbar-dropdown-item" onClick={() => setShowStudentTestsMenu(false)}>Core CS</Link>
                        <Link to="/student/tests/project" className="navbar-dropdown-item" onClick={() => setShowStudentTestsMenu(false)}>Project Evaluation</Link>
                        <Link to="/student/tests/interview" className="navbar-dropdown-item" onClick={() => setShowStudentTestsMenu(false)}>Interview</Link>
                        <Link to="/student/tests/system" className="navbar-dropdown-item" onClick={() => setShowStudentTestsMenu(false)}>System Design</Link>
                        <Link to="/student/tests/tools" className="navbar-dropdown-item" onClick={() => setShowStudentTestsMenu(false)}>Practical Tools</Link>
                        <Link to="/student/tests/company" className="navbar-dropdown-item" onClick={() => setShowStudentTestsMenu(false)}>Company Specific</Link>
                      </div>
                    )}
                  </div>
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

