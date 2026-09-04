import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  FiPlus,
  FiEdit2,
  FiTrash2,
  FiUsers,
  FiGrid,
  FiGlobe,
  FiList,
} from 'react-icons/fi';
import axiosInstance from '../../utils/axios';
import VendorHubPage from '../../components/VendorAdmin/VendorHubPage';
import { SUPER_ADMIN_ACCENT } from '../../constants/superAdminSections';
import {
  PLATFORM_TEST_SECTIONS,
  PLATFORM_TEST_TYPE_LABELS,
  getPlatformTestSectionByType,
} from '../../constants/platformTestSections';
import '../../styles/super-admin-pages.css';

const VALID_TYPES = ['all', ...PLATFORM_TEST_SECTIONS.map((s) => s.testType)];

const FILTER_CHIPS = [
  { id: 'all', label: 'All', icon: FiGrid, accent: SUPER_ADMIN_ACCENT },
  ...PLATFORM_TEST_SECTIONS.map((s) => ({
    id: s.testType,
    label: s.shortLabel,
    icon: s.icon,
    accent: s.accent,
  })),
];

const PlatformTests = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [allTests, setAllTests] = useState([]);
  const [loading, setLoading] = useState(true);

  const typeParam = new URLSearchParams(location.search).get('type');
  const activeType = VALID_TYPES.includes(typeParam) ? typeParam : 'all';

  const fetchTests = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await axiosInstance.get('/super-admin/tests');
      setAllTests(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching platform tests:', error);
      setAllTests([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTests();
  }, [fetchTests]);

  const counts = useMemo(() => {
    const map = { all: allTests.length };
    allTests.forEach((t) => {
      map[t.type] = (map[t.type] || 0) + 1;
    });
    return map;
  }, [allTests]);

  const tests = useMemo(() => {
    if (activeType === 'all') return allTests;
    return allTests.filter((t) => t.type === activeType);
  }, [allTests, activeType]);

  const activeChip = FILTER_CHIPS.find((c) => c.id === activeType) || FILTER_CHIPS[0];
  const dedicatedSection = getPlatformTestSectionByType(activeType);
  const pageAccent = dedicatedSection?.accent || activeChip?.accent || SUPER_ADMIN_ACCENT;
  const currentListPath =
    activeType === 'all' ? '/super-admin/tests' : `/super-admin/tests?type=${activeType}`;

  const primaryAction = dedicatedSection?.actions?.find((a) => a.primary);
  const secondaryActions = (dedicatedSection?.actions || []).filter(
    (action) => !action.primary && action.to !== currentListPath
  );

  const setActiveType = (typeId) => {
    if (typeId === 'all') {
      navigate('/super-admin/tests');
    } else {
      navigate(`/super-admin/tests?type=${typeId}`);
    }
  };

  const getEditPath = (test) => {
    if (test.type === 'english') return `/super-admin/tests/english/edit/${test._id}`;
    if (test.type === 'sql') return `/super-admin/tests/sql/edit/${test._id}`;
    return `/super-admin/tests/edit/${test._id}?type=${test.type}`;
  };

  const getQuestionsPath = (test) => {
    if (test.type === 'sql') return `/super-admin/tests/sql/${test._id}/questions`;
    return getEditPath(test);
  };

  const handleDelete = async (id, title) => {
    if (!window.confirm(`Delete platform test "${title}"?`)) return;
    try {
      await axiosInstance.delete(`/super-admin/tests/${id}`);
      fetchTests();
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to delete test');
    }
  };

  return (
    <VendorHubPage
      className="sa-page"
      loading={loading}
      eyebrow="Platform assessments"
      title={dedicatedSection ? dedicatedSection.label : 'Platform tests'}
      subtitle={
        dedicatedSection
          ? dedicatedSection.description
          : 'Create tests from the global question bank and allocate them to vendors. No schedule windows — vendors assign to students.'
      }
      accent={pageAccent}
      actions={
        primaryAction ? (
          <Link to={primaryAction.to} className="vh-btn vh-btn--primary">
            <FiPlus /> {primaryAction.label}
          </Link>
        ) : (
          <Link to="/super-admin/tests/create?type=mixed" className="vh-btn vh-btn--primary">
            <FiPlus /> Create mixed test
          </Link>
        )
      }
    >
      <div className="vh-chips">
        {FILTER_CHIPS.map((chip) => {
          const Icon = chip.icon;
          return (
            <button
              key={chip.id}
              type="button"
              className={`vh-chip ${activeType === chip.id ? 'active' : ''}`}
              onClick={() => setActiveType(chip.id)}
            >
              <Icon /> {chip.label}
              <span className="vh-chip-count">{counts[chip.id] || 0}</span>
            </button>
          );
        })}
      </div>

      {secondaryActions.length > 0 && (
        <div className="sa-platform-secondary-actions">
          {secondaryActions.map((action) => (
            <Link key={action.label} to={action.to} className="vh-btn vh-btn--ghost vh-btn--sm">
              {action.label}
            </Link>
          ))}
        </div>
      )}

      {activeType === 'all' && (
        <section className="sa-platform-sections">
          <div className="sa-platform-sections-head">
            <h2 className="sa-section-title">Assessment types</h2>
            <p className="sa-platform-sections-sub">
              Create any test type from the global bank, then allocate to vendors as needed.
            </p>
          </div>
          <div className="sa-platform-type-cards">
            {PLATFORM_TEST_SECTIONS.map((section) => {
              const Icon = section.icon;
              const count = counts[section.testType] || 0;
              return (
                <article
                  key={section.id}
                  className="sa-platform-type-card"
                  style={{ '--type-accent': section.accent }}
                >
                  <div className="sa-platform-type-card-top">
                    <span className="sa-platform-type-icon">
                      <Icon />
                    </span>
                    <div>
                      <h3>{section.label}</h3>
                      <span className="sa-platform-type-count">
                        <strong>{count}</strong> platform test{count !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                  <p className="sa-platform-type-desc">{section.description}</p>
                  <div className="sa-platform-type-actions">
                    {section.actions.map((action) => (
                      <Link
                        key={action.label}
                        to={action.to}
                        className={action.primary ? 'vh-btn vh-btn--primary vh-btn--sm' : 'vh-btn vh-btn--ghost vh-btn--sm'}
                      >
                        {action.label}
                      </Link>
                    ))}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      <div className="vh-panel">
        <div className="vh-panel-head">
          <div>
            <h2 className="vh-panel-title">
              {activeType === 'all' ? 'All platform tests' : `${PLATFORM_TEST_TYPE_LABELS[activeType] || activeType} tests`}
            </h2>
            <p className="vh-panel-desc">
              {tests.length} test{tests.length !== 1 ? 's' : ''} available for vendor allocation.
            </p>
          </div>
        </div>
        <div className="vh-panel-body vh-panel-body--flush">
          {tests.length === 0 ? (
            <div className="vh-empty">
              <div className="vh-empty-icon">📝</div>
              <h2>No platform tests yet</h2>
              <p>
                {activeType === 'all'
                  ? 'Pick an assessment type above or use the create button to get started.'
                  : `Create a ${PLATFORM_TEST_TYPE_LABELS[activeType]?.toLowerCase() || activeType} test from the global question bank.`}
              </p>
              {primaryAction && (
                <Link to={primaryAction.to} className="vh-btn vh-btn--primary">
                  <FiPlus /> {primaryAction.label}
                </Link>
              )}
            </div>
          ) : (
            <div className="vh-table-wrap">
              <table className="vh-table">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Type</th>
                    <th>Duration</th>
                    <th>Questions</th>
                    <th>Vendors</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {tests.map((test) => (
                    <tr key={test._id}>
                      <td>
                        <div className="vh-person-name">{test.title}</div>
                        <div className="vh-cell-muted sa-truncate">{test.description || '—'}</div>
                      </td>
                      <td>
                        <span className="vh-badge vh-badge--global">
                          {PLATFORM_TEST_TYPE_LABELS[test.type] || test.type}
                        </span>
                      </td>
                      <td>{test.duration} min</td>
                      <td>{test.questions?.length || 0}</td>
                      <td>{test.allocatedVendorCount || 0}</td>
                      <td>
                        <span className={`vh-badge ${test.isActive ? 'vh-badge--easy' : 'vh-badge--hard'}`}>
                          {test.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>
                        <div className="sa-cell-actions">
                          <Link
                            to={`/super-admin/tests/${test._id}/allocate`}
                            className="vh-btn vh-btn--ghost vh-btn--sm"
                          >
                            <FiUsers /> Allocate
                          </Link>
                          <Link
                            to={getQuestionsPath(test)}
                            className="vh-btn vh-btn--ghost vh-btn--sm"
                          >
                            <FiList /> Questions
                          </Link>
                          <Link to={getEditPath(test)} className="vh-btn vh-btn--ghost vh-btn--sm">
                            <FiEdit2 /> Edit
                          </Link>
                          <button
                            type="button"
                            className="vh-btn vh-btn--ghost vh-btn--sm"
                            style={{ color: '#dc2626' }}
                            onClick={() => handleDelete(test._id, test.title)}
                          >
                            <FiTrash2 />
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

      <div className="sa-info-panel">
        <FiGlobe />
        <div>
          <strong>Global question bank</strong>
          <p>
            Platform tests use questions from the{' '}
            <Link to="/super-admin/global-questions">global bank</Link> only. Vendors see those
            questions in their Global tab when building their own tests too.
          </p>
        </div>
      </div>
    </VendorHubPage>
  );
};

export default PlatformTests;
