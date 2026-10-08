import React, { useEffect, useMemo, useState } from 'react';
import { FiCheck, FiEdit2, FiEye, FiEyeOff, FiPlus, FiSearch, FiTrash2, FiX } from 'react-icons/fi';
import axiosInstance from '../../../utils/axios';
import VendorHubPage from '../../../components/VendorAdmin/VendorHubPage';
import { SUPER_ADMIN_ACCENT } from '../../../constants/superAdminSections';
import '../../../styles/super-admin-pages.css';
import '../../../styles/super-admin-practice.css';

const CATEGORIES = [
  { id: 'fundamentals', label: 'Fundamentals' },
  { id: 'intermediate', label: 'Intermediate' },
  { id: 'advanced', label: 'Advanced' },
];

const EMPTY_FORM = { label: '', slug: '', category: 'fundamentals', order: '' };

const slugify = (value) =>
  String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const PracticeTopicsAdmin = () => {
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [slugTouched, setSlugTouched] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState({ label: '', slug: '', category: 'fundamentals', order: 0 });
  const [busyId, setBusyId] = useState(null);

  const load = () => {
    setLoading(true);
    axiosInstance
      .get('/super-admin/practice/topics')
      .then((res) => setTopics(res.data || []))
      .catch((err) => setError(err.response?.data?.message || 'Failed to load topics'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const stats = useMemo(() => {
    const active = topics.filter((t) => t.isActive !== false).length;
    return {
      total: topics.length,
      active,
      hidden: topics.length - active,
    };
  }, [topics]);

  const grouped = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = topics.filter((t) => {
      if (categoryFilter !== 'all' && t.category !== categoryFilter) return false;
      if (!q) return true;
      return (
        (t.label || '').toLowerCase().includes(q) ||
        (t.slug || '').toLowerCase().includes(q)
      );
    });
    return CATEGORIES.map((cat) => ({
      ...cat,
      items: filtered
        .filter((t) => t.category === cat.id)
        .sort((a, b) => (a.order || 0) - (b.order || 0) || a.label.localeCompare(b.label)),
    })).filter((cat) => cat.items.length || categoryFilter === cat.id);
  }, [topics, search, categoryFilter]);

  const handleLabelChange = (label) => {
    setForm((prev) => ({
      ...prev,
      label,
      slug: slugTouched ? prev.slug : slugify(label),
    }));
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    const label = form.label.trim();
    const slug = slugify(form.slug || label);
    if (!label || !slug) {
      setError('Label and slug are required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await axiosInstance.post('/super-admin/practice/topics', {
        label,
        slug,
        category: form.category,
        order: form.order === '' ? topics.length + 1 : Number(form.order) || 0,
      });
      setForm(EMPTY_FORM);
      setSlugTouched(false);
      setShowForm(false);
      load();
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.errors?.[0]?.msg || 'Could not add topic');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (topic) => {
    setEditingId(topic._id);
    setEditDraft({
      label: topic.label,
      slug: topic.slug,
      category: topic.category,
      order: topic.order ?? 0,
    });
  };

  const saveEdit = async (id) => {
    setBusyId(id);
    setError('');
    try {
      const { data } = await axiosInstance.put(`/super-admin/practice/topics/${id}`, {
        label: editDraft.label.trim(),
        slug: slugify(editDraft.slug),
        category: editDraft.category,
        order: Number(editDraft.order) || 0,
      });
      setTopics((prev) => prev.map((t) => (t._id === id ? { ...t, ...data } : t)));
      setEditingId(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save topic');
    } finally {
      setBusyId(null);
    }
  };

  const toggleActive = async (topic) => {
    setBusyId(topic._id);
    try {
      const { data } = await axiosInstance.put(`/super-admin/practice/topics/${topic._id}`, {
        isActive: topic.isActive === false,
      });
      setTopics((prev) => prev.map((t) => (t._id === topic._id ? { ...t, ...data } : t)));
    } catch (err) {
      setError(err.response?.data?.message || 'Could not update topic');
    } finally {
      setBusyId(null);
    }
  };

  const removeTopic = async (topic) => {
    if (!window.confirm(`Delete “${topic.label}”? Students will no longer filter by this topic.`)) return;
    setBusyId(topic._id);
    try {
      await axiosInstance.delete(`/super-admin/practice/topics/${topic._id}`);
      setTopics((prev) => prev.filter((t) => t._id !== topic._id));
    } catch (err) {
      setError(err.response?.data?.message || 'Could not delete topic');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <VendorHubPage
      className="sa-page sa-practice-page"
      loading={loading}
      backTo="/super-admin/practice"
      backLabel="Practice"
      eyebrow="Step 1 · Taxonomy"
      title="DSA Topics"
      subtitle="These labels become the topic filters on the student Practice page. Keep them short and familiar (Arrays, Graphs, DP)."
      accent={SUPER_ADMIN_ACCENT}
      actions={
        <button
          type="button"
          className="vh-btn vh-btn--primary"
          onClick={() => {
            setShowForm((v) => !v);
            setError('');
          }}
        >
          <FiPlus /> {showForm ? 'Close' : 'Add topic'}
        </button>
      }
    >
      <div className="vh-stats">
        <div className="vh-stat vh-stat--accent">
          <span className="vh-stat-label">Topics</span>
          <span className="vh-stat-value">{stats.total}</span>
        </div>
        <div className="vh-stat">
          <span className="vh-stat-label">Visible to students</span>
          <span className="vh-stat-value">{stats.active}</span>
        </div>
        <div className="vh-stat">
          <span className="vh-stat-label">Hidden</span>
          <span className="vh-stat-value">{stats.hidden}</span>
        </div>
      </div>

      {error && <div className="vh-alert vh-alert--error" style={{ marginBottom: 16 }}>{error}</div>}

      {showForm && (
        <div className="vh-panel" style={{ marginBottom: 18 }}>
          <div className="vh-panel-head">
            <div>
              <h2 className="vh-panel-title">Add a DSA topic</h2>
              <p className="vh-panel-desc">Slug is used in URLs. It is generated from the label unless you edit it.</p>
            </div>
          </div>
          <div className="vh-panel-body">
            <form onSubmit={handleCreate}>
              <div className="vh-form-grid vh-form-grid--2">
                <div className="vh-field">
                  <label htmlFor="topic-label">Label</label>
                  <input
                    id="topic-label"
                    value={form.label}
                    onChange={(e) => handleLabelChange(e.target.value)}
                    placeholder="e.g. Dynamic Programming"
                    required
                    autoFocus
                  />
                </div>
                <div className="vh-field">
                  <label htmlFor="topic-slug">Slug</label>
                  <input
                    id="topic-slug"
                    value={form.slug}
                    onChange={(e) => {
                      setSlugTouched(true);
                      setForm((prev) => ({ ...prev, slug: e.target.value }));
                    }}
                    placeholder="dynamic-programming"
                    required
                  />
                </div>
                <div className="vh-field">
                  <label htmlFor="topic-category">Level</label>
                  <select
                    id="topic-category"
                    value={form.category}
                    onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c.id} value={c.id}>{c.label}</option>
                    ))}
                  </select>
                </div>
                <div className="vh-field">
                  <label htmlFor="topic-order">Order</label>
                  <input
                    id="topic-order"
                    type="number"
                    min="0"
                    value={form.order}
                    onChange={(e) => setForm((prev) => ({ ...prev, order: e.target.value }))}
                    placeholder="Optional"
                  />
                </div>
              </div>
              <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
                <button type="submit" className="vh-btn vh-btn--primary" disabled={saving}>
                  {saving ? 'Adding…' : 'Add topic'}
                </button>
                <button
                  type="button"
                  className="vh-btn vh-btn--ghost"
                  onClick={() => {
                    setShowForm(false);
                    setForm(EMPTY_FORM);
                    setSlugTouched(false);
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="vh-toolbar">
        <label className="vh-search">
          <FiSearch />
          <input
            type="search"
            placeholder="Search topics…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <div className="vh-chips" style={{ marginBottom: 0 }}>
          <button
            type="button"
            className={`vh-chip ${categoryFilter === 'all' ? 'active' : ''}`}
            onClick={() => setCategoryFilter('all')}
          >
            All <span className="vh-chip-count">{topics.length}</span>
          </button>
          {CATEGORIES.map((c) => {
            const n = topics.filter((t) => t.category === c.id).length;
            return (
              <button
                key={c.id}
                type="button"
                className={`vh-chip ${categoryFilter === c.id ? 'active' : ''}`}
                onClick={() => setCategoryFilter(c.id)}
              >
                {c.label} <span className="vh-chip-count">{n}</span>
              </button>
            );
          })}
        </div>
      </div>

      {!topics.length ? (
        <div className="vh-panel">
          <div className="vh-empty">
            <div className="vh-empty-icon">☰</div>
            <h2>No DSA topics yet</h2>
            <p>Add Arrays, Strings, Trees, and the rest of the tree so students can filter practice problems.</p>
            <button type="button" className="vh-btn vh-btn--primary" onClick={() => setShowForm(true)}>
              <FiPlus /> Add first topic
            </button>
          </div>
        </div>
      ) : (
        <div className="sa-practice-cats">
          {grouped.every((cat) => cat.items.length === 0) ? (
            <div className="vh-panel">
              <div className="vh-empty">
                <div className="vh-empty-icon">{search ? '⌕' : '☰'}</div>
                <h2>No topics match</h2>
                <p>Try another search or level filter.</p>
              </div>
            </div>
          ) : grouped.map((cat) => (
            <section key={cat.id}>
              <h2>
                {cat.label}
                <span className="vh-chip-count" style={{ marginLeft: 8 }}>{cat.items.length}</span>
              </h2>
              {cat.items.length === 0 ? (
                <p className="vh-panel-desc">No topics in this level.</p>
              ) : (
                <div className="sa-practice-topic-grid">
                  {cat.items.map((topic) => (
                    <article
                      key={topic._id}
                      className={`sa-practice-topic-card ${topic.isActive === false ? 'is-inactive' : ''}`}
                    >
                      {editingId === topic._id ? (
                        <div className="sa-practice-topic-edit">
                          <input
                            className="vh-input"
                            value={editDraft.label}
                            onChange={(e) => setEditDraft((p) => ({ ...p, label: e.target.value }))}
                            aria-label="Label"
                          />
                          <input
                            className="vh-input"
                            value={editDraft.slug}
                            onChange={(e) => setEditDraft((p) => ({ ...p, slug: e.target.value }))}
                            aria-label="Slug"
                          />
                          <select
                            className="vh-input"
                            value={editDraft.category}
                            onChange={(e) => setEditDraft((p) => ({ ...p, category: e.target.value }))}
                          >
                            {CATEGORIES.map((c) => (
                              <option key={c.id} value={c.id}>{c.label}</option>
                            ))}
                          </select>
                          <div className="sa-practice-topic-actions">
                            <button
                              type="button"
                              className="vh-btn vh-btn--primary vh-btn--sm"
                              disabled={busyId === topic._id}
                              onClick={() => saveEdit(topic._id)}
                            >
                              <FiCheck /> Save
                            </button>
                            <button
                              type="button"
                              className="vh-btn vh-btn--ghost vh-btn--sm"
                              onClick={() => setEditingId(null)}
                            >
                              <FiX /> Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="sa-practice-topic-card-head">
                            <div>
                              <h3>{topic.label}</h3>
                              <div className="sa-practice-slug">{topic.slug}</div>
                            </div>
                            <span className={`vh-badge ${topic.isActive === false ? '' : 'vh-badge--easy'}`}>
                              {topic.isActive === false ? 'Hidden' : 'Active'}
                            </span>
                          </div>
                          <div className="sa-practice-topic-actions">
                            <button
                              type="button"
                              className="sa-practice-icon-btn"
                              title="Edit topic"
                              aria-label={`Edit ${topic.label}`}
                              onClick={() => startEdit(topic)}
                            >
                              <FiEdit2 />
                            </button>
                            <button
                              type="button"
                              className="sa-practice-icon-btn"
                              title={topic.isActive === false ? 'Show to students' : 'Hide from students'}
                              aria-label={topic.isActive === false ? `Show ${topic.label}` : `Hide ${topic.label}`}
                              disabled={busyId === topic._id}
                              onClick={() => toggleActive(topic)}
                            >
                              {topic.isActive === false ? <FiEye /> : <FiEyeOff />}
                            </button>
                            <button
                              type="button"
                              className="sa-practice-icon-btn sa-practice-icon-btn--danger"
                              title="Delete topic"
                              aria-label={`Delete ${topic.label}`}
                              disabled={busyId === topic._id}
                              onClick={() => removeTopic(topic)}
                            >
                              <FiTrash2 />
                            </button>
                          </div>
                        </>
                      )}
                    </article>
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
      )}
    </VendorHubPage>
  );
};

export default PracticeTopicsAdmin;
