import React, { useState, useEffect } from 'react';
import { Link, useParams, useLocation } from 'react-router-dom';
import { FiArrowLeft, FiPlus, FiTrash2 } from 'react-icons/fi';
import axiosInstance from '../../utils/axios';
import VendorHubPage from '../../components/VendorAdmin/VendorHubPage';
import { SUPER_ADMIN_ACCENT } from '../../constants/superAdminSections';
import { getPlatformExtendedSection } from '../../constants/platformAssessmentSections';
import '../../styles/super-admin-pages.css';

const CONFIG = {
  interview: {
    apiBase: '/super-admin/interviews',
    listPath: '/super-admin/assessments?type=interview',
    label: 'interview',
  },
  assignment: {
    apiBase: '/super-admin/assignments',
    listPath: '/super-admin/assessments?type=project',
    label: 'project',
  },
  'system-design': {
    apiBase: '/super-admin/system-design-problems',
    listPath: '/super-admin/assessments?type=system',
    label: 'system design problem',
  },
};

const AllocatePlatformAssessment = () => {
  const { resourceId } = useParams();
  const location = useLocation();
  const resourceType = location.pathname.includes('/interviews/')
    ? 'interview'
    : location.pathname.includes('/assignments/')
      ? 'assignment'
      : 'system-design';
  const config = CONFIG[resourceType];
  const section = getPlatformExtendedSection(
    resourceType === 'assignment' ? 'project' : resourceType === 'system-design' ? 'system' : 'interview'
  );

  const [resource, setResource] = useState(null);
  const [vendors, setVendors] = useState([]);
  const [allocations, setAllocations] = useState([]);
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!config) return;
    try {
      setLoading(true);
      const [resourceRes, vendorRes, allocRes] = await Promise.all([
        axiosInstance.get(`${config.apiBase}/${resourceId}`),
        axiosInstance.get('/super-admin/vendors'),
        axiosInstance.get(`${config.apiBase}/${resourceId}/allocations`),
      ]);
      setResource(resourceRes.data);
      setVendors(Array.isArray(vendorRes.data) ? vendorRes.data : []);
      setAllocations(allocRes.data?.items || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resourceId, resourceType]);

  if (!config) {
    return (
      <VendorHubPage className="sa-page" eyebrow="Platform" title="Invalid resource type">
        <Link to="/super-admin/assessments" className="vh-btn vh-btn--ghost">
          Back
        </Link>
      </VendorHubPage>
    );
  }

  const allocatedVendorIds = new Set(
    allocations.map((a) => String(a.vendorId?._id || a.vendorId))
  );

  const availableVendors = vendors.filter(
    (v) => v.isActive !== false && !allocatedVendorIds.has(String(v._id))
  );

  const toggleVendor = (id) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleAllocate = async () => {
    if (!selected.length) return;
    try {
      setSaving(true);
      await axiosInstance.post(`${config.apiBase}/${resourceId}/allocations`, {
        vendorIds: selected,
      });
      setSelected([]);
      load();
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to allocate');
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (vendorId) => {
    if (!window.confirm('Remove this vendor allocation?')) return;
    try {
      await axiosInstance.delete(`${config.apiBase}/${resourceId}/allocations/${vendorId}`);
      load();
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to remove allocation');
    }
  };

  return (
    <VendorHubPage
      className="sa-page"
      loading={loading}
      eyebrow="Platform assessments"
      title={resource?.title ? `Allocate: ${resource.title}` : 'Allocate to vendors'}
      subtitle={`Selected vendors can assign this ${config.label} to students. They cannot edit the content.`}
      accent={section?.accent || SUPER_ADMIN_ACCENT}
      actions={
        <Link to={config.listPath} className="vh-btn vh-btn--ghost">
          <FiArrowLeft /> Back
        </Link>
      }
    >
      <div className="vh-panel">
        <div className="vh-panel-head">
          <div>
            <h2 className="vh-panel-title">Allocated vendors</h2>
            <p className="vh-panel-desc">{allocations.length} vendor(s) currently have access.</p>
          </div>
        </div>
        <div className="vh-panel-body">
          {allocations.length === 0 ? (
            <p className="vh-cell-muted">No vendors allocated yet.</p>
          ) : (
            <ul className="sa-allocation-list">
              {allocations.map((row) => {
                const vendor = row.vendorId;
                return (
                  <li key={String(vendor?._id || row.vendorId)} className="sa-allocation-row">
                    <div>
                      <strong>{vendor?.name || vendor?.companyName || 'Vendor'}</strong>
                      <div className="vh-cell-muted">{vendor?.email || '—'}</div>
                    </div>
                    <button
                      type="button"
                      className="vh-btn vh-btn--ghost vh-btn--sm"
                      style={{ color: '#dc2626' }}
                      onClick={() => handleRemove(vendor?._id || row.vendorId)}
                    >
                      <FiTrash2 /> Remove
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      <div className="vh-panel">
        <div className="vh-panel-head">
          <div>
            <h2 className="vh-panel-title">Add vendors</h2>
            <p className="vh-panel-desc">Vendors not listed here cannot see this assessment.</p>
          </div>
          <button
            type="button"
            className="vh-btn vh-btn--primary"
            disabled={!selected.length || saving}
            onClick={handleAllocate}
          >
            <FiPlus /> Allocate {selected.length ? `(${selected.length})` : ''}
          </button>
        </div>
        <div className="vh-panel-body">
          {availableVendors.length === 0 ? (
            <p className="vh-cell-muted">All active vendors already have access.</p>
          ) : (
            <div className="sa-vendor-pick-grid">
              {availableVendors.map((vendor) => (
                <label key={vendor._id} className="sa-vendor-pick-card">
                  <input
                    type="checkbox"
                    checked={selected.includes(vendor._id)}
                    onChange={() => toggleVendor(vendor._id)}
                  />
                  <span>
                    <strong>{vendor.name || vendor.companyName}</strong>
                    <small>{vendor.email}</small>
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>
      </div>
    </VendorHubPage>
  );
};

export default AllocatePlatformAssessment;
