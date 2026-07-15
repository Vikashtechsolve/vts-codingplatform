import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  FiCode,
  FiCheckSquare,
  FiTrendingUp,
  FiBookOpen,
  FiMessageCircle,
  FiPlus,
  FiSearch,
  FiEdit2,
  FiGlobe,
  FiBriefcase,
} from 'react-icons/fi';
import axiosInstance from '../../utils/axios';
import VendorHubPage from '../../components/VendorAdmin/VendorHubPage';
import QuestionHubRow from '../../components/VendorAdmin/QuestionHubRow';
import QuestionTagFilters from '../../components/VendorAdmin/QuestionTagFilters';
import VendorLoadMore from '../../components/VendorAdmin/VendorLoadMore';
import VendorDataSection from '../../components/VendorAdmin/VendorDataSection';
import useQuestionTagRegistry from '../../hooks/useQuestionTagRegistry';
import { useVendorPanel } from '../../context/VendorPanelContext';
import { useListFetchLoading } from '../../hooks/useListFetchLoading';
import { buildTagFilterOptions, filterQuestionsBySearchAndTag } from '../../utils/tagUtils';
import { normalizePaginatedResponse, mergePaginatedPages } from '../../utils/paginatedApi';
import { htmlToListPreview } from '../../components/RichTextDisplay';

const QUESTION_API = {
  coding: '/questions/coding',
  mcq: '/questions/mcq',
  aptitude: '/questions/aptitude',
  theory: '/questions/theory',
};

const QUESTION_TYPES = [
  { id: 'coding', label: 'Coding', accent: '#2563eb', icon: FiCode, create: '/vendor-admin/questions/coding/create', edit: (id) => `/vendor-admin/questions/coding/edit/${id}` },
  { id: 'mcq', label: 'MCQ', accent: '#7c3aed', icon: FiCheckSquare, create: '/vendor-admin/questions/mcq/create', edit: (id) => `/vendor-admin/questions/mcq/edit/${id}` },
  { id: 'aptitude', label: 'Aptitude', accent: '#059669', icon: FiTrendingUp, create: '/vendor-admin/questions/aptitude/create', edit: (id) => `/vendor-admin/questions/aptitude/edit/${id}` },
  { id: 'theory', label: 'Theory', accent: '#475569', icon: FiBookOpen, create: '/vendor-admin/questions/theory/create', edit: (id) => `/vendor-admin/questions/theory/edit/${id}` },
  { id: 'english', label: 'English & Verbal', accent: '#db2777', icon: FiMessageCircle, create: '/vendor-admin/english-questions', edit: null },
];

