import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiPlus, FiBriefcase } from 'react-icons/fi';
import axiosInstance from '../../utils/axios';
import VendorHubPage from '../../components/VendorAdmin/VendorHubPage';
import '../../styles/super-admin-pages.css';

const InterviewCredits = () => {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creditsMap, setCreditsMap] = useState({});
  const [allocatingId, setAllocatingId] = useState(null);

  useEffect(() => {
    fetchVendors();
  }, []);

  const fetchVendors = async () => {
    try {
      setLoading(true);
      const response = await axiosInstance.get('/super-admin/vendors');
      setVendors(response.data || []);
    } catch (error) {
      console.error('Error fetching vendors:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (vendorId, value) => {
    setCreditsMap({ ...creditsMap, [vendorId]: value });
  };

  const allocateCredits = async (vendorId) => {
    const credits = parseInt(creditsMap[vendorId] || '0', 10);
    if (Number.isNaN(credits) || credits < 1) {
      alert('Enter a valid number of credits to add (1 or more).');
      return;
    }
    try {
      setAllocatingId(vendorId);
      await axiosInstance.post(`/super-admin/vendors/${vendorId}/interview-credits`, { credits });
      setCreditsMap((prev) => ({ ...prev, [vendorId]: '' }));
      await fetchVendors();
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to allocate credits');
    } finally {
      setAllocatingId(null);
    }
  };

  const totalAllocated = vendors.reduce((sum, v) => sum + (v.interviewCredits?.allocated ?? 0), 0);
  const totalUsed = vendors.reduce((sum, v) => sum + (v.interviewCredits?.used ?? 0), 0);
  const totalRemaining = vendors.reduce((sum, v) => sum + (v.interviewCredits?.remaining ?? 0), 0);

  return (
    <VendorHubPage
      className="sa-page"
      loading={loading}
      eyebrow="Billing & usage"
      title="Interview credits"
      subtitle="Allocate mock-interview credits to vendor organizations."
      accent="#059669"
      actions={
        <Link to="/super-admin/vendors" className="vh-btn vh-btn--ghost">
          <FiBriefcase /> Vendors
        </Link>
      }
    >
      <p className="sa-credits-note">
        One credit is consumed when a student attempts an interview for <strong>more than 5 minutes</strong>.
        Enter the number of credits to add and click <strong>Add credits</strong> for each vendor.
      </p>

      <div className="vh-stats">
        <div className="vh-stat vh-stat--accent">
          <span className="vh-stat-label">Vendors</span>
          <span className="vh-stat-value">{vendors.length}</span>
        </div>
        <div className="vh-stat">
          <span className="vh-stat-label">Total allocated</span>
          <span className="vh-stat-value">{totalAllocated}</span>
        </div>
        <div className="vh-stat">
          <span className="vh-stat-label">Used</span>
          <span className="vh-stat-value">{totalUsed}</span>
        </div>
        <div className="vh-stat">
          <span className="vh-stat-label">Remaining</span>
          <span className="vh-stat-value">{totalRemaining}</span>
        </div>
      </div>

      <div className="vh-panel">
        <div className="vh-panel-head">
          <div>
            <h2 className="vh-panel-title">Vendor credit balances</h2>
            <p className="vh-panel-desc">Add credits to each organization as needed.</p>
          </div>
        </div>
        <div className="vh-panel-body vh-panel-body--flush">
          {vendors.length === 0 ? (
            <div className="vh-empty">
              <div className="vh-empty-icon">💳</div>
              <h2>No vendors found</h2>
              <p>Create vendors first, then return here to assign interview credits.</p>
              <Link to="/super-admin/vendors" className="vh-btn vh-btn--primary">
                <FiPlus /> Go to vendors
              </Link>
            </div>
          ) : (
            <div className="vh-table-wrap">
              <table className="vh-table">
                <thead>
                  <tr>
                    <th>Vendor / company</th>
                    <th>Allocated</th>
                    <th>Used</th>
                    <th>Remaining</th>
                    <th>Add credits</th>
                  </tr>
                </thead>
                <tbody>
                  {vendors.map((vendor) => (
                    <tr key={vendor._id}>
                      <td>
                        <div className="vh-person-name">{vendor.companyName}</div>
                        <div className="vh-person-email">{vendor.email}</div>
                      </td>
                      <td>{vendor.interviewCredits?.allocated ?? 0}</td>
                      <td>{vendor.interviewCredits?.used ?? 0}</td>
                      <td>
                        <span className="sa-credits-remaining">
                          {vendor.interviewCredits?.remaining ?? 0}
                        </span>
                      </td>
                      <td>
                        <div className="sa-credits-action">
                          <input
                            type="number"
                            min="1"
                            placeholder="Amount"
                            value={creditsMap[vendor._id] ?? ''}
                            onChange={(e) => handleChange(vendor._id, e.target.value)}
                            className="sa-credits-input"
                          />
                          <button
                            type="button"
                            className="vh-btn vh-btn--primary vh-btn--sm"
                            onClick={() => allocateCredits(vendor._id)}
                            disabled={allocatingId === vendor._id}
                          >
                            {allocatingId === vendor._id ? 'Adding…' : 'Add credits'}
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

export default InterviewCredits;
