import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  FiArrowLeft,
  FiBriefcase,
  FiCreditCard,
  FiImage,
  FiSave,
  FiSettings,
  FiShield,
  FiUser,
} from 'react-icons/fi';
import axiosInstance from '../../utils/axios';
import { resolveMediaUrl } from '../../utils/mediaUrl';
import VendorHubPage from '../../components/VendorAdmin/VendorHubPage';
import { SUPER_ADMIN_ACCENT } from '../../constants/superAdminSections';
import {
  NAVBAR_LOGO_UPLOAD,
  normalizeBrandSettings,
} from '../../constants/branding';
import { compressLogoImage } from '../../utils/compressLogoImage';
import '../../styles/super-admin-pages.css';

const TABS = [
  { id: 'profile', label: 'Profile', icon: FiBriefcase },
  { id: 'branding', label: 'Branding', icon: FiImage },
  { id: 'subscription', label: 'Subscription', icon: FiSettings },
  { id: 'admin', label: 'Admin account', icon: FiUser },
  { id: 'credits', label: 'Interview credits', icon: FiCreditCard },
];

const toDateInput = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
};

const getInitials = (name) => {
  if (!name) return '?';
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
};

const VendorEditor = () => {
  const { vendorId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('profile');
  const [vendor, setVendor] = useState(null);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [form, setForm] = useState({
    companyName: '',
    name: '',
    email: '',
    isActive: true,
    subscriptionPlan: 'free',
    subscriptionExpiresAt: '',
    settings: normalizeBrandSettings({}),
    adminName: '',
    adminEmail: '',
    adminPassword: '',
    adminIsActive: true,
  });
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [logoBusy, setLogoBusy] = useState(false);
  const [creditsToAdd, setCreditsToAdd] = useState('');
  const [allocating, setAllocating] = useState(false);

  const hydrateForm = useCallback((data) => {
    const contactName = data.adminUser?.name || data.name || '';
    const contactEmail = data.adminUser?.email || data.email || '';
    setForm({
      companyName: data.companyName || '',
      name: contactName,
      email: contactEmail,
      isActive: data.isActive !== false,
      subscriptionPlan: data.subscriptionPlan || 'free',
      subscriptionExpiresAt: toDateInput(data.subscriptionExpiresAt),
      settings: normalizeBrandSettings(data.settings),
      adminName: contactName,
      adminEmail: contactEmail,
      adminPassword: '',
      adminIsActive: data.adminUser?.isActive !== false,
    });
  }, []);

  const fetchVendor = useCallback(async () => {
    try {
      setLoading(true);
      const response = await axiosInstance.get(`/super-admin/vendors/${vendorId}`);
      setVendor(response.data);
      hydrateForm(response.data);
    } catch (error) {
      setMessage({
        type: 'error',
        text: error.response?.data?.message || 'Failed to load vendor details.',
      });
    } finally {
      setLoading(false);
    }
  }, [vendorId, hydrateForm]);

  useEffect(() => {
    fetchVendor();
  }, [fetchVendor]);

  useEffect(() => {
    return () => {
      if (logoPreview) URL.revokeObjectURL(logoPreview);
    };
  }, [logoPreview]);

  const updateField = (field, value) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === 'name') next.adminName = value;
      if (field === 'adminName') next.name = value;
      if (field === 'email') next.adminEmail = value;
      if (field === 'adminEmail') next.email = value;
      return next;
    });
  };

  const updateSettings = (field, value) => {
    setForm((prev) => ({
      ...prev,
      settings: normalizeBrandSettings({ ...prev.settings, [field]: value }),
    }));
  };

  const usage = vendor?.usage || { students: 0, tests: 0, results: 0 };
  const credits = vendor?.interviewCredits || { allocated: 0, used: 0, remaining: 0 };

  const displayLogoSrc = useMemo(
    () => logoPreview || (vendor?.logo ? resolveMediaUrl(vendor.logo) : null),
    [logoPreview, vendor?.logo]
  );

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage({ type: '', text: '' });

    const settingsPayload = normalizeBrandSettings(form.settings);
    if (settingsPayload.leetcodeAnalyticsUrl) {
      try {
        const parsed = new URL(settingsPayload.leetcodeAnalyticsUrl);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
          setMessage({
            type: 'error',
            text: 'LeetCode Analytics URL must start with http:// or https://',
          });
          setSaving(false);
          return;
        }
        settingsPayload.leetcodeAnalyticsUrl = parsed.toString();
      } catch {
        setMessage({ type: 'error', text: 'Invalid LeetCode Analytics URL' });
        setSaving(false);
        return;
      }
    }

    const payload = {
      companyName: form.companyName.trim(),
      name: form.name.trim(),
      email: form.email.trim(),
      isActive: form.isActive,
      subscriptionPlan: form.subscriptionPlan,
      subscriptionExpiresAt: form.subscriptionExpiresAt || null,
      settings: settingsPayload,
      adminName: form.adminName.trim(),
      adminEmail: form.adminEmail.trim(),
      adminIsActive: form.adminIsActive,
    };

    if (form.adminPassword.trim()) {
      if (form.adminPassword.trim().length < 6) {
        setMessage({ type: 'error', text: 'Password must be at least 6 characters.' });
        setSaving(false);
        return;
      }
      payload.adminPassword = form.adminPassword.trim();
    }

    try {
      const response = await axiosInstance.put(`/super-admin/vendors/${vendorId}`, payload);
      setVendor(response.data);
      hydrateForm({ ...response.data, adminPassword: '' });
      setForm((prev) => ({ ...prev, adminPassword: '' }));
      setMessage({ type: 'success', text: 'Vendor details saved successfully.' });
    } catch (error) {
      if (error.response?.data?.errors?.length) {
        const validationErrors = error.response.data.errors
          .map((item) => item.msg || item.message)
          .join(' ');
        setMessage({ type: 'error', text: validationErrors });
      } else {
        setMessage({
          type: 'error',
          text: error.response?.data?.message || 'Failed to save vendor details.',
        });
      }
    } finally {
      setSaving(false);
    }
  };

  const handleLogoFile = async (e) => {
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

    setLogoBusy(true);
    try {
      const prepared = await compressLogoImage(file);
      if (logoPreview) URL.revokeObjectURL(logoPreview);
      setLogoFile(prepared);
      setLogoPreview(URL.createObjectURL(prepared));
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Could not process image.' });
      e.target.value = '';
    } finally {
      setLogoBusy(false);
    }
  };

  const handleLogoUpload = async () => {
    if (!logoFile) {
      setMessage({ type: 'error', text: 'Choose an image file first.' });
      return;
    }

    const formData = new FormData();
    formData.append('logo', logoFile);
    setLogoBusy(true);
    setMessage({ type: '', text: '' });

    try {
      const response = await axiosInstance.post(`/super-admin/vendors/${vendorId}/logo`, formData);
      setVendor((prev) => ({ ...prev, logo: response.data.logo }));
      setLogoFile(null);
      if (logoPreview) URL.revokeObjectURL(logoPreview);
      setLogoPreview(null);
      setMessage({ type: 'success', text: 'Logo uploaded successfully.' });
    } catch (error) {
      setMessage({
        type: 'error',
        text: error.response?.data?.message || 'Failed to upload logo.',
      });
    } finally {
      setLogoBusy(false);
    }
  };

  const handleRemoveLogo = async () => {
    if (!window.confirm('Remove this vendor logo?')) return;
    setLogoBusy(true);
    setMessage({ type: '', text: '' });
    try {
      await axiosInstance.delete(`/super-admin/vendors/${vendorId}/logo`);
      setVendor((prev) => ({ ...prev, logo: null }));
      setMessage({ type: 'success', text: 'Logo removed.' });
    } catch (error) {
      setMessage({
        type: 'error',
        text: error.response?.data?.message || 'Failed to remove logo.',
      });
    } finally {
      setLogoBusy(false);
    }
  };

  const handleAllocateCredits = async () => {
    const amount = parseInt(creditsToAdd, 10);
    if (Number.isNaN(amount) || amount < 1) {
      setMessage({ type: 'error', text: 'Enter a valid number of credits to add (1 or more).' });
      return;
    }

    setAllocating(true);
    setMessage({ type: '', text: '' });
    try {
      const response = await axiosInstance.post(`/super-admin/vendors/${vendorId}/interview-credits`, {
        credits: amount,
      });
      setVendor((prev) => ({
        ...prev,
        interviewCredits: response.data.interviewCredits,
      }));
      setCreditsToAdd('');
      setMessage({ type: 'success', text: `Added ${amount} interview credit${amount === 1 ? '' : 's'}.` });
    } catch (error) {
      setMessage({
        type: 'error',
        text: error.response?.data?.message || 'Failed to allocate credits.',
      });
    } finally {
      setAllocating(false);
    }
  };

  if (!loading && !vendor) {
    return (
      <VendorHubPage className="sa-page" eyebrow="Organizations" title="Vendor not found" accent={SUPER_ADMIN_ACCENT}>
        <div className="vh-empty">
          <h2>Vendor not found</h2>
          <p>The organization may have been deleted or the link is invalid.</p>
          <Link to="/super-admin/vendors" className="vh-btn vh-btn--primary">
            <FiArrowLeft /> Back to vendors
          </Link>
        </div>
      </VendorHubPage>
    );
  }

  return (
    <VendorHubPage
      className="sa-page sa-vendor-editor-page"
      loading={loading}
      eyebrow="Organizations"
      title={vendor?.companyName || 'Edit vendor'}
      subtitle="Update company profile, branding, subscription, admin login, and interview credits."
      accent={SUPER_ADMIN_ACCENT}
      actions={
        <Link to="/super-admin/vendors" className="vh-btn vh-btn--ghost">
          <FiArrowLeft /> All vendors
        </Link>
      }
    >
      {vendor && (
        <div className="sa-vendor-editor-hero">
          <div className="sa-vendor-editor-hero-main">
            <span className="sa-vendor-editor-avatar">{getInitials(vendor.companyName)}</span>
            <div>
              <h2 className="sa-vendor-editor-company">{vendor.companyName}</h2>
              <p className="sa-vendor-editor-meta">
                {vendor.email}
                <span className="sa-vendor-editor-dot">·</span>
                <span className={`vh-badge sa-plan-badge sa-plan-badge--${vendor.subscriptionPlan || 'free'}`}>
                  {vendor.subscriptionPlan || 'free'}
                </span>
                <span className="sa-vendor-editor-dot">·</span>
                <span className={`vh-badge ${vendor.isActive !== false ? 'vh-badge--active' : 'vh-badge--inactive'}`}>
                  {vendor.isActive !== false ? 'Active' : 'Inactive'}
                </span>
              </p>
            </div>
          </div>
          <div className="sa-vendor-editor-hero-stats">
            <div>
              <span className="sa-vendor-editor-stat-label">Students</span>
              <strong>{usage.students}</strong>
            </div>
            <div>
              <span className="sa-vendor-editor-stat-label">Tests</span>
              <strong>{usage.tests}</strong>
            </div>
            <div>
              <span className="sa-vendor-editor-stat-label">Credits left</span>
              <strong>{credits.remaining ?? 0}</strong>
            </div>
          </div>
        </div>
      )}

      {message.text && (
        <div className={`vh-alert vh-alert--${message.type === 'error' ? 'error' : 'success'}`} role="alert">
          {message.text}
        </div>
      )}

      <div className="sa-vendor-editor-shell">
        <nav className="sa-vendor-editor-nav" aria-label="Vendor editor sections">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                className={`sa-vendor-editor-tab ${activeTab === tab.id ? 'is-active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <Icon aria-hidden />
                {tab.label}
              </button>
            );
          })}
        </nav>

        <form className="sa-vendor-editor-main" onSubmit={handleSave}>
          {activeTab === 'profile' && (
            <section className="vh-panel">
              <div className="vh-panel-head">
                <div>
                  <h2 className="vh-panel-title">Company profile</h2>
                  <p className="vh-panel-desc">Primary organization details shown across the platform.</p>
                </div>
              </div>
              <div className="vh-panel-body">
                <div className="vh-form-grid">
                  <div className="vh-field">
                    <label htmlFor="companyName">Company name</label>
                    <input
                      id="companyName"
                      value={form.companyName}
                      onChange={(e) => updateField('companyName', e.target.value)}
                      required
                    />
                  </div>
                  <div className="vh-field">
                    <label htmlFor="vendorName">Primary contact name</label>
                    <input
                      id="vendorName"
                      value={form.name}
                      onChange={(e) => updateField('name', e.target.value)}
                      required
                    />
                    <p className="sa-vendor-field-hint">
                      Shown in the vendor portal sidebar and dashboard greeting.
                    </p>
                  </div>
                  <div className="vh-field">
                    <label htmlFor="vendorEmail">Organization email</label>
                    <input
                      id="vendorEmail"
                      type="email"
                      value={form.email}
                      onChange={(e) => updateField('email', e.target.value)}
                      required
                    />
                  </div>
                  <div className="vh-field">
                    <label htmlFor="vendorStatus">Account status</label>
                    <select
                      id="vendorStatus"
                      value={form.isActive ? 'active' : 'inactive'}
                      onChange={(e) => updateField('isActive', e.target.value === 'active')}
                    >
                      <option value="active">Active — vendor can sign in and operate</option>
                      <option value="inactive">Inactive — access suspended</option>
                    </select>
                  </div>
                </div>
              </div>
            </section>
          )}

          {activeTab === 'branding' && (
            <section className="vh-panel">
              <div className="vh-panel-head">
                <div>
                  <h2 className="vh-panel-title">Branding & logo</h2>
                  <p className="vh-panel-desc">Logo and colors used in the vendor navbar and student experience.</p>
                </div>
              </div>
              <div className="vh-panel-body">
                <div className="sa-vendor-branding-grid">
                  <div className="sa-vendor-logo-card">
                    <span className="sa-vendor-logo-label">Logo preview</span>
                    <div className="sa-vendor-logo-preview-bar">
                      {displayLogoSrc ? (
                        <img src={displayLogoSrc} alt="" className="sa-vendor-logo-preview-img" />
                      ) : (
                        <span className="sa-vendor-logo-placeholder">{form.companyName || 'Company logo'}</span>
                      )}
                    </div>
                    <div className="sa-vendor-logo-actions">
                      <input
                        id="vendor-logo-file"
                        type="file"
                        accept={NAVBAR_LOGO_UPLOAD.acceptMime}
                        onChange={handleLogoFile}
                        disabled={logoBusy}
                      />
                      <div className="sa-vendor-logo-buttons">
                        <button
                          type="button"
                          className="vh-btn vh-btn--primary vh-btn--sm"
                          onClick={handleLogoUpload}
                          disabled={logoBusy || !logoFile}
                        >
                          {logoBusy ? 'Uploading…' : 'Upload logo'}
                        </button>
                        {vendor?.logo && (
                          <button
                            type="button"
                            className="vh-btn vh-btn--ghost vh-btn--sm"
                            onClick={handleRemoveLogo}
                            disabled={logoBusy}
                          >
                            Remove
                          </button>
                        )}
                      </div>
                      <p className="sa-vendor-logo-hint">
                        PNG, JPG, GIF, or WebP — max {NAVBAR_LOGO_UPLOAD.maxFileSizeMB} MB. Uploads apply immediately.
                      </p>
                    </div>
                  </div>

                  <div className="sa-vendor-colors-card">
                    <div className="sa-vendor-color-row">
                      <label htmlFor="primaryColor">Primary color</label>
                      <input
                        id="primaryColor"
                        type="color"
                        value={form.settings.primaryColor}
                        onChange={(e) => updateSettings('primaryColor', e.target.value)}
                      />
                      <code>{form.settings.primaryColor}</code>
                    </div>
                    <div className="sa-vendor-color-row">
                      <label htmlFor="secondaryColor">Secondary color</label>
                      <input
                        id="secondaryColor"
                        type="color"
                        value={form.settings.secondaryColor}
                        onChange={(e) => updateSettings('secondaryColor', e.target.value)}
                      />
                      <code>{form.settings.secondaryColor}</code>
                    </div>
                    <div className="sa-vendor-color-preview">
                      <span
                        style={{
                          background: `linear-gradient(90deg, ${form.settings.primaryColor}, ${form.settings.secondaryColor})`,
                        }}
                      />
                      <button type="button" className="vh-btn vh-btn--primary vh-btn--sm" tabIndex={-1}>
                        Preview button
                      </button>
                    </div>
                    <div className="vh-field" style={{ marginTop: 16 }}>
                      <label htmlFor="theme">Theme</label>
                      <select
                        id="theme"
                        value={form.settings.theme}
                        onChange={(e) => updateSettings('theme', e.target.value)}
                      >
                        <option value="light">Light</option>
                        <option value="dark">Dark</option>
                      </select>
                    </div>
                    <div className="vh-field">
                      <label htmlFor="leetcodeUrl">LeetCode Analytics URL</label>
                      <input
                        id="leetcodeUrl"
                        type="url"
                        placeholder="https://your-analytics.example.com"
                        value={form.settings.leetcodeAnalyticsUrl}
                        onChange={(e) => updateSettings('leetcodeAnalyticsUrl', e.target.value)}
                      />
                      <p className="sa-vendor-field-hint">
                        Optional dashboard link shown to the vendor admin when set.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}

          {activeTab === 'subscription' && (
            <section className="vh-panel">
              <div className="vh-panel-head">
                <div>
                  <h2 className="vh-panel-title">Subscription & access</h2>
                  <p className="vh-panel-desc">Control plan tier and optional expiry for this organization.</p>
                </div>
              </div>
              <div className="vh-panel-body">
                <div className="vh-form-grid">
                  <div className="vh-field">
                    <label htmlFor="subscriptionPlan">Plan</label>
                    <select
                      id="subscriptionPlan"
                      value={form.subscriptionPlan}
                      onChange={(e) => updateField('subscriptionPlan', e.target.value)}
                    >
                      <option value="free">Free</option>
                      <option value="basic">Basic</option>
                      <option value="premium">Premium</option>
                    </select>
                  </div>
                  <div className="vh-field">
                    <label htmlFor="subscriptionExpiresAt">Expires on (optional)</label>
                    <input
                      id="subscriptionExpiresAt"
                      type="date"
                      value={form.subscriptionExpiresAt}
                      onChange={(e) => updateField('subscriptionExpiresAt', e.target.value)}
                    />
                    <p className="sa-vendor-field-hint">Leave blank for no expiry date.</p>
                  </div>
                </div>
                <div className="sa-vendor-plan-cards">
                  {['free', 'basic', 'premium'].map((plan) => (
                    <button
                      key={plan}
                      type="button"
                      className={`sa-vendor-plan-card ${form.subscriptionPlan === plan ? 'is-selected' : ''}`}
                      onClick={() => updateField('subscriptionPlan', plan)}
                    >
                      <span className={`vh-badge sa-plan-badge sa-plan-badge--${plan}`}>{plan}</span>
                      <strong>{plan === 'free' ? 'Starter' : plan === 'basic' ? 'Growth' : 'Enterprise'}</strong>
                      <small>
                        {plan === 'free' && 'Default access for new vendors'}
                        {plan === 'basic' && 'Expanded limits and support'}
                        {plan === 'premium' && 'Full platform capabilities'}
                      </small>
                    </button>
                  ))}
                </div>
              </div>
            </section>
          )}

          {activeTab === 'admin' && (
            <section className="vh-panel">
              <div className="vh-panel-head">
                <div>
                  <h2 className="vh-panel-title">Vendor admin account</h2>
                  <p className="vh-panel-desc">
                    Login credentials for the vendor administrator. Password changes apply on save.
                  </p>
                </div>
                <span className="sa-vendor-admin-pill">
                  <FiShield /> vendor_admin
                </span>
              </div>
              <div className="vh-panel-body">
                <div className="vh-form-grid">
                  <div className="vh-field">
                    <label htmlFor="adminName">Admin name</label>
                    <input
                      id="adminName"
                      value={form.adminName}
                      onChange={(e) => updateField('adminName', e.target.value)}
                      required
                    />
                    <p className="sa-vendor-field-hint">Kept in sync with primary contact name.</p>
                  </div>
                  <div className="vh-field">
                    <label htmlFor="adminEmail">Admin email (login)</label>
                    <input
                      id="adminEmail"
                      type="email"
                      value={form.adminEmail}
                      onChange={(e) => updateField('adminEmail', e.target.value)}
                      required
                    />
                    <p className="sa-vendor-field-hint">Kept in sync with organization email.</p>
                  </div>
                  <div className="vh-field">
                    <label htmlFor="adminPassword">New password</label>
                    <input
                      id="adminPassword"
                      type="password"
                      autoComplete="new-password"
                      placeholder="Leave blank to keep current password"
                      value={form.adminPassword}
                      onChange={(e) => updateField('adminPassword', e.target.value)}
                    />
                  </div>
                  <div className="vh-field">
                    <label htmlFor="adminIsActive">Admin login status</label>
                    <select
                      id="adminIsActive"
                      value={form.adminIsActive ? 'active' : 'inactive'}
                      onChange={(e) => updateField('adminIsActive', e.target.value === 'active')}
                    >
                      <option value="active">Can sign in</option>
                      <option value="inactive">Sign-in disabled</option>
                    </select>
                  </div>
                </div>
                {vendor?.adminUser?.createdAt && (
                  <p className="sa-vendor-field-hint">
                    Admin account created {new Date(vendor.adminUser.createdAt).toLocaleDateString()}.
                  </p>
                )}
              </div>
            </section>
          )}

          {activeTab === 'credits' && (
            <section className="vh-panel">
              <div className="vh-panel-head">
                <div>
                  <h2 className="vh-panel-title">Interview credits</h2>
                  <p className="vh-panel-desc">
                    One credit is used when a student attempts a mock interview for more than 5 minutes.
                  </p>
                </div>
              </div>
              <div className="vh-panel-body">
                <div className="vh-stats sa-vendor-credits-stats">
                  <div className="vh-stat vh-stat--accent">
                    <span className="vh-stat-label">Allocated</span>
                    <span className="vh-stat-value">{credits.allocated ?? 0}</span>
                  </div>
                  <div className="vh-stat">
                    <span className="vh-stat-label">Used</span>
                    <span className="vh-stat-value">{credits.used ?? 0}</span>
                  </div>
                  <div className="vh-stat">
                    <span className="vh-stat-label">Remaining</span>
                    <span className="vh-stat-value sa-credits-remaining">{credits.remaining ?? 0}</span>
                  </div>
                </div>
                <div className="sa-credits-action" style={{ marginTop: 18 }}>
                  <input
                    type="number"
                    min="1"
                    className="sa-credits-input"
                    placeholder="Credits to add"
                    value={creditsToAdd}
                    onChange={(e) => setCreditsToAdd(e.target.value)}
                  />
                  <button
                    type="button"
                    className="vh-btn vh-btn--primary"
                    onClick={handleAllocateCredits}
                    disabled={allocating}
                  >
                    <FiCreditCard /> {allocating ? 'Adding…' : 'Add credits'}
                  </button>
                </div>
              </div>
            </section>
          )}

          {activeTab !== 'credits' && (
            <div className="sa-vendor-editor-footer">
              <button type="button" className="vh-btn vh-btn--ghost" onClick={() => navigate('/super-admin/vendors')}>
                Cancel
              </button>
              <button type="submit" className="vh-btn vh-btn--primary" disabled={saving}>
                <FiSave /> {saving ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          )}
        </form>
      </div>
    </VendorHubPage>
  );
};

export default VendorEditor;
