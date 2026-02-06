import React, { useState, useEffect, useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import axiosInstance from '../../utils/axios';
import './VendorAdminCommon.css';
import './TestList.css';

// Normalize interview to same shape as test for unified UI (kind: 'interview', type: 'interview')
const normalizeInterview = (i) => ({
  _id: i._id,
  title: i.title,
  type: 'interview',
  kind: 'interview',
  duration: i.duration,
  questions: i.questions || [],
  isActive: i.isActive !== false,
  interviewType: i.interviewType,
  topic: i.topic
});

const TestList = () => {
  const [tests, setTests] = useState([]);
  const [interviews, setInterviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const location = useLocation();
  const navigate = useNavigate();
  const typeParam = new URLSearchParams(location.search).get('type');
  const activeType = ['coding', 'mcq', 'aptitude', 'theory', 'mixed', 'interview'].includes(typeParam) ? typeParam : 'all';

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [testsRes, interviewsRes] = await Promise.all([
        axiosInstance.get('/vendor-admin/tests'),
        axiosInstance.get('/interviews').catch(() => ({ data: [] }))
      ]);
      setTests(Array.isArray(testsRes.data) ? testsRes.data : []);
      setInterviews(Array.isArray(interviewsRes?.data) ? interviewsRes.data : []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const allItems = useMemo(() => {
    const testItems = (tests || []).map(t => ({ ...t, kind: 'test' }));
    const interviewItems = (interviews || []).map(normalizeInterview);
    return [...testItems, ...interviewItems];
  }, [tests, interviews]);

  const handleDelete = async (item) => {
    const isInterview = item.kind === 'interview';
    const label = isInterview ? 'test' : 'test';
    if (!window.confirm(`Are you sure you want to delete this ${label}?`)) return;
    try {
      if (isInterview) {
        await axiosInstance.delete(`/interviews/${item._id}`);
      } else {
        await axiosInstance.delete(`/tests/${item._id}`);
      }
      fetchData();
    } catch (e) {
      alert(e.response?.data?.message || 'Error deleting');
    }
  };

  const testsByType = useMemo(() => {
    const map = {
      all: allItems,
      coding: allItems.filter(t => t.type === 'coding'),
      mcq: allItems.filter(t => t.type === 'mcq'),
      aptitude: allItems.filter(t => t.type === 'aptitude'),
      theory: allItems.filter(t => t.type === 'theory'),
      mixed: allItems.filter(t => t.type === 'mixed'),
      interview: allItems.filter(t => t.type === 'interview')
    };
    return map;
  }, [allItems]);

  const filteredTests = testsByType[activeType] || allItems;

  const getCreateLink = () => {
    if (activeType === 'interview') return '/vendor-admin/interviews/create';
    return activeType !== 'all' ? `/vendor-admin/tests/create?type=${activeType}` : '/vendor-admin/tests/create';
  };

  const getAssignLink = (item) => {
    if (item.kind === 'interview') return `/vendor-admin/interviews/${item._id}/assign`;
    return `/vendor-admin/tests/${item._id}/assign`;
  };

  const getResultsLink = (item) => {
    if (item.kind === 'interview') return `/vendor-admin/interviews/${item._id}/results`;
    return `/vendor-admin/tests/${item._id}/results`;
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="container test-list-page">
      <div className="page-header">
        <h1 className="page-title">Tests</h1>
        <Link to={getCreateLink()} className="btn btn-primary">
          ➕ Create Test
        </Link>
      </div>

      <div className="test-type-filter-grid">
        {['all', 'coding', 'aptitude', 'mcq', 'theory', 'mixed', 'interview'].map(type => (
          <button
            key={type}
            className={`test-type-filter-card ${activeType === type ? 'active' : ''}`}
            onClick={() => navigate(type === 'all' ? '/vendor-admin/tests' : `/vendor-admin/tests?type=${type}`)}
          >
            <div className="filter-title">{type === 'interview' ? 'INTERVIEW' : type.toUpperCase()}</div>
            <div className="filter-count">{testsByType[type]?.length || 0}</div>
          </button>
        ))}
      </div>

      {filteredTests.length === 0 ? (
        <div className="empty-state-modern">
          <div className="empty-state-icon-modern">📝</div>
          <h2>No Tests Yet</h2>
          <p>Create your first {activeType !== 'all' ? (activeType === 'interview' ? 'interview' : activeType) : ''} test to get started.</p>
          <Link to={getCreateLink()} className="btn btn-primary">
            Create Test
          </Link>
        </div>
      ) : (
        <div className="tests-grid-modern">
          {filteredTests.map(item => (
            <div key={item._id} className="test-card-list">
              <div className="test-card-header-list">
                <div className="test-title-list">
                  <h3>{item.title}</h3>
                  <span className={`test-type-badge-modern ${item.type}`}>
                    {item.type.toUpperCase()}
                  </span>
                </div>
                <span className={`status-badge-modern ${item.isActive ? 'active' : 'inactive'}`}>
                  {item.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>

              <div className="test-meta-list">
                <div className="test-meta-item-list">
                  <strong>Duration:</strong> {item.duration} min
                </div>
                <div className="test-meta-item-list">
                  <strong>Questions:</strong> {item.questions?.length || 0}
                </div>
                {item.kind === 'interview' && item.topic && (
                  <div className="test-meta-item-list">
                    <strong>Topic:</strong> {item.topic}
                  </div>
                )}
              </div>

              <div className="test-actions-list">
                <Link to={getAssignLink(item)} className="test-action-btn-list btn-primary">
                  Assign
                </Link>
                <Link to={getResultsLink(item)} className="test-action-btn-list btn-secondary">
                  Results
                </Link>
                <button onClick={() => handleDelete(item)} className="test-action-btn-list btn-danger">
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TestList;
