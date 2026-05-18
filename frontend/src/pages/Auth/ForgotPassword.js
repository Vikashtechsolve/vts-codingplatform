import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import axiosInstance from '../../utils/axios';
import { formatAuthRequestError } from '../../utils/authErrors';
import './Auth.css';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const { data } = await axiosInstance.post('/auth/forgot-password', { email });
      setSuccess(data.message);
      setEmail('');
    } catch (err) {
      if (err.response?.status === 429) {
        setError(err.response.data?.message || 'Too many attempts. Please try again later.');
      } else {
        setError(formatAuthRequestError(err, 'Something went wrong. Please try again.'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1 className="auth-title">Forgot password</h1>
        <p className="auth-subtitle">
          Enter the email address for your account. We&apos;ll send you a link to reset your password.
        </p>

        {error && <div className="error">{error}</div>}
        {success && <div className="auth-success">{success}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="forgot-email">Email</label>
            <input
              id="forgot-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="you@example.com"
              disabled={loading}
            />
          </div>
          <button type="submit" className="btn btn-primary auth-submit-btn" disabled={loading}>
            {loading ? 'Sending…' : 'Send reset link'}
          </button>
        </form>

        <p className="auth-footer-link">
          <Link to="/login">← Back to sign in</Link>
        </p>
      </div>
    </div>
  );
};

export default ForgotPassword;
