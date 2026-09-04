import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  FiPlus,
  FiEdit2,
  FiTrash2,
  FiUsers,
  FiGrid,
} from 'react-icons/fi';
import axiosInstance from '../../utils/axios';
import VendorHubPage from '../../components/VendorAdmin/VendorHubPage';
import { SUPER_ADMIN_ACCENT } from '../../constants/superAdminSections';
import {
  PLATFORM_EXTENDED_SECTIONS,
  PLATFORM_EXTENDED_LABELS,
  getPlatformExtendedSection,
} from '../../constants/platformAssessmentSections';
import '../../styles/super-admin-pages.css';

// idField must match the route segments registered in SuperAdminRoutes.js
const TYPE_MAP = {
  interview: { api: '/super-admin/interviews', idField: 'interviews' },
  project: { api: '/super-admin/assignments', idField: 'assignments' },
  system: { api: '/super-admin/system-design-problems', idField: 'system-design' },
};

const VALID_TYPES = ['all', 'interview', 'project', 'system'];

const FILTER_CHIPS = [
  { id: 'all', label: 'All', icon: FiGrid, accent: SUPER_ADMIN_ACCENT },
  ...PLATFORM_EXTENDED_SECTIONS.map((s) => ({
    id: s.id,
    label: s.shortLabel,
    icon: s.icon,
    accent: s.accent,
  })),
];

