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

// Normalize assignment to same shape as test for unified UI (kind: 'assignment', type: 'project')
const normalizeAssignment = (a) => ({
  _id: a._id,
  title: a.title,
  type: 'project',
  kind: 'assignment',
  duration: a.duration,
  questions: [],
  isActive: a.status !== 'archived',
  category: a.category,
  difficulty: a.difficulty,
  totalMarks: a.totalMarks,
  totalSubmitted: a.totalSubmitted || 0
});

// Normalize system design problem to same shape as test for unified UI
const normalizeSystemDesign = (sd) => ({
  _id: sd._id,
  title: sd.title,
  type: 'system',
  kind: 'system_design',
  duration: sd.duration,
  questions: [],
  isActive: sd.isActive !== false,
  category: sd.category,
  difficulty: sd.difficulty,
  totalAssigned: sd.totalAssigned || 0,
  totalSubmitted: sd.totalSubmitted || 0
});

const TestList = () => {
  const [tests, setTests] = useState([]);
  const [interviews, setInterviews] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [systemDesigns, setSystemDesigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const location = useLocation();
  const navigate = useNavigate();
  const typeParam = new URLSearchParams(location.search).get('type');
  const activeType = ['coding', 'mcq', 'aptitude', 'theory', 'mixed', 'sql', 'english', 'interview', 'project', 'system'].includes(typeParam) ? typeParam : 'all';

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [testsRes, interviewsRes, assignmentsRes, systemDesignRes] = await Promise.all([
        axiosInstance.get('/vendor-admin/tests'),
        axiosInstance.get('/interviews').catch(() => ({ data: [] })),
        axiosInstance.get('/assignments').catch(() => ({ data: [] })),
        axiosInstance.get('/system-design-problems').catch(() => ({ data: { problems: [] } }))
      ]);
      setTests(Array.isArray(testsRes.data) ? testsRes.data : []);
      setInterviews(Array.isArray(interviewsRes?.data) ? interviewsRes.data : []);
      setAssignments(assignmentsRes?.data?.assignments ?? []);
      setSystemDesigns(systemDesignRes?.data?.problems ?? []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const allItems = useMemo(() => {
    const testItems = (tests || []).map(t => ({ ...t, kind: 'test' }));
    const interviewItems = (interviews || []).map(normalizeInterview);
    const assignmentItems = (assignments || []).map(normalizeAssignment);
    const systemDesignItems = (systemDesigns || []).map(normalizeSystemDesign);
    return [...testItems, ...interviewItems, ...assignmentItems, ...systemDesignItems];
  }, [tests, interviews, assignments, systemDesigns]);

  const handleDelete = async (item) => {
    const isInterview = item.kind === 'interview';
    const isAssignment = item.kind === 'assignment';
    const isSystemDesign = item.kind === 'system_design';
    const label = isInterview ? 'interview test' : isAssignment ? 'project assignment' : isSystemDesign ? 'system design problem' : 'test';
    const confirmMsg = isAssignment && (item.totalSubmitted || 0) > 0
      ? `Are you sure you want to delete this assignment? ${item.totalSubmitted} submission(s) and all related results will be permanently deleted. This cannot be undone.`
      : isSystemDesign
        ? 'Are you sure you want to delete this system design problem? All submissions will be permanently deleted.'
        : `Are you sure you want to delete this ${label}?`;
    if (!window.confirm(confirmMsg)) return;
    try {
      if (isInterview) {
        await axiosInstance.delete(`/interviews/${item._id}`);
      } else if (isAssignment) {
        await axiosInstance.delete(`/assignments/${item._id}`);
      } else if (isSystemDesign) {
        await axiosInstance.delete(`/system-design-problems/${item._id}`);
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
      sql: allItems.filter(t => t.type === 'sql'),
      english: allItems.filter(t => t.type === 'english'),
      interview: allItems.filter(t => t.type === 'interview'),
      project: allItems.filter(t => t.type === 'project'),
      system: allItems.filter(t => t.type === 'system')
    };
    return map;
  }, [allItems]);

  const filteredTests = testsByType[activeType] || allItems;

  const getCreateLink = () => {
    if (activeType === 'interview') return '/vendor-admin/interviews/create';
    if (activeType === 'sql') return '/vendor-admin/sql-tests/create';
    if (activeType === 'english') return '/vendor-admin/english-tests/create';
    if (activeType === 'project') return '/vendor-admin/create-assignment';
    if (activeType === 'system') return '/vendor-admin/system-designs/create';
    return activeType !== 'all' ? `/vendor-admin/tests/create?type=${activeType}` : '/vendor-admin/tests/create';
  };

  const getAssignLink = (item) => {
    if (item.kind === 'interview') return `/vendor-admin/interviews/${item._id}/assign`;
    if (item.kind === 'assignment') return `/vendor-admin/assignments/${item._id}/assign`;
    if (item.kind === 'system_design') return `/vendor-admin/system-designs/${item._id}/assign`;
    return `/vendor-admin/tests/${item._id}/assign`;
  };

  const getResultsLink = (item) => {
    if (item.kind === 'interview') return `/vendor-admin/interviews/${item._id}/results`;
    if (item.kind === 'assignment') return `/vendor-admin/assignments/${item._id}/submissions`;
    if (item.kind === 'system_design') return `/vendor-admin/system-designs/${item._id}/submissions`;
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
        {['all', 'coding', 'aptitude', 'mcq', 'theory', 'mixed', 'sql', 'english', 'project', 'interview', 'system'].map(type => (
          <button
            key={type}
            className={`test-type-filter-card ${activeType === type ? 'active' : ''}`}
            onClick={() => navigate(type === 'all' ? '/vendor-admin/tests' : `/vendor-admin/tests?type=${type}`)}
          >
            <div className="filter-title">
              {type === 'interview' ? 'INTERVIEW' :
               type === 'sql' ? 'SQL' :
               type === 'english' ? 'VERBAL & ENGLISH' :
               type === 'project' ? 'PROJECT (AI)' :
               type === 'system' ? 'SYSTEM DESIGN' :
               type.toUpperCase()}
            </div>
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
                {item.kind !== 'assignment' && item.kind !== 'system_design' && (
                  <div className="test-meta-item-list">
                    <strong>Questions:</strong> {item.questions?.length || 0}
                  </div>
                )}
                {item.kind === 'interview' && item.topic && (
                  <div className="test-meta-item-list">
                    <strong>Topic:</strong> {item.topic}
                  </div>
                )}
                {item.kind === 'assignment' && (
                  <>
                    <div className="test-meta-item-list">
                      <strong>Category:</strong> {item.category}
                    </div>
                    <div className="test-meta-item-list">
                      <strong>Difficulty:</strong> {item.difficulty}
                    </div>
                    <div className="test-meta-item-list">
                      <strong>Total Marks:</strong> {item.totalMarks}
                    </div>
                  </>
                )}
                {item.kind === 'system_design' && (
                  <>
                    <div className="test-meta-item-list">
                      <strong>Category:</strong> {item.category}
                    </div>
                    <div className="test-meta-item-list">
                      <strong>Difficulty:</strong> {item.difficulty}
                    </div>
                    <div className="test-meta-item-list">
                      <strong>Assigned:</strong> {item.totalAssigned || 0}
                    </div>
                  </>
                )}
              </div>

              <div className="test-actions-list">
                {item.type === 'sql' && (
                  <Link to={`/vendor-admin/sql-tests/${item._id}/questions`} className="test-action-btn-list btn-secondary">
                    Questions
                  </Link>
                )}
                {item.type === 'english' && (
                  <Link to={`/vendor-admin/english-tests/edit/${item._id}`} className="test-action-btn-list btn-secondary">
                    Edit
                  </Link>
                )}
                {item.kind === 'assignment' && (
                  <>
                    <Link to={`/vendor-admin/assignments/${item._id}`} className="test-action-btn-list btn-secondary">
                      View Details
                    </Link>
                    <Link to={`/vendor-admin/assignments/${item._id}/edit`} className="test-action-btn-list btn-secondary">
                      Edit
                    </Link>
                  </>
                )}
                {item.kind === 'system_design' && (
                  <Link to={`/vendor-admin/system-designs/${item._id}/edit`} className="test-action-btn-list btn-secondary">
                    Edit
                  </Link>
                )}
                <Link to={getAssignLink(item)} className="test-action-btn-list btn-primary">
                  Assign
                </Link>
                <Link to={getResultsLink(item)} className="test-action-btn-list btn-secondary">
                  {item.kind === 'assignment' ? 'Submissions' : item.kind === 'system_design' ? 'Submissions' : 'Results'}
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
