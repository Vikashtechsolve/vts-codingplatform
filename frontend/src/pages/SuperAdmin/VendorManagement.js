import React, { useState, useEffect } from 'react';
import axiosInstance from '../../utils/axios';
import './VendorManagement.css';

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
    subscriptionPlan: 'free'
  });

  useEffect(() => {
    fetchVendors();
  }, []);

  const fetchVendors = async () => {
    try {
      const response = await axiosInstance.get('/super-admin/vendors');
      setVendors(response.data);
    } catch (error) {
      console.error('Error fetching vendors:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSubmitting(true);

    // Trim all form data before submitting
    const trimmedData = {
      name: formData.name.trim(),
      email: formData.email.trim(),
      companyName: formData.companyName.trim(),
      subscriptionPlan: formData.subscriptionPlan
    };

    // Client-side validation
    if (!trimmedData.name) {
      setError('Name is required');
      setSubmitting(false);
      return;
    }
    if (!trimmedData.email) {
      setError('Email is required');
      setSubmitting(false);
      return;
    }
    if (!trimmedData.companyName) {
      setError('Company name is required');
      setSubmitting(false);
      return;
    }

    try {
      console.log('📤 Submitting vendor data:', trimmedData);
      const response = await axiosInstance.post('/super-admin/vendors', trimmedData);
      console.log('✅ Vendor created:', response.data);
      
      const successMsg = `Vendor created successfully!\n\nAdmin Credentials:\nEmail: ${response.data.adminUser.email}\nPassword: ${response.data.adminUser.password}\n\nPlease save these credentials!`;
      setSuccess(successMsg);
      
      // Auto-refresh vendor list
      setTimeout(() => {
        setShowForm(false);
        setFormData({ name: '', email: '', companyName: '', subscriptionPlan: 'free' });
        setSuccess('');
        fetchVendors();
      }, 3000);
    } catch (error) {
      console.error('❌ Error creating vendor:', error);
      console.error('Response:', error.response?.data);
      
      if (error.response?.data?.errors && Array.isArray(error.response.data.errors)) {
        // Validation errors
        const validationErrors = error.response.data.errors.map(err => {
          const field = err.param || err.field || 'Unknown';
          const message = err.msg || err.message || 'Invalid value';
          return `${field}: ${message}`;
        }).join('\n');
        setError(`Validation errors:\n${validationErrors}`);
      } else if (error.response?.data?.message) {
        setError(error.response.data.message);
      } else {
        setError('Error creating vendor. Please check the console for details.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this vendor?')) {
      try {
        await axiosInstance.delete(`/super-admin/vendors/${id}`);
        fetchVendors();
      } catch (error) {
        alert(error.response?.data?.message || 'Error deleting vendor');
      }
    }
  };

  const handleToggleActive = async (vendor) => {
    try {
      await axiosInstance.put(`/super-admin/vendors/${vendor._id}`, {
        isActive: !vendor.isActive
      });
      fetchVendors();
    } catch (error) {
      alert(error.response?.data?.message || 'Error updating vendor');
    }
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="container">
      <div className="page-header">
        <h1 className="page-title">Vendor Management</h1>
        <button onClick={() => setShowForm(!showForm)} className="btn btn-primary">
          {showForm ? 'Cancel' : 'Create Vendor'}
        </button>
      </div>

      {showForm && (
        <div className="card">
          <h2>Create New Vendor</h2>
          {error && (
            <div className="error" style={{ whiteSpace: 'pre-line', marginBottom: '20px' }}>
              {error}
            </div>
          )}
          {success && (
            <div className="success" style={{ whiteSpace: 'pre-line', marginBottom: '20px' }}>
              {success}
            </div>
          )}
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Name</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
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
              />
            </div>
            <div className="form-group">
              <label>Company Name</label>
              <input
                type="text"
                name="companyName"
                value={formData.companyName}
                onChange={handleChange}
                required
              />
            </div>
            <div className="form-group">
              <label>Subscription Plan</label>
              <select name="subscriptionPlan" value={formData.subscriptionPlan} onChange={handleChange}>
                <option value="free">Free</option>
                <option value="basic">Basic</option>
                <option value="premium">Premium</option>
              </select>
            </div>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Creating...' : 'Create Vendor'}
            </button>
          </form>
        </div>
      )}

      <div className="card">
        <h2>All Vendors</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Company Name</th>
              <th>Email</th>
              <th>Status</th>
              <th>Plan</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {vendors.map(vendor => (
              <tr key={vendor._id}>
                <td>{vendor.companyName}</td>
                <td>{vendor.email}</td>
                <td>
                  <span className={`status-badge ${vendor.isActive ? 'active' : 'inactive'}`}>
                    {vendor.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td>{vendor.subscriptionPlan}</td>
                <td>
                  <button
                    onClick={() => handleToggleActive(vendor)}
                    className="btn btn-secondary"
                    style={{ marginRight: '10px' }}
                  >
                    {vendor.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                  <button
                    onClick={() => handleDelete(vendor._id)}
                    className="btn btn-danger"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default VendorManagement;