const QuestionList = () => {
  const { stats: panelStats } = useVendorPanel();
  const [questions, setQuestions] = useState([]);
  const [activeTab, setActiveTab] = useState('my');
  const [questionType, setQuestionType] = useState('coding');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedTag, setSelectedTag] = useState('');
  const {
    initialLoading,
    refreshing,
    loadingMore,
    beginFetch,
    endFetch,
  } = useListFetchLoading();
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [vendorTotal, setVendorTotal] = useState(0);
  const [globalTotal, setGlobalTotal] = useState(0);
  const { registryTags } = useQuestionTagRegistry();

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchQuestions = useCallback(
    async ({ pageNum = 1, append = false } = {}) => {
      if (questionType === 'english') {
        setQuestions([]);
        endFetch();
        return;
      }

      const endpoint = QUESTION_API[questionType];
      if (!endpoint) return;

      try {
        beginFetch(append);

        const { data } = await axiosInstance.get(endpoint, {
          params: {
            source: activeTab === 'my' ? 'vendor' : 'global',
            page: pageNum,
            limit: 40,
            search: debouncedSearch.trim() || undefined,
          },
        });

        const parsed = normalizePaginatedResponse(data);
        setQuestions((prev) =>
          append ? mergePaginatedPages(prev, parsed.items) : parsed.items
        );
        setPage(parsed.page);
        setHasMore(parsed.hasMore);
        setTotal(parsed.total);
        if (parsed.vendorTotal != null) setVendorTotal(parsed.vendorTotal);
        if (parsed.globalTotal != null) setGlobalTotal(parsed.globalTotal);
      } catch (error) {
        console.error('Error fetching questions:', error);
      } finally {
        endFetch();
      }
    },
    [questionType, activeTab, debouncedSearch, beginFetch, endFetch]
  );

  useEffect(() => {
    fetchQuestions({ pageNum: 1, append: false });
  }, [fetchQuestions]);

  const counts = useMemo(() => {
    const qStats = panelStats.questions || {};
    const myByType = {
      coding: vendorTotal || qStats.coding || 0,
      mcq: vendorTotal || qStats.mcq || 0,
      aptitude: vendorTotal || qStats.aptitude || 0,
      theory: vendorTotal || qStats.theory || 0,
    };
    if (questionType !== 'english' && activeTab === 'my' && vendorTotal) {
      myByType[questionType] = vendorTotal;
    }
    const globalByType = {
      coding: globalTotal,
      mcq: globalTotal,
      aptitude: globalTotal,
      theory: globalTotal,
    };
    if (questionType !== 'english' && activeTab === 'global' && globalTotal) {
      globalByType[questionType] = globalTotal;
    }
    return {
      myTotal: Object.values(qStats).reduce((s, n) => s + (n || 0), 0),
      globalTotal: globalTotal || 0,
      myByType: {
        coding: qStats.coding || 0,
        mcq: qStats.mcq || 0,
        aptitude: qStats.aptitude || 0,
        theory: qStats.theory || 0,
      },
      globalByType,
    };
  }, [panelStats.questions, vendorTotal, globalTotal, questionType, activeTab]);

  const currentType = QUESTION_TYPES.find((t) => t.id === questionType) || QUESTION_TYPES[0];
  const rawQuestions = useMemo(
    () => (questionType === 'english' ? [] : questions),
    [questionType, questions]
  );

  useEffect(() => {
    setSelectedTag('');
  }, [questionType, activeTab]);

  const getTextFields = useCallback(
    (item) => {
      switch (questionType) {
        case 'coding':
          return [item.title, item.description, item.difficulty];
        case 'mcq':
          return [htmlToListPreview(item.question), item.category, item.difficulty];
        case 'aptitude':
          return [htmlToListPreview(item.question), item.section, item.subCategory, item.questionType];
        case 'theory':
          return [htmlToListPreview(item.questionText), item.subjectId?.name, item.topicId?.name];
        default:
          return [item.title, item.question, item.questionText];
      }
    },
    [questionType]
  );

  const availableTags = useMemo(
    () => buildTagFilterOptions(registryTags, rawQuestions.flatMap((q) => q.tags || [])),
    [registryTags, rawQuestions]
  );

  const filteredQuestions = useMemo(
    () =>
      filterQuestionsBySearchAndTag(rawQuestions, {
        term: '',
        selectedTag,
        textFieldsFor: getTextFields,
      }),
    [rawQuestions, selectedTag, getTextFields]
  );

  const renderDifficultyBadge = (d) => ({
    key: 'difficulty',
    label: d || 'medium',
    className: `vh-badge vh-badge--${d || 'medium'}`,
  });

  const getRowProps = (q) => {
    switch (questionType) {
      case 'coding':
        return {
          title: q.title,
          tags: q.tags,
          badges: [renderDifficultyBadge(q.difficulty)],
          meta: [
            { key: 'lang', label: `${(q.allowedLanguages || []).length} languages` },
          ],
        };
      case 'mcq':
        return {
          title: q.question,
          tags: q.tags,
          badges: [renderDifficultyBadge(q.difficulty)],
          meta: [
            { key: 'opts', label: `${q.options?.length || 0} options` },
            { key: 'pts', label: `${q.points ?? 0} points` },
          ],
        };
      case 'theory':
        return {
          title: q.questionText,
          tags: q.tags,
          badges: [renderDifficultyBadge(q.difficulty)],
          meta: [
            { key: 'subj', label: q.subjectId?.name || 'No subject' },
            { key: 'topic', label: q.topicId?.name || 'No topic' },
            { key: 'marks', label: `${q.maxMarks || 10} marks` },
          ],
        };
      case 'aptitude':
        return {
          title: q.question,
          tags: q.tags,
          badges: [renderDifficultyBadge(q.difficulty)],
          meta: [
            { key: 'section', label: q.section || '—' },
            { key: 'type', label: q.questionType || '—' },
            { key: 'pts', label: `${q.points ?? 0} points` },
          ],
        };
      default:
        return { title: q.title || q.question || q.questionText, tags: q.tags, badges: [], meta: [] };
    }
  };

  const renderQuestionList = () => {
    if (questionType === 'english') {
      return (
        <div className="vh-empty">
          <div className="vh-empty-icon"><FiMessageCircle /></div>
          <h2>English & verbal questions</h2>
          <p>Grammar, vocabulary, reading, writing, speaking, and listening are managed in a dedicated hub.</p>
          <Link to="/vendor-admin/english-questions" className="vh-btn vh-btn--primary" style={{ '--vh-accent': '#db2777' }}>
            Open English question bank
          </Link>
        </div>
      );
    }

    if (filteredQuestions.length === 0) {
      return (
        <div className="vh-empty">
          <div className="vh-empty-icon"><currentType.icon /></div>
          <h2>No {currentType.label} questions</h2>
          <p>
            {search
              ? 'Try a different search term.'
              : activeTab === 'my'
                ? `Create your first ${currentType.label.toLowerCase()} question.`
                : 'No shared global questions of this type yet.'}
          </p>
          {activeTab === 'my' && !search && (
            <Link to={currentType.create} className="vh-btn vh-btn--primary" style={{ '--vh-accent': currentType.accent }}>
              <FiPlus /> Create {currentType.label}
            </Link>
          )}
        </div>
      );
    }

    return (
      <ul className="vh-question-list">
        {filteredQuestions.map((q) => {
          const row = getRowProps(q);
          return (
            <QuestionHubRow
              key={q._id}
              accent={currentType.accent}
              icon={currentType.icon}
              title={row.title}
              tags={row.tags}
              badges={row.badges}
              meta={row.meta}
              selectedTag={selectedTag}
              onTagClick={setSelectedTag}
              actions={
                activeTab === 'my' ? (
                  <Link to={currentType.edit(q._id)} className="vh-btn vh-btn--secondary vh-btn--sm">
                    <FiEdit2 /> Edit
                  </Link>
                ) : (
                  <span className="vh-badge vh-badge--global">Read-only</span>
                )
              }
            />
          );
        })}
      </ul>
    );
  };

  return (
    <VendorHubPage
      className="vh-questions-page"
      loading={initialLoading}
      eyebrow="Question bank"
      title="Questions"
      subtitle="Create and manage coding, MCQ, aptitude, theory, and English items. Use My Questions for your bank or browse shared global content."
      accent="#475569"
    >
      <div className="vh-stats">
        <div className="vh-stat vh-stat--accent">
          <span className="vh-stat-label">My questions</span>
          <span className="vh-stat-value">{counts.myTotal}</span>
        </div>
        <div className="vh-stat">
          <span className="vh-stat-label">Global pool</span>
          <span className="vh-stat-value">{counts.globalTotal}</span>
        </div>
        <div className="vh-stat">
          <span className="vh-stat-label">Showing</span>
          <span className="vh-stat-value">{filteredQuestions.length}</span>
        </div>
      </div>

      <div className="vh-panel">
        <div className="vh-panel-head">
          <div>
            <h2 className="vh-panel-title">Create new question</h2>
            <p className="vh-panel-desc">Pick a type to add to your question bank</p>
          </div>
        </div>
        <div className="vh-panel-body">
          <div className="vh-action-grid">
            {QUESTION_TYPES.map((t) => (
              <Link
                key={t.id}
                to={t.create}
                className="vh-action-card"
                style={{ '--action-accent': t.accent }}
              >
                <span className="vh-action-icon"><t.icon /></span>
                <span className="vh-action-label">{t.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="vh-chips">
        <button
          type="button"
          className={`vh-chip ${activeTab === 'my' ? 'active' : ''}`}
          style={{ '--chip-accent': '#475569' }}
          onClick={() => setActiveTab('my')}
        >
          <FiBriefcase /> My questions
          <span className="vh-chip-count">{counts.myTotal}</span>
        </button>
        <button
          type="button"
          className={`vh-chip ${activeTab === 'global' ? 'active' : ''}`}
          style={{ '--chip-accent': '#0891b2' }}
          onClick={() => setActiveTab('global')}
        >
          <FiGlobe /> Global
          <span className="vh-chip-count">{counts.globalTotal}</span>
        </button>
      </div>

      <div className="vh-chips">
        {QUESTION_TYPES.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`vh-chip ${questionType === t.id ? 'active' : ''}`}
            style={{ '--chip-accent': t.accent }}
            onClick={() => setQuestionType(t.id)}
          >
            <t.icon /> {t.label}
            {t.id !== 'english' && (
              <span className="vh-chip-count">
                {activeTab === 'my' ? counts.myByType[t.id] : counts.globalByType[t.id]}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="vh-toolbar">
        <div className="vh-search">
          <FiSearch />
          <input
            type="search"
            placeholder={`Search ${currentType.label.toLowerCase()} by title, text, or tag…`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {activeTab === 'my' && questionType !== 'english' && (
          <Link
            to={currentType.create}
            className="vh-btn vh-btn--primary"
            style={{ '--vh-accent': currentType.accent }}
          >
            <FiPlus /> New {currentType.label}
          </Link>
        )}
      </div>

      {questionType !== 'english' && (
        <QuestionTagFilters
          tags={availableTags}
          selectedSlug={selectedTag}
          onSelect={setSelectedTag}
        />
      )}

      <div className="vh-panel">
        <div className="vh-panel-head">
          <div>
            <h2 className="vh-panel-title">
              {activeTab === 'my' ? 'My' : 'Global'} {currentType.label}
            </h2>
            <p className="vh-panel-desc">
              {filteredQuestions.length} question{filteredQuestions.length !== 1 ? 's' : ''}
              {search || selectedTag ? ` matching filters` : ''}
            </p>
          </div>
        </div>
        <div className="vh-panel-body vh-panel-body--flush">
          <VendorDataSection refreshing={refreshing}>
          {renderQuestionList()}
          {questionType !== 'english' && (
            <VendorLoadMore
              hasMore={hasMore}
              loading={loadingMore || refreshing}
              loadedCount={filteredQuestions.length}
              total={total}
              onLoadMore={() => fetchQuestions({ pageNum: page + 1, append: true })}
            />
          )}
          </VendorDataSection>
        </div>
      </div>
    </VendorHubPage>
  );
};

export default QuestionList;
