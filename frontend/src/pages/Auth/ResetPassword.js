import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import axiosInstance from '../../utils/axios';
import { formatAuthRequestError } from '../../utils/authErrors';
import './Auth.css';

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const navigate = useNavigate();

  const [verifyState, setVerifyState] = useState('loading');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) {
      setVerifyState('invalid');
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const { data } = await axiosInstance.get('/auth/reset-password/verify', {
          params: { token },
        });
        if (cancelled) return;
        if (data.valid) {
          setMaskedEmail(data.email || '');
          setVerifyState('valid');
        } else {
          setVerifyState('invalid');
        }
      } catch (err) {
        if (cancelled) return;
        setVerifyState('invalid');
        if (err.response?.data?.message) {
          setError(err.response.data.message);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const { data } = await axiosInstance.post('/auth/reset-password', { token, password });
      navigate('/login', {
        replace: true,
        state: { resetSuccess: data.message },
      });
    } catch (err) {
      if (err.response?.status === 429) {
        setError(err.response.data?.message || 'Too many attempts. Please try again later.');
      } else {
        setError(formatAuthRequestError(err, 'Could not reset password. Please try again.'));
      }
    } finally {
      setLoading(false);
    }
  };

  if (verifyState === 'loading') {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <div className="loading">Verifying reset link…</div>
        </div>
      </div>
    );
  }

  if (verifyState === 'invalid') {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <h1 className="auth-title">Link expired</h1>
          <p className="auth-subtitle">
            {error || 'This password reset link is invalid or has expired. Request a new link to continue.'}
          </p>
          <p className="auth-footer-link">
            <Link to="/forgot-password">Request a new reset link</Link>
          </p>
          <p className="auth-footer-link">
            <Link to="/login">← Back to sign in</Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1 className="auth-title">Set new password</h1>
        <p className="auth-subtitle">
          {maskedEmail
            ? `Choose a new password for ${maskedEmail}.`
            : 'Choose a strong password for your account.'}
        </p>

        {error && <div className="error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="reset-password">New password</label>
            <input
              id="reset-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
              placeholder="At least 6 characters"
              disabled={loading}
            />
          </div>
          <div className="form-group">
            <label htmlFor="reset-confirm">Confirm password</label>
            <input
              id="reset-confirm"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
              placeholder="Re-enter your password"
              disabled={loading}
            />
          </div>
          <button type="submit" className="btn btn-primary auth-submit-btn" disabled={loading}>
            {loading ? 'Updating…' : 'Update password'}
          </button>
        </form>

        <p className="auth-footer-link">
          <Link to="/login">← Back to sign in</Link>
        </p>
      </div>
    </div>
  );
};

export default ResetPassword;
