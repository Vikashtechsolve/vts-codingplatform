import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axiosInstance from '../../utils/axios';
import './InterviewCredits.css';

const InterviewCredits = () => {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creditsMap, setCreditsMap] = useState({});

  useEffect(() => {
    fetchVendors();
  }, []);

  const fetchVendors = async () => {
    try {
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
    if (Number.isNaN(credits) || credits < 0) {
      alert('Please enter a valid number (0 or more).');
      return;
    }
    if (credits === 0) {
      alert('Please enter the number of credits to add (e.g. 10, 50).');
      return;
    }
    try {
      await axiosInstance.post(`/super-admin/vendors/${vendorId}/interview-credits`, { credits });
      setCreditsMap(prev => ({ ...prev, [vendorId]: '' }));
      await fetchVendors();
      alert(`Successfully added ${credits} credit(s) to vendor.`);
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to allocate credits');
    }
  };

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div className="container interview-credits">
      <h1 className="page-title">Assign Interview Credits to Vendors</h1>
      <p className="credits-note">
        Assign interview credits to each vendor. One credit is consumed when a student attempts an interview for <strong>more than 5 minutes</strong>. Enter the number of credits to add and click <strong>Add credits</strong>.
      </p>
      {vendors.length === 0 ? (
        <div className="credits-empty-state">
          <p>No vendors found. Create vendors first from <strong>Vendors</strong>, then return here to assign interview credits.</p>
          <Link to="/super-admin/vendors" className="btn btn-primary">Go to Vendors</Link>
        </div>
      ) : (
        <div className="credits-table">
          <table className="table">
            <thead>
              <tr>
                <th>Vendor / Company</th>
                <th>Allocated</th>
                <th>Used</th>
                <th>Remaining</th>
                <th>Assign credits</th>
              </tr>
            </thead>
            <tbody>
              {vendors.map(vendor => (
                <tr key={vendor._id}>
                  <td><strong>{vendor.companyName}</strong></td>
                  <td>{vendor.interviewCredits?.allocated ?? 0}</td>
                  <td>{vendor.interviewCredits?.used ?? 0}</td>
                  <td>{vendor.interviewCredits?.remaining ?? 0}</td>
                  <td className="credits-action">
                    <input
                      type="number"
                      min="1"
                      placeholder="Amount"
                      value={creditsMap[vendor._id] ?? ''}
                      onChange={(e) => handleChange(vendor._id, e.target.value)}
                      className="credits-input"
                    />
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => allocateCredits(vendor._id)}
                    >
                      Add credits
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default InterviewCredits;
