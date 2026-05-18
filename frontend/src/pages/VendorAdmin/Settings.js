import React, { useState, useEffect } from 'react';
import axiosInstance from '../../utils/axios';
import { resolveMediaUrl } from '../../utils/mediaUrl';
import { useVendorBranding } from '../../context/VendorBrandingContext';
import { useAuth } from '../../context/AuthContext';
import {
  NAVBAR_LOGO_DISPLAY,
  NAVBAR_LOGO_UPLOAD,
  DEFAULT_BRANDING,
  normalizeBrandSettings,
} from '../../constants/branding';
import { applyBrandingToDocument } from '../../utils/applyBranding';
import './VendorAdminCommon.css';
import '../../components/Layout/Navbar.css';
import './Settings.css';

const VendorSettings = () => {
  const { updateUserBranding } = useAuth();
  const { refreshBranding, updateBranding } = useVendorBranding();
  const [vendor, setVendor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [removingLogo, setRemovingLogo] = useState(false);
  const [savingTheme, setSavingTheme] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    fetchVendor();
  }, []);

  useEffect(() => {
    return () => {
      if (logoPreview) URL.revokeObjectURL(logoPreview);
    };
  }, [logoPreview]);

  const fetchVendor = async () => {
    try {
      const response = await axiosInstance.get('/vendor-admin/vendor');
      const data = response.data;
      const normalizedSettings = normalizeBrandSettings(data.settings);
      setVendor({ ...data, settings: normalizedSettings });
      applyBrandingToDocument(normalizedSettings);
    } catch (error) {
      console.error('Error fetching vendor:', error);
      setMessage({ type: 'error', text: 'Failed to load vendor settings.' });
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > NAVBAR_LOGO_UPLOAD.maxFileSizeMB * 1024 * 1024) {
      setMessage({
        type: 'error',
        text: `File is too large. Maximum size is ${NAVBAR_LOGO_UPLOAD.maxFileSizeMB} MB.`,
      });
      e.target.value = '';
      return;
    }

    if (logoPreview) URL.revokeObjectURL(logoPreview);
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
    setMessage({ type: '', text: '' });
  };

  const handleLogoUpload = async (e) => {
    e.preventDefault();
    if (!logoFile) {
      setMessage({ type: 'error', text: 'Please choose an image file first.' });
      return;
    }

    const formData = new FormData();
    formData.append('logo', logoFile);

    setUploading(true);
    setMessage({ type: '', text: '' });
    try {
      const response = await axiosInstance.post('/vendor-admin/vendor/logo', formData);
      setVendor((prev) => ({ ...prev, logo: response.data.logo }));
      const brandingPayload = {
        logo: response.data.logo,
        companyName: response.data.companyName,
        settings: response.data.settings,
      };
      updateBranding(brandingPayload);
      updateUserBranding(brandingPayload);
      await refreshBranding();
      setLogoFile(null);
      if (logoPreview) URL.revokeObjectURL(logoPreview);
      setLogoPreview(null);
      setMessage({ type: 'success', text: 'Logo uploaded successfully. It will appear in the navbar for your organization.' });
    } catch (error) {
      setMessage({
        type: 'error',
        text: error.response?.data?.message || error.message || 'Error uploading logo',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveLogo = async () => {
    if (!window.confirm('Remove your organization logo? The navbar will show your company name instead.')) {
      return;
    }
    setRemovingLogo(true);
    setMessage({ type: '', text: '' });
    try {
      await axiosInstance.delete('/vendor-admin/vendor/logo');
      setVendor((prev) => ({ ...prev, logo: null }));
      const clearedBranding = {
        logo: null,
        companyName: vendor?.companyName,
        settings: vendor?.settings,
      };
      updateBranding(clearedBranding);
      updateUserBranding(clearedBranding);
      await refreshBranding();
      setMessage({ type: 'success', text: 'Logo removed.' });
    } catch (error) {
      setMessage({
        type: 'error',
        text: error.response?.data?.message || 'Error removing logo',
      });
    } finally {
      setRemovingLogo(false);
    }
  };

  const handleColorChange = (field, value) => {
    const nextSettings = normalizeBrandSettings({
      ...vendor?.settings,
      [field]: value,
    });
    setVendor((prev) => ({ ...prev, settings: nextSettings }));
    applyBrandingToDocument(nextSettings);
  };

  const handleSettingsUpdate = async (e) => {
    e.preventDefault();
    setSavingTheme(true);
    setMessage({ type: '', text: '' });
    const settingsPayload = normalizeBrandSettings(vendor?.settings);
    try {
      const response = await axiosInstance.put('/vendor-admin/vendor', {
        settings: settingsPayload,
      });
      const savedSettings = normalizeBrandSettings(response.data.settings);
      setVendor({ ...response.data, settings: savedSettings });
      const brandingPayload = {
        logo: response.data.logo,
        companyName: response.data.companyName,
        settings: savedSettings,
      };
      updateBranding(brandingPayload);
      updateUserBranding(brandingPayload);
      applyBrandingToDocument(savedSettings);
      await refreshBranding();
      setMessage({ type: 'success', text: 'Brand colors saved. Buttons, links, and accents now use your colors.' });
    } catch (error) {
      setMessage({
        type: 'error',
        text: error.response?.data?.message || 'Error updating settings',
      });
    } finally {
      setSavingTheme(false);
    }
  };

  const displayLogoSrc = logoPreview || (vendor?.logo ? resolveMediaUrl(vendor.logo) : null);

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="container settings-page">
      <h1 className="page-title">Vendor Settings</h1>
      <p className="settings-subtitle">
        Manage your organization logo and brand colors. Logo and colors apply in the navbar and across the app for your users.
      </p>

      {message.text && (
        <div className={`settings-alert settings-alert-${message.type}`} role="alert">
          {message.text}
        </div>
      )}

      <div className="settings-card-modern">
        <h2>Logo</h2>

        <div className="logo-specs-box">
          <h3>Recommended logo size (based on navbar layout)</h3>
          <p>
            Your logo appears in the top navigation bar. We analyzed the navbar height, padding, and link sizes to pick dimensions that stay sharp without crowding the menu.
          </p>
          <ul className="logo-specs-list">
            <li>
              <strong>Navbar display:</strong> {NAVBAR_LOGO_DISPLAY.height}px tall × up to {NAVBAR_LOGO_DISPLAY.maxWidth}px wide
            </li>
            <li>
              <strong>Recommended upload (2× for retina):</strong> {NAVBAR_LOGO_UPLOAD.recommendedHeight}px tall × up to {NAVBAR_LOGO_UPLOAD.recommendedMaxWidth}px wide for horizontal logos
            </li>
            <li>
              <strong>Square / icon logos:</strong> {NAVBAR_LOGO_UPLOAD.squareSize}×{NAVBAR_LOGO_UPLOAD.squareSize}px (displays at {NAVBAR_LOGO_DISPLAY.height}×{NAVBAR_LOGO_DISPLAY.height}px)
            </li>
            <li>
              <strong>Formats:</strong> {NAVBAR_LOGO_UPLOAD.acceptedFormats.join(', ')} — max {NAVBAR_LOGO_UPLOAD.maxFileSizeMB} MB
            </li>
            <li>
              <strong>Tip:</strong> Use a transparent PNG or WebP on a light/dark background that matches your theme.
            </li>
          </ul>
          <div className="logo-navbar-preview" aria-hidden="true">
            <span className="logo-navbar-preview-label">Navbar preview</span>
            <div className="logo-navbar-preview-bar">
              {displayLogoSrc ? (
                <span className="navbar-brand-logo">
                  <img src={displayLogoSrc} alt="" className="navbar-brand-logo-img" />
                </span>
              ) : (
                <span className="logo-navbar-preview-placeholder">Your logo</span>
              )}
            </div>
          </div>
        </div>

        {displayLogoSrc && (
          <div className="logo-preview-wrap">
            <img src={displayLogoSrc} alt="Current logo" className="logo-preview" />
          </div>
        )}

        <form onSubmit={handleLogoUpload} className="logo-upload-form">
          <div className="form-group">
            <label htmlFor="logo-file">Upload logo</label>
            <input
              id="logo-file"
              type="file"
              accept={NAVBAR_LOGO_UPLOAD.acceptMime}
              onChange={handleFileChange}
              disabled={uploading}
            />
          </div>
          <div className="logo-form-actions">
            <button type="submit" className="btn btn-primary" disabled={uploading || !logoFile}>
              {uploading ? 'Uploading…' : 'Upload Logo'}
            </button>
            {vendor?.logo && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleRemoveLogo}
                disabled={removingLogo || uploading}
              >
                {removingLogo ? 'Removing…' : 'Remove Logo'}
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="settings-card-modern">
        <h2>Brand colors</h2>
        <p className="settings-card-desc">
          Pick primary and secondary colors. You&apos;ll see a live preview below; click Save to apply for all users in your organization.
        </p>

        <div className="brand-colors-preview">
          <span className="brand-colors-preview-label">Live preview</span>
          <div className="brand-colors-preview-row">
            <button type="button" className="btn btn-primary btn-sm" tabIndex={-1}>
              Primary button
            </button>
            <span className="gradient-text brand-colors-preview-gradient">Gradient text</span>
            <span
              className="brand-colors-preview-swatch"
              style={{
                background: `linear-gradient(to right, ${vendor?.settings?.primaryColor || DEFAULT_BRANDING.primaryColor}, ${vendor?.settings?.secondaryColor || DEFAULT_BRANDING.secondaryColor})`,
              }}
            />
          </div>
        </div>

        <form onSubmit={handleSettingsUpdate}>
          <div className="color-input-group">
            <label htmlFor="primary-color">Primary color</label>
            <input
              id="primary-color"
              type="color"
              value={vendor?.settings?.primaryColor || DEFAULT_BRANDING.primaryColor}
              onChange={(e) => handleColorChange('primaryColor', e.target.value)}
            />
            <div
              className="color-preview"
              style={{ background: vendor?.settings?.primaryColor || DEFAULT_BRANDING.primaryColor }}
            >
              {vendor?.settings?.primaryColor || DEFAULT_BRANDING.primaryColor}
            </div>
          </div>
          <div className="color-input-group">
            <label htmlFor="secondary-color">Secondary color</label>
            <input
              id="secondary-color"
              type="color"
              value={vendor?.settings?.secondaryColor || DEFAULT_BRANDING.secondaryColor}
              onChange={(e) => handleColorChange('secondaryColor', e.target.value)}
            />
            <div
              className="color-preview"
              style={{ background: vendor?.settings?.secondaryColor || DEFAULT_BRANDING.secondaryColor }}
            >
              {vendor?.settings?.secondaryColor || DEFAULT_BRANDING.secondaryColor}
            </div>
          </div>
          <button type="submit" className="btn btn-primary" disabled={savingTheme}>
            {savingTheme ? 'Saving…' : 'Save brand colors'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default VendorSettings;
