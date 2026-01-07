import React, { useState, useEffect } from 'react';
import axiosInstance from '../../utils/axios';
import './VendorAdminCommon.css';
import './Settings.css';

const VendorSettings = () => {
  const [vendor, setVendor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [logoFile, setLogoFile] = useState(null);

  useEffect(() => {
    fetchVendor();
  }, []);

  const fetchVendor = async () => {
    try {
      const response = await axiosInstance.get('/vendor-admin/vendor');
      setVendor(response.data);
    } catch (error) {
      console.error('Error fetching vendor:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogoUpload = async (e) => {
    e.preventDefault();
    if (!logoFile) return;

    const formData = new FormData();
    formData.append('logo', logoFile);

    try {
      const response = await axiosInstance.post('/vendor-admin/vendor/logo', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setVendor({ ...vendor, logo: response.data.logo });
      alert('Logo uploaded successfully!');
    } catch (error) {
      alert(error.response?.data?.message || 'Error uploading logo');
    }
  };

  const handleSettingsUpdate = async (e) => {
    e.preventDefault();
    try {
      await axiosInstance.put('/vendor-admin/vendor', {
        settings: vendor.settings
      });
      alert('Settings updated successfully!');
    } catch (error) {
      alert(error.response?.data?.message || 'Error updating settings');
    }
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="container settings-page">
      <h1 className="page-title">Vendor Settings</h1>

      <div className="settings-card-modern">
        <h2>Logo</h2>
        {vendor?.logo && (
          <img 
            src={`http://localhost:5000${vendor.logo}`} 
            alt="Logo" 
            className="logo-preview"
          />
        )}
        <form onSubmit={handleLogoUpload}>
          <div className="form-group">
            <label>Upload Logo</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setLogoFile(e.target.files[0])}
            />
          </div>
          <button type="submit" className="btn btn-primary">Upload Logo</button>
        </form>
      </div>

      <div className="settings-card-modern">
        <h2>Theme Settings</h2>
        <form onSubmit={handleSettingsUpdate}>
          <div className="color-input-group">
            <label>Primary Color</label>
            <input
              type="color"
              value={vendor?.settings?.primaryColor || '#ED0331'}
              onChange={(e) => setVendor({
                ...vendor,
                settings: { ...vendor.settings, primaryColor: e.target.value }
              })}
            />
            <div 
              className="color-preview"
              style={{ background: vendor?.settings?.primaryColor || '#ED0331' }}
            >
              {vendor?.settings?.primaryColor || '#ED0331'}
            </div>
          </div>
          <div className="color-input-group">
            <label>Secondary Color</label>
            <input
              type="color"
              value={vendor?.settings?.secondaryColor || '#87021C'}
              onChange={(e) => setVendor({
                ...vendor,
                settings: { ...vendor.settings, secondaryColor: e.target.value }
              })}
            />
            <div 
              className="color-preview"
              style={{ background: vendor?.settings?.secondaryColor || '#87021C' }}
            >
              {vendor?.settings?.secondaryColor || '#87021C'}
            </div>
          </div>
          <button type="submit" className="btn btn-primary">Update Settings</button>
        </form>
      </div>
    </div>
  );
};

export default VendorSettings;

