import React, { useEffect, useState } from 'react';
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
      return alert('Enter a valid credit amount');
    }
    try {
      await axiosInstance.post(`/super-admin/vendors/${vendorId}/interview-credits`, { credits });
      fetchVendors();
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to allocate credits');
    }
  };

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div className="container interview-credits">
      <h1 className="page-title">Interview Credits</h1>
      <div className="credits-table">
        <table className="table">
          <thead>
            <tr>
              <th>Vendor</th>
              <th>Allocated</th>
              <th>Used</th>
              <th>Remaining</th>
              <th>Add Credits</th>
            </tr>
          </thead>
          <tbody>
            {vendors.map(vendor => (
              <tr key={vendor._id}>
                <td>{vendor.companyName}</td>
                <td>{vendor.interviewCredits?.allocated || 0}</td>
                <td>{vendor.interviewCredits?.used || 0}</td>
                <td>{vendor.interviewCredits?.remaining || 0}</td>
                <td className="credits-action">
                  <input
                    type="number"
                    min="0"
                    value={creditsMap[vendor._id] || ''}
                    onChange={(e) => handleChange(vendor._id, e.target.value)}
                  />
                  <button className="btn btn-primary btn-sm" onClick={() => allocateCredits(vendor._id)}>
                    Add
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

export default InterviewCredits;
