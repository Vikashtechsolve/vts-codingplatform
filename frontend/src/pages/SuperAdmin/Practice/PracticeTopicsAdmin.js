import React, { useEffect, useState } from 'react';
import axiosInstance from '../../../utils/axios';
import VendorHubPage from '../../../components/VendorAdmin/VendorHubPage';
import PracticeLoading from '../../../components/Practice/PracticeLoading';
import '../../../styles/practice-pages.css';

const PracticeTopicsAdmin = () => {
  const [topics, setTopics] = useState([]);
  const [form, setForm] = useState({ slug: '', label: '', category: 'fundamentals' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    axiosInstance.get('/super-admin/practice/topics')
      .then((res) => setTopics(res.data || []))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await axiosInstance.post('/super-admin/practice/topics', form);
      setForm({ slug: '', label: '', category: 'fundamentals' });
      load();
    } finally {
      setSaving(false);
    }
  };

  return (
    <VendorHubPage title="Practice Topics" backTo="/super-admin/practice">
      <form className="practice-filters" onSubmit={handleCreate}>
        <input
          className="practice-filter-search"
          style={{ border: '1px solid var(--border-color)', borderRadius: 10, padding: '10px 12px' }}
          placeholder="slug (e.g. arrays)"
          value={form.slug}
          onChange={(e) => setForm({ ...form, slug: e.target.value })}
          required
        />
        <input
          style={{ border: '1px solid var(--border-color)', borderRadius: 10, padding: '10px 12px', minWidth: 160 }}
          placeholder="Label"
          value={form.label}
          onChange={(e) => setForm({ ...form, label: e.target.value })}
          required
        />
        <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
          <option value="fundamentals">Fundamentals</option>
          <option value="intermediate">Intermediate</option>
          <option value="advanced">Advanced</option>
        </select>
        <button type="submit" className="practice-btn practice-btn-primary" disabled={saving}>
          {saving ? 'Adding…' : 'Add topic'}
        </button>
      </form>

      {loading ? (
        <PracticeLoading message="Loading topics…" />
      ) : (
        <div className="practice-table-wrap">
          <table className="practice-table">
            <thead>
              <tr><th>Label</th><th>Slug</th><th>Category</th><th>Order</th></tr>
            </thead>
            <tbody>
              {topics.map((t) => (
                <tr key={t._id}>
                  <td className="practice-table-title">{t.label}</td>
                  <td>{t.slug}</td>
                  <td><span className="practice-topic-chip">{t.category}</span></td>
                  <td>{t.order}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </VendorHubPage>
  );
};

export default PracticeTopicsAdmin;
