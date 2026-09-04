import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiBookOpen, FiPlus, FiRefreshCw, FiSearch } from 'react-icons/fi';
import axiosInstance from '../../utils/axios';
import VendorHubPage from '../../components/VendorAdmin/VendorHubPage';
import CourseListCard from '../../components/Courses/CourseListCard';
import { UNLOCK_MODE_OPTIONS } from '../../constants/courseQuizCatalog';
import '../../styles/courses-pages.css';
import '../../styles/super-admin-pages.css';

const COURSES_ACCENT = '#0f766e';

const EMPTY_FORM = {
  title: '',
  description: '',
  level: 'beginner',
  estimatedHours: '',
  unlockMode: 'sequential',
};

const formatDue = (dueAt) => {
  if (!dueAt) return null;
  const d = new Date(dueAt);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

const unlockLabel = (mode) => (mode === 'open' ? 'All modules open' : 'Unlock in order');

const VendorCourses = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [origin, setOrigin] = useState('all');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await axiosInstance.get('/vendor-admin/courses', {
        params: {
          page: 1,
          limit: 50,
          search: search.trim() || undefined,
          origin: origin === 'all' ? undefined : origin,
        },
      });
      setItems(data.items || []);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load courses');
    } finally {
      setLoading(false);
    }
  }, [search, origin]);

  useEffect(() => {
    const t = window.setTimeout(load, search ? 280 : 0);
    return () => window.clearTimeout(t);
  }, [load, search]);

  const stats = useMemo(() => {
    const mine = items.filter((c) => c.canEdit || c.origin === 'vendor').length;
    const platform = items.length - mine;
    const published = items.filter((c) => c.status === 'published').length;
    const enrolled = items.reduce((sum, c) => sum + (c.enrolledCount || 0), 0);
    return { total: items.length, mine, platform, published, enrolled };
  }, [items]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const resetForm = () => {
    setFormData(EMPTY_FORM);
    setError('');
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    const title = formData.title.trim();
    if (!title) {
      setError('Course title is required.');
      return;
    }

    setCreating(true);
    setError('');
    try {
      const payload = {
        title,
        description: formData.description.trim(),
        level: formData.level,
        unlockMode: formData.unlockMode === 'open' ? 'open' : 'sequential',
      };
      if (formData.estimatedHours !== '') {
        payload.estimatedHours = Number(formData.estimatedHours);
      }

      const { data } = await axiosInstance.post('/vendor-admin/courses', payload);
      resetForm();
      setShowForm(false);
      navigate(`/vendor-admin/courses/${data._id}/edit`);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create course');
      setCreating(false);
    }
  };

  return (
    <VendorHubPage
      loading={loading && !items.length && !showForm}
      eyebrow="Learning programs"
      title="Courses"
      subtitle="Create your own curriculum, or assign platform courses allocated by Super Admin."
      accent={COURSES_ACCENT}
      className="courses-page sa-page"
      actions={
        <>
          <button type="button" className="vh-btn vh-btn-ghost" onClick={load}>
            <FiRefreshCw /> Refresh
          </button>
          <button
            type="button"
            className="vh-btn vh-btn--primary"
            onClick={() => {
              setShowForm((v) => !v);
              if (showForm) resetForm();
            }}
          >
            <FiPlus /> {showForm ? 'Cancel' : 'Create course'}
          </button>
        </>
      }
    >
      {error && !showForm && <p className="vh-error">{error}</p>}

      <div className="vh-stats">
        <div className="vh-stat vh-stat--accent">
          <span className="vh-stat-label">Your courses</span>
          <span className="vh-stat-value">{origin === 'all' ? stats.mine : origin === 'vendor' ? stats.total : 0}</span>
        </div>
        <div className="vh-stat">
          <span className="vh-stat-label">Platform catalog</span>
          <span className="vh-stat-value">{origin === 'all' ? stats.platform : origin === 'platform' ? stats.total : 0}</span>
        </div>
        <div className="vh-stat">
          <span className="vh-stat-label">Published</span>
          <span className="vh-stat-value">{stats.published}</span>
        </div>
        <div className="vh-stat">
          <span className="vh-stat-label">Enrollments</span>
          <span className="vh-stat-value">{stats.enrolled}</span>
        </div>
      </div>

      {showForm && (
        <div className="vh-panel sa-courses-create" style={{ marginBottom: 18 }}>
          <div className="vh-panel-head">
            <div>
              <h2 className="vh-panel-title">Create your course</h2>
              <p className="vh-panel-desc">
                Add a title now. Modules, lectures, videos, notes, and optional assessments are built in the editor.
              </p>
            </div>
          </div>
          <div className="vh-panel-body">
            {error && <div className="vh-alert vh-alert--error">{error}</div>}
            <form onSubmit={handleCreate} className="sa-courses-create-layout">
              <div className="vh-form-panel">
                <div className="vh-form-grid vh-form-grid--2">
                  <div className="vh-field">
                    <label htmlFor="course-title">Course title</label>
                    <input
                      id="course-title"
                      name="title"
                      type="text"
                      placeholder="e.g. Campus Java Bootcamp"
                      value={formData.title}
                      onChange={handleChange}
                      required
                      autoFocus
                    />
                  </div>
                  <div className="vh-field">
                    <label htmlFor="course-level">Level</label>
                    <select id="course-level" name="level" value={formData.level} onChange={handleChange}>
                      <option value="beginner">Beginner</option>
                      <option value="intermediate">Intermediate</option>
                      <option value="advanced">Advanced</option>
                    </select>
                  </div>
                </div>

                <div className="vh-field" style={{ marginTop: 16 }}>
                  <label htmlFor="course-description">Description</label>
                  <textarea
                    id="course-description"
                    name="description"
                    rows={4}
                    placeholder="What will students learn? Outline outcomes and who this course is for."
                    value={formData.description}
                    onChange={handleChange}
                  />
                </div>

                <div className="vh-form-grid vh-form-grid--2" style={{ marginTop: 16 }}>
                  <div className="vh-field">
                    <label htmlFor="course-hours">Estimated hours</label>
                    <input
                      id="course-hours"
                      name="estimatedHours"
                      type="number"
                      min="0"
                      step="0.5"
                      placeholder="e.g. 12"
                      value={formData.estimatedHours}
                      onChange={handleChange}
                    />
                  </div>
                </div>

                <div className="vh-field sa-unlock-field" style={{ marginTop: 16 }}>
                  <span className="sa-unlock-label">Module access</span>
                  <div className="sa-unlock-options" role="radiogroup" aria-label="Module access">
                    {UNLOCK_MODE_OPTIONS.map((opt) => {
                      const selected = formData.unlockMode === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          className={`sa-unlock-option ${selected ? 'is-selected' : ''}`}
                          onClick={() => setFormData((prev) => ({ ...prev, unlockMode: opt.id }))}
                        >
                          <strong>{opt.label}</strong>
                          <span>{opt.description}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="vh-form-actions">
                  <button type="submit" className="vh-btn vh-btn--primary" disabled={creating}>
                    <FiPlus /> {creating ? 'Creating…' : 'Create & open editor'}
                  </button>
                  <button
                    type="button"
                    className="vh-btn vh-btn--secondary"
                    onClick={() => {
                      setShowForm(false);
                      resetForm();
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>

              <aside className="sa-courses-preview" aria-label="Course card preview">
                <p className="sa-courses-preview-label">Catalog preview</p>
                <CourseListCard
                  title={formData.title.trim() || 'Course title'}
                  description={formData.description.trim() || 'Add a description so students know what to expect.'}
                  badge="Your course"
                  badgeVariant="vendor"
                  level={formData.level}
                  estimatedHours={formData.estimatedHours !== '' ? Number(formData.estimatedHours) : null}
                  meta={[unlockLabel(formData.unlockMode)]}
                  accent={COURSES_ACCENT}
                />
              </aside>
            </form>
          </div>
        </div>
      )}

      <div className="vc-list-toolbar">
        <div className="courses-tabs" role="tablist" aria-label="Course origin">
          {[
            { id: 'all', label: 'All' },
            { id: 'vendor', label: 'My courses' },
            { id: 'platform', label: 'Platform' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              className={`courses-tab ${origin === tab.id ? 'is-active' : ''}`}
              onClick={() => setOrigin(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="vc-search">
          <FiSearch size={15} />
          <input
            type="search"
            placeholder="Search courses…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {!items.length ? (
        <div className="vh-empty">
          <FiBookOpen size={32} />
          <p>
            {search
              ? 'No courses match your search.'
              : origin === 'platform'
                ? 'No platform courses allocated yet.'
                : origin === 'vendor'
                  ? 'You have not created a course yet.'
                  : 'Create a course or wait for Super Admin to allocate platform courses.'}
          </p>
          {!search && origin !== 'platform' && (
            <button
              type="button"
              className="vh-btn vh-btn--primary"
              onClick={() => setShowForm(true)}
            >
              <FiPlus /> Create course
            </button>
          )}
        </div>
      ) : (
        <div className="courses-grid">
          {items.map((c) => {
            const owned = c.canEdit || c.origin === 'vendor';
            const due = formatDue(c.allocation?.dueAt);
            return (
              <CourseListCard
                key={c._id}
                to={`/vendor-admin/courses/${c._id}`}
                title={c.title}
                description={c.description}
                badge={owned ? c.status || 'draft' : c.allocation?.visibility || 'visible'}
                badgeVariant={
                  owned
                    ? c.status === 'published'
                      ? 'published'
                      : 'draft'
                    : c.allocation?.visibility === 'hidden'
                      ? 'hidden'
                      : 'visible'
                }
                level={c.level}
                estimatedHours={c.estimatedHours}
                meta={[
                  owned ? 'Your course' : 'Platform',
                  unlockLabel(c.unlockMode),
                  `${c.enrolledCount || 0} enrolled`,
                  due ? `Due ${due}` : 'No due date',
                ]}
                accent={COURSES_ACCENT}
                ctaLabel={owned ? 'Manage course' : 'Assign & preview'}
              />
            );
          })}
        </div>
      )}
    </VendorHubPage>
  );
};

export default VendorCourses;
