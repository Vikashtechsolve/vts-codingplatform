import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getMixedContentApiWarning } from '../../config/apiBase';
import './Auth.css';

const Register = () => {
  const [configWarning, setConfigWarning] = React.useState(null);
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    setConfigWarning(getMixedContentApiWarning());
  }, []);

  useEffect(() => {
    if (!authLoading && user) {
      if (user.role === 'super_admin') {
        navigate('/super-admin/dashboard', { replace: true });
      } else if (user.role === 'vendor_admin') {
        navigate('/vendor-admin/dashboard', { replace: true });
      } else if (user.role === 'student') {
        navigate('/student/dashboard', { replace: true });
      }
    }
  }, [user, authLoading, navigate]);

  if (authLoading) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <div className="loading">Loading...</div>
        </div>
      </div>
    );
  }

  if (user) {
    return null;
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1 className="auth-title gradient-text">Student registration</h1>
        {configWarning && <div className="error">{configWarning}</div>}
        <p className="auth-subtitle">
          Student self-registration is not available. Your organization must create your account, or you can register through a contest link.
        </p>
        <Link to="/login" className="btn btn-primary" style={{ display: 'block', textAlign: 'center', marginBottom: '0.75rem' }}>
          Sign in
        </Link>
        <p className="auth-footer-link" style={{ marginTop: 0 }}>
          Have a contest link? Open it directly to register for that event.
        </p>
      </div>
    </div>
  );
};

export default Register;
