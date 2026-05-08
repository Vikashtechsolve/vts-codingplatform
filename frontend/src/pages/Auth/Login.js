import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getMixedContentApiWarning, getAxiosBaseURL } from '../../config/apiBase';
import './Auth.css';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [configWarning, setConfigWarning] = useState(null);
  const [apiHealth, setApiHealth] = useState({ state: 'checking', detail: '' });
  const { login, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    setConfigWarning(getMixedContentApiWarning());

    let cancelled = false;
    (async () => {
      const base = getAxiosBaseURL();
      if (!base) {
        if (!cancelled) setApiHealth({ state: 'down', detail: 'API URL not configured.' });
        return;
      }
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      try {
        const res = await fetch(`${base}/health`, { cache: 'no-store', signal: controller.signal });
        clearTimeout(timer);
        if (cancelled) return;
        if (res.ok) setApiHealth({ state: 'up', detail: `${base} (HTTP ${res.status})` });
        else setApiHealth({ state: 'degraded', detail: `${base} (HTTP ${res.status})` });
      } catch (e) {
        clearTimeout(timer);
        if (cancelled) return;
        setApiHealth({ state: 'down', detail: e?.message || 'Failed to reach API' });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Redirect if already logged in
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await login(email, password);

    if (result.success) {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      if (user.role === 'super_admin') {
        navigate('/super-admin/dashboard');
      } else if (user.role === 'vendor_admin') {
        navigate('/vendor-admin/dashboard');
      } else if (user.role === 'student') {
        navigate('/student/dashboard');
      } else {
        navigate('/login');
      }
    } else {
      setError(result.message);
    }

    setLoading(false);
  };

  // Show loading while checking authentication
  if (authLoading) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <div className="loading">Loading...</div>
        </div>
      </div>
    );
  }

  // Don't render login form if already logged in (will redirect)
  if (user) {
    return null;
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1 className="auth-title gradient-text">Login</h1>
        {configWarning && <div className="error">{configWarning}</div>}
        {apiHealth.state !== 'up' && (
          <div className="error" style={{ background: apiHealth.state === 'checking' ? '#eef' : undefined }}>
            {apiHealth.state === 'checking' && 'Checking API connectivity…'}
            {apiHealth.state === 'down' &&
              `Cannot reach API: ${apiHealth.detail}. `}
            {apiHealth.state === 'degraded' && `API responded with an error: ${apiHealth.detail}. `}
            {apiHealth.state !== 'checking' && (
              <Link to="/diagnostics" style={{ marginLeft: 6 }}>
                Open diagnostics
              </Link>
            )}
          </div>
        )}
        {error && <div className="error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="Enter your email"
            />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Enter your password"
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;

