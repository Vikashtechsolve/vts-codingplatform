import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import './Auth.css';

const Register = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'student',
    vendorId: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

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

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await register(formData);

    if (result.success) {
      navigate('/student/dashboard');
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

  // Don't render register form if already logged in (will redirect)
  if (user) {
    return null;
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1 className="auth-title gradient-text">Register</h1>
        {error && <div className="error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Name</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              placeholder="Enter your name"
            />
          </div>
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              placeholder="Enter your email"
            />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
              minLength={6}
              placeholder="Enter your password (min 6 characters)"
            />
          </div>
          <div className="form-group">
            <label>Role</label>
            <select name="role" value={formData.role} onChange={handleChange}>
              <option value="student">Student</option>
              <option value="vendor_admin">Vendor Admin</option>
            </select>
          </div>
          {formData.role === 'student' || formData.role === 'vendor_admin' ? (
            <div className="form-group">
              <label>Vendor ID (if applicable)</label>
              <input
                type="text"
                name="vendorId"
                value={formData.vendorId}
                onChange={handleChange}
                placeholder="Enter vendor ID"
              />
            </div>
          ) : null}
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Registering...' : 'Register'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Register;

