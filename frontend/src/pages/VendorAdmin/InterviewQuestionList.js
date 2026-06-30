import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FiPlus,
  FiSearch,
  FiMic,
  FiEdit2,
  FiTrash2,
  FiGlobe,
  FiUser,
  FiFilter,
} from 'react-icons/fi';
import axiosInstance from '../../utils/axios';
import { useToast } from '../../context/ToastContext';
import VendorHubPage from '../../components/VendorAdmin/VendorHubPage';
import QuestionHubRow from '../../components/VendorAdmin/QuestionHubRow';
import QuestionTagFilters from '../../components/VendorAdmin/QuestionTagFilters';
import useQuestionTagRegistry from '../../hooks/useQuestionTagRegistry';
import { buildTagFilterOptions, filterQuestionsBySearchAndTag } from '../../utils/tagUtils';
import { QUESTION_FORM_META } from '../../utils/vendorQuestionFormMeta';
import './InterviewQuestionList.css';

const DIFFICULTY_LABELS = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
};

const DIFFICULTY_BADGE = {
  beginner: 'easy',
  intermediate: 'medium',
  advanced: 'hard',
};

const truncate = (text, max = 120) => {
  if (!text) return 'Untitled question';
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max).trim()}…`;
};

const InterviewQuestionList = () => {
  const { showToast } = useToast();
  const meta = QUESTION_FORM_META.interview;
  const { registryTags } = useQuestionTagRegistry();

  const [myQuestions, setMyQuestions] = useState([]);
  const [globalQuestions, setGlobalQuestions] = useState([]);
  const [sourceTab, setSourceTab] = useState('my');
  const [typeFilter, setTypeFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedTag, setSelectedTag] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchQuestions = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await axiosInstance.get('/interview-questions');
      const questions = Array.isArray(data) ? data : [];
      setMyQuestions(questions.filter((q) => q.source === 'vendor'));
      setGlobalQuestions(questions.filter((q) => q.source === 'global'));
    } catch (error) {
      console.error('Error fetching interview questions:', error);
      showToast('Failed to load interview questions', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  useEffect(() => {
    setSelectedTag('');
    setSearch('');
  }, [sourceTab]);

  const rawQuestions = sourceTab === 'my' ? myQuestions : globalQuestions;

  const typeOptions = useMemo(() => {
    const types = [...new Set(rawQuestions.map((q) => q.interviewType).filter(Boolean))].sort();
    return types;
  }, [rawQuestions]);

  const filteredByType = useMemo(() => {
    if (typeFilter === 'all') return rawQuestions;
    return rawQuestions.filter((q) => q.interviewType === typeFilter);
  }, [rawQuestions, typeFilter]);

  const getTextFields = useCallback(
    (q) => [q.question, q.interviewType, q.topic],
    []
  );

  const availableTags = useMemo(
    () => buildTagFilterOptions(registryTags, filteredByType.flatMap((q) => q.tags || [])),
    [registryTags, filteredByType]
  );

  const currentQuestions = useMemo(
    () =>
      filterQuestionsBySearchAndTag(filteredByType, {
        term: search,
        selectedTag,
        textFieldsFor: getTextFields,
      }),
    [filteredByType, search, selectedTag, getTextFields]
  );

  const handleDelete = async (questionId) => {
    if (!window.confirm('Delete this interview question? Interviews already using it may be affected.')) {
      return;
    }
    try {
      await axiosInstance.delete(`/interview-questions/${questionId}`);
      showToast('Question deleted', 'success');
      fetchQuestions();
    } catch (error) {
      showToast(error.response?.data?.message || 'Failed to delete question', 'error');
    }
  };

  const stats = useMemo(() => {
    const pool = sourceTab === 'my' ? myQuestions : globalQuestions;
    const types = new Set(pool.map((q) => q.interviewType).filter(Boolean)).size;
    const rubricCount = pool.filter((q) => q.rubrics?.length).length;
    return { total: pool.length, types, rubricCount };
  }, [myQuestions, globalQuestions, sourceTab]);

  return (
    <VendorHubPage
      className="viq-page"
      loading={loading}
      backTo="/vendor-admin/tests?type=interview"
      backLabel="Back to interviews"
      eyebrow="Question bank"
      title="Interview question pool"
      subtitle="Build custom questions for mock interviews. Pin them when creating an interview, or leave the pool empty for AI-generated questions."
      accent={meta.accent}
      actions={
        sourceTab === 'my' ? (
          <Link to="/vendor-admin/interview-questions/create" className="vh-btn vh-btn--primary">
            <FiPlus /> Create question
          </Link>
        ) : null
      }
    >
      <div className="vh-stats viq-stats">
        <div className="vh-stat vh-stat--accent">
          <span className="vh-stat-label">{sourceTab === 'my' ? 'My questions' : 'Global pool'}</span>
          <span className="vh-stat-value">{stats.total}</span>
        </div>
        <div className="vh-stat">
          <span className="vh-stat-label">Interview types</span>
          <span className="vh-stat-value">{stats.types}</span>
        </div>
        <div className="vh-stat">
          <span className="vh-stat-label">With rubrics</span>
          <span className="vh-stat-value">{stats.rubricCount}</span>
        </div>
      </div>

      <div className="veq-source-tabs viq-source-tabs">
        <button
          type="button"
          className={`veq-source-tab ${sourceTab === 'my' ? 'active' : ''}`}
          onClick={() => setSourceTab('my')}
        >
          <FiUser aria-hidden /> My questions ({myQuestions.length})
        </button>
        <button
          type="button"
          className={`veq-source-tab ${sourceTab === 'global' ? 'active' : ''}`}
          onClick={() => setSourceTab('global')}
        >
          <FiGlobe aria-hidden /> Global library ({globalQuestions.length})
        </button>
      </div>

      <div className="vh-toolbar viq-toolbar">
        <div className="vh-search">
          <FiSearch aria-hidden />
          <input
            type="search"
            placeholder="Search by question, type, topic, or tag…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {typeOptions.length > 0 && (
          <div className="viq-type-filter">
            <FiFilter aria-hidden />
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              aria-label="Filter by interview type"
            >
              <option value="all">All types</option>
              {typeOptions.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      <QuestionTagFilters tags={availableTags} selectedSlug={selectedTag} onSelect={setSelectedTag} />

      {currentQuestions.length === 0 ? (
        <div className="veq-empty viq-empty">
          <div className="viq-empty-icon" aria-hidden>
            <FiMic />
          </div>
          <h2>No questions found</h2>
          <p>
            {search || selectedTag || typeFilter !== 'all'
              ? 'Try a different search, tag, or type filter.'
              : sourceTab === 'my'
                ? 'Create your first question to use in mock interviews.'
                : 'No global interview questions are available yet.'}
          </p>
          {sourceTab === 'my' && !search && !selectedTag && typeFilter === 'all' && (
            <Link to="/vendor-admin/interview-questions/create" className="vh-btn vh-btn--primary">
              <FiPlus /> Create question
            </Link>
          )}
        </div>
      ) : (
        <div className="vh-panel">
          <div className="vh-panel-head">
            <div>
              <h2 className="vh-panel-title">
                {sourceTab === 'my' ? 'Your questions' : 'Global questions'}
              </h2>
              <p className="vh-panel-desc">
                {currentQuestions.length} question{currentQuestions.length !== 1 ? 's' : ''} shown
                {sourceTab === 'global' ? ' · read-only' : ''}
              </p>
            </div>
          </div>
          <div className="vh-panel-body vh-panel-body--flush">
            <ul className="vh-question-list">
              {currentQuestions.map((q) => (
                <QuestionHubRow
                  key={q._id}
                  accent={meta.accent}
                  icon={FiMic}
                  title={truncate(q.question)}
                  tags={q.tags}
                  badges={[
                    {
                      key: 'type',
                      label: q.interviewType || 'General',
                      className: 'vh-badge vh-badge--global',
                    },
                    {
                      key: 'difficulty',
                      label: DIFFICULTY_LABELS[q.difficulty] || q.difficulty || 'Beginner',
                      className: `vh-badge vh-badge--${DIFFICULTY_BADGE[q.difficulty] || 'easy'}`,
                    },
                  ]}
                  meta={[
                    { key: 'topic', label: q.topic || 'No topic' },
                    { key: 'pts', label: `${q.points ?? 10} pts` },
                    q.rubrics?.length
                      ? { key: 'rubrics', label: `${q.rubrics.length} rubric${q.rubrics.length !== 1 ? 's' : ''}` }
                      : null,
                    q.followUpHints?.filter(Boolean).length
                      ? {
                          key: 'hints',
                          label: `${q.followUpHints.filter(Boolean).length} follow-up hint${q.followUpHints.filter(Boolean).length !== 1 ? 's' : ''}`,
                        }
                      : null,
                  ].filter(Boolean)}
                  selectedTag={selectedTag}
                  onTagClick={setSelectedTag}
                  actions={
                    sourceTab === 'my' ? (
                      <>
                        <Link
                          to={`/vendor-admin/interview-questions/edit/${q._id}`}
                          className="vh-btn vh-btn--secondary vh-btn--sm"
                        >
                          <FiEdit2 /> Edit
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleDelete(q._id)}
                          className="vh-btn vh-btn--danger vh-btn--sm"
                        >
                          <FiTrash2 /> Delete
                        </button>
                      </>
                    ) : (
                      <span className="vh-badge vh-badge--global">Read-only</span>
                    )
                  }
                />
              ))}
            </ul>
          </div>
        </div>
      )}
    </VendorHubPage>
  );
};

export default InterviewQuestionList;
