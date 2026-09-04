import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiPlus, FiBookOpen, FiRefreshCw, FiSearch } from 'react-icons/fi';
import axiosInstance from '../../utils/axios';
import VendorHubPage from '../../components/VendorAdmin/VendorHubPage';
import CourseListCard from '../../components/Courses/CourseListCard';
import '../../styles/super-admin-pages.css';

const COURSES_ACCENT = '#0f766e';

const EMPTY_FORM = {
  title: '',
  description: '',
  level: 'beginner',
  estimatedHours: '',
};

const Courses = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const fetchCourses = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const { data } = await axiosInstance.get('/super-admin/courses', {
        params: { page: 1, limit: 50 },
      });
      setItems(data.items || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load courses');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

  const stats = useMemo(() => {
    const published = items.filter((c) => c.status === 'published').length;
    const draft = items.filter((c) => c.status === 'draft').length;
    return { total: items.length, published, draft };
  }, [items]);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((c) => {
      if (statusFilter !== 'all' && c.status !== statusFilter) return false;
      if (!q) return true;
      return (
        (c.title || '').toLowerCase().includes(q) ||
        (c.description || '').toLowerCase().includes(q)
      );
    });
  }, [items, search, statusFilter]);

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
      };
      if (formData.estimatedHours !== '') {
        payload.estimatedHours = Number(formData.estimatedHours);
      }

      const { data } = await axiosInstance.post('/super-admin/courses', payload);
      resetForm();
      setShowForm(false);
      navigate(`/super-admin/courses/${data._id}`);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create course');
      setCreating(false);
    }
  };

  return (
    <VendorHubPage
      loading={loading}
      className="sa-page courses-page"
      eyebrow="Platform curriculum"
      title="Courses"
      subtitle="Build structured learning paths with modules, lectures, media, and module quizzes. Publish and allocate to vendors."
      accent={COURSES_ACCENT}
      actions={
        <>
          <button type="button" className="vh-btn vh-btn--ghost" onClick={fetchCourses}>
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
      <div className="vh-stats">
        <div className="vh-stat vh-stat--accent">
          <span className="vh-stat-label">Total courses</span>
          <span className="vh-stat-value">{stats.total}</span>
        </div>
        <div className="vh-stat">
          <span className="vh-stat-label">Published</span>
          <span className="vh-stat-value">{stats.published}</span>
        </div>
        <div className="vh-stat">
          <span className="vh-stat-label">Drafts</span>
          <span className="vh-stat-value">{stats.draft}</span>
        </div>
      </div>

      {showForm && (
        <div className="vh-panel sa-courses-create" style={{ marginBottom: 18 }}>
          <div className="vh-panel-head">
            <div>
              <h2 className="vh-panel-title">Create new course</h2>
              <p className="vh-panel-desc">
                Add a title and description now. Modules, lectures, and media can be added in the editor.
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
                      placeholder="e.g. Full Stack JavaScript"
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
                    rows={5}
                    placeholder="What will students learn? Outline outcomes, prerequisites, and who this course is for."
                    value={formData.description}
                    onChange={handleChange}
                  />
                  <span className="vh-field-hint">
                    Shown on course cards and the student catalog. You can refine this anytime in the editor.
                  </span>
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
                    <span className="vh-field-hint">Optional — helps students plan their time.</span>
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
                  badge="draft"
                  badgeVariant="draft"
                  level={formData.level}
                  estimatedHours={formData.estimatedHours !== '' ? Number(formData.estimatedHours) : null}
                  accent={COURSES_ACCENT}
                />
              </aside>
            </form>
          </div>
        </div>
      )}

      <div className="vh-panel">
        <div className="vh-panel-head">
          <div>
            <h2 className="vh-panel-title">All courses</h2>
            <p className="vh-panel-desc">
              {filteredItems.length} of {items.length} course{items.length !== 1 ? 's' : ''} shown
            </p>
          </div>
        </div>
        <div className="vh-panel-body">
          <div className="vh-toolbar">
            <div className="vh-search">
              <FiSearch size={16} />
              <input
                type="search"
                placeholder="Search by title or description…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search courses"
              />
            </div>
            <select
              className="vh-input"
              style={{ width: 'auto', minWidth: 140, flexShrink: 0 }}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filter by status"
            >
              <option value="all">All statuses</option>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
          </div>

          {!items.length ? (
            <div className="vh-empty">
              <FiBookOpen size={32} />
              <h2>No courses yet</h2>
              <p>Create your first curriculum to get started.</p>
              <button type="button" className="vh-btn vh-btn--primary" onClick={() => setShowForm(true)}>
                <FiPlus /> Create course
              </button>
            </div>
          ) : !filteredItems.length ? (
            <div className="vh-empty">
              <FiSearch size={28} />
              <h2>No matches</h2>
              <p>Try a different search term or status filter.</p>
            </div>
          ) : (
            <div className="courses-grid">
              {filteredItems.map((c) => (
                <CourseListCard
                  key={c._id}
                  to={`/super-admin/courses/${c._id}`}
                  title={c.title}
                  description={c.description}
                  badge={c.status}
                  badgeVariant={c.status}
                  level={c.level}
                  estimatedHours={c.estimatedHours}
                  accent={COURSES_ACCENT}
                  ctaLabel="Edit course"
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </VendorHubPage>
  );
};

export default Courses;