const PlatformAssessments = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [itemsByType, setItemsByType] = useState({ interview: [], project: [], system: [] });
  const [loading, setLoading] = useState(true);

  const typeParam = new URLSearchParams(location.search).get('type');
  const activeType = VALID_TYPES.includes(typeParam) ? typeParam : 'all';

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      const [interviews, assignments, system] = await Promise.all([
        axiosInstance.get('/super-admin/interviews'),
        axiosInstance.get('/super-admin/assignments'),
        axiosInstance.get('/super-admin/system-design-problems'),
      ]);
      setItemsByType({
        interview: Array.isArray(interviews.data) ? interviews.data : [],
        project: Array.isArray(assignments.data) ? assignments.data : [],
        system: Array.isArray(system.data) ? system.data : [],
      });
    } catch (error) {
      console.error('Error fetching platform assessments:', error);
      setItemsByType({ interview: [], project: [], system: [] });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const allItems = useMemo(() => {
    const normalized = [
      ...itemsByType.interview.map((i) => ({ ...i, kind: 'interview' })),
      ...itemsByType.project.map((i) => ({ ...i, kind: 'project' })),
      ...itemsByType.system.map((i) => ({ ...i, kind: 'system' })),
    ];
    return normalized.sort(
      (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
    );
  }, [itemsByType]);

  const counts = useMemo(
    () => ({
      all: allItems.length,
      interview: itemsByType.interview.length,
      project: itemsByType.project.length,
      system: itemsByType.system.length,
    }),
    [allItems, itemsByType]
  );

  const items =
    activeType === 'all' ? allItems : allItems.filter((i) => i.kind === activeType);

  const dedicatedSection = getPlatformExtendedSection(activeType);
  const pageAccent = dedicatedSection?.accent || SUPER_ADMIN_ACCENT;
  const primaryAction = dedicatedSection?.actions?.find((a) => a.primary);

  const setActiveType = (typeId) => {
    navigate(typeId === 'all' ? '/super-admin/assessments' : `/super-admin/assessments?type=${typeId}`);
  };

  const getEditPath = (item) => {
    const map = TYPE_MAP[item.kind];
    return `/super-admin/assessments/${map.idField}/edit/${item._id}`;
  };

  const getAllocatePath = (item) => {
    const map = TYPE_MAP[item.kind];
    return `/super-admin/assessments/${map.idField}/${item._id}/allocate`;
  };

  const handleDelete = async (item) => {
    const map = TYPE_MAP[item.kind];
    if (!window.confirm(`Delete "${item.title}"?`)) return;
    try {
      await axiosInstance.delete(`${map.api}/${item._id}`);
      fetchAll();
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to delete');
    }
  };

  const getSubtitle = (item) => {
    if (item.kind === 'interview') {
      return `${item.interviewType || '—'} · ${item.topic || '—'}`;
    }
    if (item.kind === 'project') {
      return `${item.category || '—'} · ${item.difficulty || '—'}`;
    }
    return `${item.category || '—'} · ${item.difficulty || '—'}`;
  };

  return (
    <VendorHubPage
      className="sa-page"
      loading={loading}
      eyebrow="Platform assessments"
      title={dedicatedSection ? dedicatedSection.label : 'Interviews, projects & system design'}
      subtitle={
        dedicatedSection
          ? dedicatedSection.description
          : 'Create platform-owned assessments for courses and vendor allocation. Vendors only see these after you allocate them — question banks remain visible separately.'
      }
      accent={pageAccent}
      actions={
        primaryAction ? (
          <Link to={primaryAction.to} className="vh-btn vh-btn--primary">
            <FiPlus /> {primaryAction.label}
          </Link>
        ) : null
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

      {activeType === 'all' && (
        <section className="sa-platform-sections">
          <div className="sa-platform-sections-head">
            <h2 className="sa-section-title">Assessment types</h2>
            <p className="sa-platform-sections-sub">
              Use in courses or allocate to vendors. Vendors cannot edit platform content.
            </p>
          </div>
          <div className="sa-platform-type-cards">
            {PLATFORM_EXTENDED_SECTIONS.map((section) => {
              const Icon = section.icon;
              const count = counts[section.id] || 0;
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
                        <strong>{count}</strong> platform item{count !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                  <p className="sa-platform-type-desc">{section.description}</p>
                  <div className="sa-platform-type-actions">
                    {section.actions.map((action) => (
                      <Link
                        key={action.label}
                        to={action.to}
                        className={
                          action.primary
                            ? 'vh-btn vh-btn--primary vh-btn--sm'
                            : 'vh-btn vh-btn--ghost vh-btn--sm'
                        }
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
              {activeType === 'all'
                ? 'All platform assessments'
                : `${PLATFORM_EXTENDED_LABELS[activeType] || activeType} library`}
            </h2>
            <p className="vh-panel-desc">
              {items.length} item{items.length !== 1 ? 's' : ''} — allocate to vendors or attach in course modules.
            </p>
          </div>
        </div>
        <div className="vh-panel-body vh-panel-body--flush">
          {items.length === 0 ? (
            <div className="vh-empty">
              <div className="vh-empty-icon">📋</div>
              <h2>No platform assessments yet</h2>
              <p>Create interviews, AI projects, or system design problems for courses and vendor allocation.</p>
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
                    <th>Details</th>
                    <th>Vendors</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={`${item.kind}-${item._id}`}>
                      <td>
                        <div className="vh-person-name">{item.title}</div>
                        <div className="vh-cell-muted sa-truncate">{item.description || '—'}</div>
                      </td>
                      <td>
                        <span className="vh-badge vh-badge--global">
                          {PLATFORM_EXTENDED_LABELS[item.kind] || item.kind}
                        </span>
                      </td>
                      <td className="vh-cell-muted">{getSubtitle(item)}</td>
                      <td>{item.allocatedVendorCount || 0}</td>
                      <td>
                        <span
                          className={`vh-badge ${
                            item.isActive !== false && item.status !== 'archived'
                              ? 'vh-badge--easy'
                              : 'vh-badge--hard'
                          }`}
                        >
                          {item.status || (item.isActive !== false ? 'Active' : 'Inactive')}
                        </span>
                      </td>
                      <td>
                        <div className="sa-cell-actions">
                          <Link to={getAllocatePath(item)} className="vh-btn vh-btn--ghost vh-btn--sm">
                            <FiUsers /> Allocate
                          </Link>
                          <Link to={getEditPath(item)} className="vh-btn vh-btn--ghost vh-btn--sm">
                            <FiEdit2 /> Edit
                          </Link>
                          <button
                            type="button"
                            className="vh-btn vh-btn--ghost vh-btn--sm"
                            style={{ color: '#dc2626' }}
                            onClick={() => handleDelete(item)}
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
    </VendorHubPage>
  );
};

export default PlatformAssessments;
