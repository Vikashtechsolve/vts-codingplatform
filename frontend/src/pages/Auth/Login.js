import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { getMixedContentApiWarning } from '../../config/apiBase';
import {
  FiCode,
  FiCpu,
  FiLayers,
  FiAward,
  FiMail,
  FiLock,
  FiEye,
  FiEyeOff,
  FiSun,
  FiMoon,
} from 'react-icons/fi';
import './Auth.css';
import { APP_NAME } from '../../constants/branding';
import './Login.css';

const FEATURES = [
  { icon: FiCode, label: 'Coding challenges' },
  { icon: FiCpu, label: 'Live assessments' },
  { icon: FiLayers, label: 'MCQ & aptitude' },
  { icon: FiAward, label: 'Track your progress' },
];

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [configWarning, setConfigWarning] = useState(null);
  const { login, user, loading: authLoading } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get('redirect');
  const resetSuccessMessage = location.state?.resetSuccess;
  const loginStateMessage = location.state?.message;

  const navigateAfterAuth = (role) => {
    if (redirectTo && redirectTo.startsWith('/') && role === 'student') {
      navigate(redirectTo, { replace: true });
      return;
    }
    if (role === 'super_admin') navigate('/super-admin/dashboard', { replace: true });
    else if (role === 'vendor_admin') navigate('/vendor-admin/dashboard', { replace: true });
    else if (role === 'student') navigate('/student/dashboard', { replace: true });
    else navigate('/login', { replace: true });
  };

  useEffect(() => {
    setConfigWarning(getMixedContentApiWarning());
  }, []);

  useEffect(() => {
    if (!authLoading && user) {
      navigateAfterAuth(user.role);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- redirect only on auth resolve
  }, [user, authLoading]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await login(email, password);

    if (result.success) {
      const loggedIn = JSON.parse(localStorage.getItem('user') || '{}');
      navigateAfterAuth(loggedIn.role);
    } else {
      setError(result.message);
    }

    setLoading(false);
  };

  if (authLoading) {
    return (
      <div className="login-loading-screen">
        <div className="login-loading-card">
          <div className="loading">Loading…</div>
        </div>
      </div>
    );
  }

  if (user) {
    return null;
  }

  return (
    <div className="login-page">
      <aside className="login-hero" aria-hidden="false">
        <div className="login-hero-bg" />
        <div className="login-hero-grid" />
        <div className="login-hero-glow" />
        <div className="login-hero-glow-accent" />

        <div className="login-hero-content">
          <div className="login-brand">
            <span className="login-brand-icon" aria-hidden="true">
              <FiCode />
            </span>
            {APP_NAME}
          </div>

          <h1>
            Code smarter.
            <br />
            <span>Perform better.</span>
          </h1>
          <p className="login-hero-tagline">
            Practice coding, take timed tests, and track your skills — all in one place built for students and teams.
          </p>

          <div className="login-features">
            {FEATURES.map(({ icon: Icon, label }) => (
              <div key={label} className="login-feature">
                <span className="login-feature-icon">
                  <Icon />
                </span>
                {label}
              </div>
            ))}
          </div>

          <div className="login-code-preview">
            <div className="login-code-header">
              <span className="login-code-dot red" />
              <span className="login-code-dot yellow" />
              <span className="login-code-dot green" />
              <span>solution.js</span>
            </div>
            <pre className="login-code-body">
              <code>
                <span className="kw">function</span> <span className="fn">solve</span>(nums) {'{'}
                {'\n'}  <span className="kw">let</span> sum = <span className="num">0</span>;
                {'\n'}  <span className="kw">for</span> (<span className="kw">const</span> n <span className="kw">of</span> nums)
                {'\n'}    sum += n;
                {'\n'}  <span className="kw">return</span> sum;
                {'\n'}
                {'}'}
                {'\n'}
                <span className="cm">{'// Ready for your next challenge ✓'}</span>
              </code>
            </pre>
          </div>
        </div>
      </aside>

      <main className="login-panel">
        <button
          type="button"
          className="login-theme-toggle"
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? <FiSun /> : <FiMoon />}
        </button>

        <div className="login-panel-inner">
          <div className="login-form-card">
          <header className="login-panel-header">
            <h2>Welcome back</h2>
            <p>Sign in to continue to your dashboard</p>
          </header>

          {loginStateMessage && (
            <div className="login-alert login-alert-warn" role="alert">
              {loginStateMessage}
            </div>
          )}

          {configWarning && (
            <div className="login-alert login-alert-warn" role="alert">
              {configWarning}
            </div>
          )}

          {resetSuccessMessage && (
            <div className="login-alert login-alert-success" role="status">
              {resetSuccessMessage}
            </div>
          )}

          {error && (
            <div className="login-alert login-alert-error" role="alert">
              {error}
            </div>
          )}

          <form className="login-form" onSubmit={handleSubmit} noValidate>
            <div className="login-field">
              <label htmlFor="login-email">Email address</label>
              <div className="login-input-box">
                <span className="login-input-affix" aria-hidden="true">
                  <FiMail />
                </span>
                <input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  placeholder="you@example.com"
                  disabled={loading}
                />
              </div>
            </div>

            <div className="login-field">
              <label htmlFor="login-password">Password</label>
              <div className="login-input-box">
                <span className="login-input-affix" aria-hidden="true">
                  <FiLock />
                </span>
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  disabled={loading}
                />
                <span className="login-input-suffix">
                  <button
                    type="button"
                    className="login-password-toggle"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    tabIndex={-1}
                  >
                    {showPassword ? <FiEyeOff /> : <FiEye />}
                  </button>
                </span>
              </div>
            </div>

            <div className="login-forgot-row">
              <Link to="/forgot-password" className="login-forgot-link">
                Forgot password?
              </Link>
            </div>

            <button type="submit" className="login-submit" disabled={loading}>
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
          </div>

          <p className="login-panel-footer">
            Secure login · Your data is encrypted in transit
          </p>
        </div>
      </main>
    </div>
  );
};

export default Login;
