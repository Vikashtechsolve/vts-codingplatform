import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useVendorBranding } from '../../context/VendorBrandingContext';
import { resolveMediaUrl } from '../../utils/mediaUrl';
import { getBrandingFromUser, getUserVendorId } from '../../utils/user';
import { getCachedBranding } from '../../utils/brandingCache';
import { FiSun, FiMoon, FiLogOut, FiUser } from 'react-icons/fi';
import './Navbar.css';

const AUTH_PATHS = ['/login', '/register', '/forgot-password', '/reset-password'];

const isJoinPath = (pathname) => pathname.startsWith('/join/');

const Navbar = () => {
  const location = useLocation();
  const { user, logout, isAuthenticated } = useAuth();
  const { branding } = useVendorBranding();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const hideNavbar =
    AUTH_PATHS.includes(location.pathname) || isJoinPath(location.pathname);

  if (hideNavbar) {
    return null;
  }

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

  const vendorId = getUserVendorId(user);
  const cached = vendorId ? getCachedBranding(vendorId) : null;
  const userBranding = getBrandingFromUser(user);
  const logoUrl =
    branding?.logo ||
    userBranding?.logo ||
    cached?.logo;
  const companyLabel =
    branding?.companyName ||
    userBranding?.companyName ||
    cached?.companyName;

  const renderBrand = () => {
    if (user?.role === 'super_admin') {
      return <span className="gradient-text">Coding Platform</span>;
    }
    if (logoUrl) {
      return (
        <span className="navbar-brand-logo" title={companyLabel || 'Home'}>
          <img
            src={resolveMediaUrl(logoUrl)}
            alt={companyLabel || 'Brand logo'}
            className="navbar-brand-logo-img"
          />
        </span>
      );
    }
    if (companyLabel) {
      return <span className="gradient-text navbar-brand-text">{companyLabel}</span>;
    }
    return <span className="gradient-text">Coding Platform</span>;
  };

  return (
    <nav className={`navbar${user?.role === 'student' ? ' navbar-student' : ''}`}>
      <div className="navbar-container">
        <Link to={getDashboardLink()} className="navbar-brand">
          {renderBrand()}
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

              <div className="navbar-user">
                <span className="user-name">
                  <FiUser /> {user.name}
                </span>
                <button onClick={toggleTheme} className="theme-toggle" type="button">
                  {theme === 'dark' ? <FiSun /> : <FiMoon />}
                </button>
                <button onClick={handleLogout} className="logout-btn" type="button">
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
