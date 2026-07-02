import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useVendorBranding } from '../../context/VendorBrandingContext';
import { resolveMediaUrl } from '../../utils/mediaUrl';
import { getBrandingFromUser, getUserVendorId } from '../../utils/user';
import { getCachedBranding } from '../../utils/brandingCache';
import { APP_NAME } from '../../constants/branding';
import { FiSun, FiMoon, FiLogOut, FiUser } from 'react-icons/fi';
import AnnouncementBell from '../Announcements/AnnouncementBell';
import { useExamLock } from '../../context/ExamLockContext';
import './Navbar.css';

const AUTH_PATHS = ['/login', '/register', '/forgot-password', '/reset-password'];

const isJoinPath = (pathname) => pathname.startsWith('/join/');

const Navbar = () => {
  const location = useLocation();
  const { user, logout, isAuthenticated } = useAuth();
  const { branding } = useVendorBranding();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const { isExamLocked, reportNavigationAttempt } = useExamLock();
  const hideNavbar =
    AUTH_PATHS.includes(location.pathname) || isJoinPath(location.pathname);

  if (hideNavbar) {
    return null;
  }

  const handleLogout = () => {
    if (isExamLocked) {
      reportNavigationAttempt();
      return;
    }
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
      return <span className="gradient-text">{APP_NAME}</span>;
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
    return <span className="gradient-text">{APP_NAME}</span>;
  };

  const handleBrandClick = (e) => {
    if (!isExamLocked) return;
    e.preventDefault();
    // Block leaving the exam via logo — not counted as a proctoring violation
  };

  const brandContent = renderBrand();
  const brandClassName = `navbar-brand${isExamLocked ? ' navbar-brand--exam-locked' : ''}`;

  return (
    <nav className={`navbar${user?.role === 'student' ? ' navbar-student' : ''}${user?.role === 'vendor_admin' ? ' navbar-vendor' : ''}${user?.role === 'super_admin' ? ' navbar-super-admin' : ''}`}>
      <div className="navbar-container">
        {isExamLocked ? (
          <button
            type="button"
            className={brandClassName}
            onClick={handleBrandClick}
            title="You cannot leave the exam until you submit"
          >
            {brandContent}
          </button>
        ) : (
          <Link to={getDashboardLink()} className={brandClassName}>
            {brandContent}
          </Link>
        )}

        <div className="navbar-menu">
          {isAuthenticated && user && (
            <>
              {user.role === 'student' && (
                <div className="navbar-student-actions">
                  <AnnouncementBell />
                </div>
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
