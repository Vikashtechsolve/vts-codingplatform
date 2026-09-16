import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axiosInstance from '../../../utils/axios';
import VendorHubPage from '../../../components/VendorAdmin/VendorHubPage';
import PracticeLoading from '../../../components/Practice/PracticeLoading';
import PracticeEmptyState from '../../../components/Practice/PracticeEmptyState';
import { capitalize } from '../../../components/Practice/practiceUtils';
import '../../../styles/practice-pages.css';

const PracticeQuestionsAdmin = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(null);

  const load = () => {
    setLoading(true);
    axiosInstance
      .get('/super-admin/practice/questions', { params: { source: 'global', limit: 100 } })
      .then((res) => setItems(res.data.items || []))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const togglePractice = async (id, enabled) => {
    setToggling(id);
    try {
      await axiosInstance.put(`/super-admin/practice/questions/${id}/practice`, {
        practiceEnabled: enabled,
      });
      setItems((prev) => prev.map((q) => (q._id === id ? { ...q, practiceEnabled: enabled } : q)));
    } finally {
      setToggling(null);
    }
  };

  return (
    <VendorHubPage title="Practice Questions" backTo="/super-admin/practice">
      <p className="practice-meta-muted" style={{ marginBottom: 16 }}>
        Choose which global coding questions appear in the student Practice Bank.
        <Link to="/super-admin/global-questions/coding/create" style={{ marginLeft: 8, color: 'var(--practice-accent)' }}>
          Create new question
        </Link>
      </p>

      {loading ? (
        <PracticeLoading message="Loading questions…" />
      ) : !items.length ? (
        <PracticeEmptyState
          title="No global coding questions"
          description="Create global questions first, then enable them for practice."
          actionLabel="Go to question bank"
          actionTo="/super-admin/global-questions"
        />
      ) : (
        <div className="practice-table-wrap">
          <table className="practice-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Difficulty</th>
                <th>In practice</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((q) => (
                <tr key={q._id}>
                  <td className="practice-table-title">{q.title}</td>
                  <td>
                    <span className={`practice-diff practice-diff-${q.difficulty}`}>
                      {capitalize(q.difficulty)}
                    </span>
                  </td>
                  <td>
                    <span className={`practice-status practice-status-${q.practiceEnabled ? 'solved' : 'unsolved'}`}>
                      {q.practiceEnabled ? 'Yes' : 'No'}
                    </span>
                  </td>
                  <td style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="practice-btn practice-btn-ghost"
                      disabled={toggling === q._id}
                      onClick={() => togglePractice(q._id, !q.practiceEnabled)}
                    >
                      {toggling === q._id ? '…' : q.practiceEnabled ? 'Remove' : 'Add to practice'}
                    </button>
                    <Link
                      to={`/super-admin/global-questions/coding/edit/${q._id}`}
                      className="practice-table-link"
                    >
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </VendorHubPage>
  );
};

export default PracticeQuestionsAdmin;
