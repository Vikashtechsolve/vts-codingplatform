import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiArrowRight, FiDatabase, FiGrid, FiLayers, FiTarget } from 'react-icons/fi';
import axiosInstance from '../../../utils/axios';
import VendorHubPage from '../../../components/VendorAdmin/VendorHubPage';
import { SUPER_ADMIN_ACCENT } from '../../../constants/superAdminSections';
import { normalizePaginatedResponse } from '../../../utils/paginatedApi';
import '../../../styles/super-admin-pages.css';
import '../../../styles/super-admin-practice.css';

const MODULES = [
  {
    to: '/super-admin/practice/topics',
    icon: FiLayers,
    accent: '#2563eb',
    title: 'DSA Topics',
    body: 'Filters students use in Practice.',
    countKey: 'topics',
    countLabel: 'topics',
  },
  {
    to: '/super-admin/practice/questions',
    icon: FiGrid,
    accent: '#7c3aed',
    title: 'Practice Questions',
    body: 'What students can solve.',
    countKey: 'inPractice',
    countLabel: 'live',
  },
  {
    to: '/super-admin/global-questions',
    icon: FiDatabase,
    accent: '#0891b2',
    title: 'Global Question Bank',
    body: 'Write and edit platform questions.',
    countKey: 'globalCoding',
    countLabel: 'coding',
  },
];

const PracticeAdminHub = () => {
  const [stats, setStats] = useState(null);
  const [counts, setCounts] = useState({ topics: 0, inPractice: 0, globalCoding: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      axiosInstance.get('/super-admin/practice/analytics'),
      axiosInstance.get('/super-admin/practice/topics'),
      axiosInstance.get('/super-admin/practice/questions', {
        params: { source: 'global', page: 1, limit: 1 },
      }),
    ])
      .then(([analyticsRes, topicsRes, questionsRes]) => {
        if (cancelled) return;
        const q = normalizePaginatedResponse(questionsRes.data);
        setStats(analyticsRes.data);
        setCounts({
          topics: Array.isArray(topicsRes.data) ? topicsRes.data.length : 0,
          inPractice: analyticsRes.data?.totalQuestions ?? 0,
          globalCoding: q.globalTotal ?? q.total ?? 0,
        });
      })
      .catch(() => {
        if (!cancelled) setStats(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <VendorHubPage
      className="sa-page sa-practice-page"
      loading={loading}
      eyebrow="Student practice"
      title="Practice platform"
      subtitle="Build the DSA tree, author global coding questions, then publish the ones students should solve in Practice."
      accent={SUPER_ADMIN_ACCENT}
      actions={
        <Link to="/super-admin/practice/questions" className="vh-btn vh-btn--primary">
          <FiTarget /> Go to practice bank
        </Link>
      }
    >
      <div className="vh-stats">
        <div className="vh-stat vh-stat--accent">
          <span className="vh-stat-label">In student practice</span>
          <span className="vh-stat-value">{stats?.totalQuestions ?? 0}</span>
        </div>
        <div className="vh-stat">
          <span className="vh-stat-label">DSA topics</span>
          <span className="vh-stat-value">{counts.topics}</span>
        </div>
        <div className="vh-stat">
          <span className="vh-stat-label">Active students</span>
          <span className="vh-stat-value">{stats?.activeStudents ?? 0}</span>
        </div>
        <div className="vh-stat">
          <span className="vh-stat-label">Success rate</span>
          <span className="vh-stat-value">{stats?.successRate ?? 0}%</span>
        </div>
      </div>

      <div className="sa-practice-flow" aria-label="How practice is set up">
        <div className="sa-practice-flow-step">
          <span className="sa-practice-flow-num">1</span>
          <div>
            <strong>Name the topics</strong>
            <span>Arrays, Trees, DP — the filters on the student Practice page.</span>
          </div>
        </div>
        <div className="sa-practice-flow-step">
          <span className="sa-practice-flow-num">2</span>
          <div>
            <strong>Write questions</strong>
            <span>Create coding items in the Global Question Bank.</span>
          </div>
        </div>
        <div className="sa-practice-flow-step">
          <span className="sa-practice-flow-num">3</span>
          <div>
            <strong>Publish to students</strong>
            <span>Turn a question on in Practice Questions and tag its topics.</span>
          </div>
        </div>
      </div>

      <h2 className="sa-section-title">Three sections</h2>
      <div className="sa-practice-modules">
        {MODULES.map((mod) => {
          const Icon = mod.icon;
          const n = counts[mod.countKey];
          return (
            <Link
              key={mod.to}
              to={mod.to}
              className="sa-practice-module"
              style={{ '--module-accent': mod.accent }}
            >
              <div className="sa-practice-module-top">
                <span className="sa-practice-module-icon">
                  <Icon />
                </span>
                <span className="sa-practice-module-count">{n}</span>
              </div>
              <div className="sa-practice-module-copy">
                <h3>{mod.title}</h3>
                <p>{mod.body}</p>
              </div>
              <span className="sa-practice-module-cta" aria-hidden>
                {mod.countLabel} <FiArrowRight />
              </span>
            </Link>
          );
        })}
      </div>

      <p className="sa-practice-note">
        Students never see this workspace. They only receive coding questions that are marked
        <strong> in practice</strong> and tagged with an active DSA topic.
      </p>
    </VendorHubPage>
  );
};

export default PracticeAdminHub;
