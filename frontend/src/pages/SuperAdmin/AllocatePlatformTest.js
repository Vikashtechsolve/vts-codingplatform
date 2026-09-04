import React, { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { FiArrowLeft, FiPlus, FiTrash2 } from 'react-icons/fi';
import axiosInstance from '../../utils/axios';
import VendorHubPage from '../../components/VendorAdmin/VendorHubPage';
import { SUPER_ADMIN_ACCENT } from '../../constants/superAdminSections';
import '../../styles/super-admin-pages.css';

const AllocatePlatformTest = () => {
  const { testId } = useParams();
  const [test, setTest] = useState(null);
  const [vendors, setVendors] = useState([]);
  const [allocations, setAllocations] = useState([]);
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const [testRes, vendorRes, allocRes] = await Promise.all([
        axiosInstance.get(`/super-admin/tests/${testId}`),
        axiosInstance.get('/super-admin/vendors'),
        axiosInstance.get(`/super-admin/tests/${testId}/allocations`),
      ]);
      setTest(testRes.data);
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
  }, [testId]);

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
      await axiosInstance.post(`/super-admin/tests/${testId}/allocations`, {
        vendorIds: selected,
      });
      setSelected([]);
      load();
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to allocate test');
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (vendorId) => {
    if (!window.confirm('Remove this vendor allocation?')) return;
    try {
      await axiosInstance.delete(`/super-admin/tests/${testId}/allocations/${vendorId}`);
      load();
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to remove allocation');
    }
  };

  return (
    <VendorHubPage
      className="sa-page"
      loading={loading}
      eyebrow="Platform tests"
      title={test?.title ? `Allocate: ${test.title}` : 'Allocate test'}
      subtitle="Selected vendors can assign this test to their students. They cannot edit the test content."
      accent={SUPER_ADMIN_ACCENT}
      actions={
        <Link to="/super-admin/tests" className="vh-btn vh-btn--ghost">
          <FiArrowLeft /> Back to tests
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
            <p className="vh-panel-desc">Select vendors to grant access to this platform test.</p>
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
            <p className="vh-cell-muted">All active vendors already have this test.</p>
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

export default AllocatePlatformTest;
