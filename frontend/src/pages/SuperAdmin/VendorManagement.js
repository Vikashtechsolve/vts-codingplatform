import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { FiPlus, FiCreditCard, FiRefreshCw, FiTrash2, FiPower, FiEdit2 } from 'react-icons/fi';
import axiosInstance from '../../utils/axios';
import VendorHubPage from '../../components/VendorAdmin/VendorHubPage';
import { SUPER_ADMIN_ACCENT } from '../../constants/superAdminSections';
import '../../styles/super-admin-pages.css';

const getInitials = (name) => {
  if (!name) return '?';
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
};

const VendorManagement = () => {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    companyName: '',
    subscriptionPlan: 'free',
  });

  useEffect(() => {
    fetchVendors();
  }, []);

  const fetchVendors = async () => {
    try {
      setLoading(true);
      const response = await axiosInstance.get('/super-admin/vendors');
      setVendors(response.data || []);
    } catch (err) {
      console.error('Error fetching vendors:', err);
    } finally {
      setLoading(false);
    }
  };

  const stats = useMemo(() => {
    const active = vendors.filter((v) => v.isActive !== false).length;
    return { total: vendors.length, active, inactive: vendors.length - active };
  }, [vendors]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSubmitting(true);

    const trimmedData = {
      name: formData.name.trim(),
      email: formData.email.trim(),
      companyName: formData.companyName.trim(),
      subscriptionPlan: formData.subscriptionPlan,
    };

    if (!trimmedData.name || !trimmedData.email || !trimmedData.companyName) {
      setError('Name, email, and company name are required.');
      setSubmitting(false);
      return;
    }

    try {
      const response = await axiosInstance.post('/super-admin/vendors', trimmedData);
      const successMsg = `Vendor created successfully.\n\nAdmin credentials:\nEmail: ${response.data.adminUser.email}\nPassword: ${response.data.adminUser.password}\n\nSave these credentials — they won't be shown again.`;
      setSuccess(successMsg);
      setTimeout(() => {
        setShowForm(false);
        setFormData({ name: '', email: '', companyName: '', subscriptionPlan: 'free' });
        setSuccess('');
        fetchVendors();
      }, 4000);
    } catch (err) {
      if (err.response?.data?.errors?.length) {
        const validationErrors = err.response.data.errors
          .map((item) => `${item.param || 'Field'}: ${item.msg || item.message}`)
          .join('\n');
        setError(validationErrors);
      } else {
        setError(err.response?.data?.message || 'Error creating vendor.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this vendor permanently?')) return;
    try {
      await axiosInstance.delete(`/super-admin/vendors/${id}`);
      fetchVendors();
    } catch (err) {
      alert(err.response?.data?.message || 'Error deleting vendor');
    }
  };

  const handleToggleActive = async (vendor) => {
    try {
      await axiosInstance.put(`/super-admin/vendors/${vendor._id}`, {
        isActive: !vendor.isActive,
      });
      fetchVendors();
    } catch (err) {
      alert(err.response?.data?.message || 'Error updating vendor');
    }
  };

  return (
    <VendorHubPage
      className="sa-page"
      loading={loading}
      eyebrow="Organizations"
      title="Vendors"
      subtitle="Create vendor accounts, manage subscriptions, and control platform access."
      accent={SUPER_ADMIN_ACCENT}
      actions={
        <>
          <Link to="/super-admin/interview-credits" className="vh-btn vh-btn--ghost">
            <FiCreditCard /> Credits
          </Link>
          <button
            type="button"
            className="vh-btn vh-btn--ghost"
            onClick={fetchVendors}
          >
            <FiRefreshCw /> Refresh
          </button>
          <button
            type="button"
            className="vh-btn vh-btn--primary"
            onClick={() => setShowForm((v) => !v)}
          >
            <FiPlus /> {showForm ? 'Cancel' : 'Create vendor'}
          </button>
        </>
      }
    >
      <div className="vh-stats">
        <div className="vh-stat vh-stat--accent">
          <span className="vh-stat-label">Total vendors</span>
          <span className="vh-stat-value">{stats.total}</span>
        </div>
        <div className="vh-stat">
          <span className="vh-stat-label">Active</span>
          <span className="vh-stat-value">{stats.active}</span>
        </div>
        <div className="vh-stat">
          <span className="vh-stat-label">Inactive</span>
          <span className="vh-stat-value">{stats.inactive}</span>
        </div>
      </div>

      {showForm && (
        <div className="vh-panel" style={{ marginBottom: '18px' }}>
          <div className="vh-panel-head">
            <div>
              <h2 className="vh-panel-title">Create new vendor</h2>
              <p className="vh-panel-desc">
                A vendor admin account is created automatically with a temporary password.
              </p>
            </div>
          </div>
          <div className="vh-panel-body">
            {error && <div className="vh-alert vh-alert--error" style={{ whiteSpace: 'pre-line' }}>{error}</div>}
            {success && <div className="vh-alert vh-alert--success" style={{ whiteSpace: 'pre-line' }}>{success}</div>}
            <form onSubmit={handleSubmit} className="vh-form-panel">
              <div className="vh-form-grid">
                <div className="vh-field">
                  <label htmlFor="vendor-name">Admin name</label>
                  <input
                    id="vendor-name"
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="vh-field">
                  <label htmlFor="vendor-email">Admin email</label>
                  <input
                    id="vendor-email"
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="vh-field">
                  <label htmlFor="vendor-company">Company name</label>
                  <input
                    id="vendor-company"
                    type="text"
                    name="companyName"
                    value={formData.companyName}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="vh-field">
                  <label htmlFor="vendor-plan">Subscription plan</label>
                  <select
                    id="vendor-plan"
                    name="subscriptionPlan"
                    value={formData.subscriptionPlan}
                    onChange={handleChange}
                  >
                    <option value="free">Free</option>
                    <option value="basic">Basic</option>
                    <option value="premium">Premium</option>
                  </select>
                </div>
              </div>
              <div className="vh-form-actions">
                <button type="submit" className="vh-btn vh-btn--primary" disabled={submitting}>
                  {submitting ? 'Creating…' : 'Create vendor'}
                </button>
                <button type="button" className="vh-btn vh-btn--secondary" onClick={() => setShowForm(false)}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="vh-panel">
        <div className="vh-panel-head">
          <div>
            <h2 className="vh-panel-title">All vendors</h2>
            <p className="vh-panel-desc">{vendors.length} organization{vendors.length !== 1 ? 's' : ''} on the platform.</p>
          </div>
        </div>
        <div className="vh-panel-body vh-panel-body--flush">
          {vendors.length === 0 ? (
            <div className="vh-empty">
              <div className="vh-empty-icon">🏢</div>
              <h2>No vendors yet</h2>
              <p>Create your first vendor organization to get started.</p>
              <button type="button" className="vh-btn vh-btn--primary" onClick={() => setShowForm(true)}>
                <FiPlus /> Create vendor
              </button>
            </div>
          ) : (
            <div className="vh-table-wrap">
              <table className="vh-table">
                <thead>
                  <tr>
                    <th>Company</th>
                    <th>Email</th>
                    <th>Plan</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {vendors.map((vendor) => (
                    <tr key={vendor._id}>
                      <td>
                        <div className="vh-person">
                          <span className="vh-avatar" style={{ background: '#2563eb' }}>
                            {getInitials(vendor.companyName)}
                          </span>
                          <div>
                            <Link
                              to={`/super-admin/vendors/${vendor._id}/edit`}
                              className="vh-person-name sa-vendor-link"
                            >
                              {vendor.companyName}
                            </Link>
                            <div className="vh-person-email">{vendor.name || '—'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="vh-cell-muted">{vendor.email}</td>
                      <td>
                        <span className={`vh-badge sa-plan-badge sa-plan-badge--${vendor.subscriptionPlan || 'free'}`}>
                          {vendor.subscriptionPlan || 'free'}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`vh-badge ${
                            vendor.isActive !== false ? 'vh-badge--active' : 'vh-badge--inactive'
                          }`}
                        >
                          {vendor.isActive !== false ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>
                        <div className="sa-cell-actions">
                          <Link
                            to={`/super-admin/vendors/${vendor._id}/edit`}
                            className="vh-btn vh-btn--ghost vh-btn--sm"
                          >
                            <FiEdit2 /> Edit
                          </Link>
                          <button
                            type="button"
                            className="vh-btn vh-btn--ghost vh-btn--sm"
                            onClick={() => handleToggleActive(vendor)}
                          >
                            <FiPower /> {vendor.isActive !== false ? 'Deactivate' : 'Activate'}
                          </button>
                          <button
                            type="button"
                            className="vh-btn vh-btn--ghost vh-btn--sm"
                            onClick={() => handleDelete(vendor._id)}
                            style={{ color: '#dc2626' }}
                          >
                            <FiTrash2 /> Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </VendorHubPage>
  );
};

export default VendorManagement;
