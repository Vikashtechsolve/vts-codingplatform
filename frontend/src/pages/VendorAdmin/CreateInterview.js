import React, { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { FiSearch } from 'react-icons/fi';
import axiosInstance from '../../utils/axios';
import VendorTestFormPage from '../../components/VendorAdmin/VendorTestFormPage';
import VendorTestSelectedPanel from '../../components/VendorAdmin/VendorTestSelectedPanel';
import { getTestFormMeta } from '../../utils/vendorTestFormMeta';
import { buildTagFilterOptions, filterQuestionsBySearchAndTag, tagSlug } from '../../utils/tagUtils';
import useQuestionTagRegistry from '../../hooks/useQuestionTagRegistry';
import TestScheduleFields from '../../components/VendorAdmin/TestScheduleFields';
import {
  buildTestSchedulePayload,
  toLocalDateTimeInput,
  validateLocalScheduleRange,
} from '../../utils/datetimeLocal';
import { formatTopicsCardPreview } from '../../utils/interviewCardText';

const CreateInterview = () => {
  const navigate = useNavigate();
  const { interviewId } = useParams();
  const isEditMode = !!interviewId;
  const meta = getTestFormMeta('interview', isEditMode);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    interviewType: '',
    topic: '',
    difficulty: 'beginner',
    duration: 20,
    questionCount: 6,
    startDate: '',
    endDate: '',
    autoSubmitAtWindowEnd: true,
    questions: [],
    settings: {
      allowFollowUps: true,
      maxFollowUps: 6,
      adaptiveDifficulty: true,
      allowMultipleAttempts: false,
      showResults: true,
      autoSubmitAtWindowEnd: true,
    },
  });
  const [bank, setBank] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTag, setSelectedTag] = useState('');
  const { registryTags } = useQuestionTagRegistry();
  const [questionSource, setQuestionSource] = useState('my');
  const [submitting, setSubmitting] = useState(false);
  const [pageLoading, setPageLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchQuestions();
  }, []);

  useEffect(() => {
    if (!isEditMode || !interviewId) return;
    (async () => {
      try {
        setPageLoading(true);
        const res = await axiosInstance.get(`/interviews/${interviewId}`);
        const interview = res.data;
        setFormData({
          title: interview.title || '',
          description: interview.description || '',
          interviewType: interview.interviewType || '',
          topic: interview.topic || '',
          difficulty: interview.difficulty || 'beginner',
          duration: interview.duration ?? 20,
          questionCount: interview.questionCount ?? (interview.questions?.length || 6),
          startDate: toLocalDateTimeInput(interview.startDate),
          endDate: toLocalDateTimeInput(interview.endDate),
          autoSubmitAtWindowEnd: interview.settings?.autoSubmitAtWindowEnd !== false,
          questions: (interview.questions || []).map((q, i) => ({
            questionId: q.questionId?._id || q.questionId,
            order: q.order ?? i + 1,
          })),
          settings: {
            allowFollowUps: interview.settings?.allowFollowUps ?? true,
            maxFollowUps: interview.settings?.maxFollowUps ?? 6,
            adaptiveDifficulty: interview.settings?.adaptiveDifficulty ?? true,
            allowMultipleAttempts: interview.settings?.allowMultipleAttempts ?? false,
            showResults: interview.settings?.showResults ?? true,
            autoSubmitAtWindowEnd: interview.settings?.autoSubmitAtWindowEnd !== false,
          },
        });
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load interview');
      } finally {
        setPageLoading(false);
      }
    })();
  }, [isEditMode, interviewId]);

  const fetchQuestions = async () => {
    try {
      const response = await axiosInstance.get('/interview-questions');
      setBank(response.data || []);
    } catch (err) {
      console.error('Error fetching interview questions:', err);
    }
  };

  const filtered = useMemo(() => {
    const pool = bank.filter((q) =>
      questionSource === 'my' ? q.source === 'vendor' : q.source === 'global'
    );
    return filterQuestionsBySearchAndTag(pool, {
      term: searchTerm,
      selectedTag,
      textFieldsFor: (q) => [q.question, q.topic, q.interviewType],
    });
  }, [bank, searchTerm, questionSource, selectedTag]);

  const availableTags = useMemo(
    () =>
      buildTagFilterOptions(
        registryTags,
        bank
          .filter((q) => (questionSource === 'my' ? q.source === 'vendor' : q.source === 'global'))
          .flatMap((q) => q.tags || [])
      ),
    [bank, questionSource, registryTags]
  );

  const myCount = bank.filter((q) => q.source === 'vendor').length;
  const globalCount = bank.filter((q) => q.source === 'global').length;

  const getQuestionLabel = (questionId) => {
    const q = bank.find((x) => x._id === questionId);
    return q?.question?.slice(0, 80) || 'Interview question';
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const toggleSetting = (key) => {
    setFormData({
      ...formData,
      settings: { ...formData.settings, [key]: !formData.settings[key] },
    });
  };

  const handleAddQuestion = (questionId) => {
    if (formData.questions.some((q) => String(q.questionId) === String(questionId))) {
      setError('This question is already in the pool.');
      return;
    }
    setError('');
    setFormData({
      ...formData,
      questions: [
        ...formData.questions,
        { questionId, order: formData.questions.length + 1 },
      ],
    });
  };

  const handleRemoveQuestion = (index) => {
    const updated = formData.questions
      .filter((_, i) => i !== index)
      .map((q, i) => ({ ...q, order: i + 1 }));
    setFormData({ ...formData, questions: updated });
  };

  const moveQuestion = (index, dir) => {
    const next = index + dir;
    if (next < 0 || next >= formData.questions.length) return;
    const list = [...formData.questions];
    [list[index], list[next]] = [list[next], list[index]];
    setFormData({
      ...formData,
      questions: list.map((q, i) => ({ ...q, order: i + 1 })),
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!formData.title.trim()) {
      setError('Interview title is required.');
      return;
    }
    if (!formData.interviewType.trim() || !formData.topic.trim()) {
      setError('Interview type and topic are required.');
      return;
    }
    if (Number(formData.duration) < 5) {
      setError('Duration must be at least 5 minutes.');
      return;
    }

    const scheduleError = validateLocalScheduleRange(formData.startDate, formData.endDate);
    if (scheduleError) {
      setError(scheduleError);
      return;
    }

    setSubmitting(true);
    try {
      const schedulePayload = buildTestSchedulePayload({
        startDate: formData.startDate,
        endDate: formData.endDate,
      });
      const payload = {
        ...formData,
        ...schedulePayload,
        questions: formData.questions,
        settings: {
          ...formData.settings,
          autoSubmitAtWindowEnd: formData.autoSubmitAtWindowEnd,
        },
      };
      delete payload.autoSubmitAtWindowEnd;
      if (isEditMode) {
        await axiosInstance.put(`/interviews/${interviewId}`, payload);
      } else {
        await axiosInstance.post('/interviews', payload);
      }
      navigate('/vendor-admin/tests?type=interview');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save interview');
    } finally {
      setSubmitting(false);
    }
  };

  const stats = [
    { label: 'Pool size', value: formData.questions.length, highlight: true },
    { label: 'Duration', value: `${formData.duration} min` },
    { label: 'Target Qs', value: formData.questionCount },
  ];

  const footer = (
    <>
      <span className="vtf-footer-meta">
        {formData.questions.length === 0 ? (
          <>AI will pick questions by type, topic, difficulty & description</>
        ) : (
          <>
            <strong>{formData.questions.length}</strong> fixed question
            {formData.questions.length !== 1 ? 's' : ''} in pool
          </>
        )}
      </span>
      <button
        type="button"
        className="va-btn va-btn--secondary"
        onClick={() => navigate(meta.back)}
      >
        Cancel
      </button>
      <button
        type="submit"
        form="interview-form"
        className="va-btn va-btn--primary"
        disabled={submitting}
        style={{ '--va-accent': meta.accent }}
      >
        {submitting ? 'Saving…' : isEditMode ? 'Update interview' : 'Create interview'}
      </button>
    </>
  );

  return (
    <VendorTestFormPage
      loading={pageLoading}
      backTo={meta.back}
      backLabel="Interviews"
      eyebrow={meta.eyebrow}
      title={meta.title}
      subtitle={meta.subtitle}
      accent={meta.accent}
      error={error}
      stats={stats}
      footer={footer}
      wide
    >
      <form id="interview-form" onSubmit={handleSubmit}>
        <div className="vtf-builder">
          <div className="vtf-builder-main">
            <section className="vtf-section">
              <h2 className="vtf-section-title">Interview details</h2>
              <div className="vtf-field">
                <label htmlFor="int-title">Title *</label>
                <input
                  id="int-title"
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  placeholder="e.g. Frontend — React fundamentals"
                  required
                />
              </div>
              <div className="vtf-field">
                <label htmlFor="int-desc">Description</label>
                <textarea
                  id="int-desc"
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  rows={3}
                  placeholder="Brief for students and AI context…"
                />
              </div>
              <div className="vtf-row">
                <div className="vtf-field">
                  <label htmlFor="int-type">Interview type *</label>
                  <input
                    id="int-type"
                    name="interviewType"
                    value={formData.interviewType}
                    onChange={handleChange}
                    placeholder="Technical, HR, Behavioral…"
                    required
                  />
                </div>
                <div className="vtf-field">
                  <label htmlFor="int-topic">Topic *</label>
                  <input
                    id="int-topic"
                    name="topic"
                    value={formData.topic}
                    onChange={handleChange}
                    placeholder="e.g. JavaScript, System design"
                    required
                  />
                </div>
                <div className="vtf-field">
                  <label htmlFor="int-diff">Difficulty</label>
                  <select
                    id="int-diff"
                    name="difficulty"
                    value={formData.difficulty}
                    onChange={handleChange}
                  >
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                  </select>
                </div>
              </div>
              <div className="vtf-row">
                <div className="vtf-field">
                  <label htmlFor="int-dur">Duration (min)</label>
                  <input
                    id="int-dur"
                    type="number"
                    name="duration"
                    min={5}
                    value={formData.duration}
                    onChange={handleChange}
                  />
                </div>
                <div className="vtf-field">
                  <label htmlFor="int-qcount">Target question count</label>
                  <input
                    id="int-qcount"
                    type="number"
                    name="questionCount"
                    min={1}
                    value={formData.questionCount}
                    onChange={handleChange}
                  />
                </div>
              </div>
            </section>

            <section className="vtf-section">
              <h2 className="vtf-section-title">AI & student settings</h2>
              <div className="vtf-checks">
                <label className="vtf-check">
                  <input
                    type="checkbox"
                    checked={formData.settings.allowFollowUps}
                    onChange={() => toggleSetting('allowFollowUps')}
                  />
                  Allow follow-up questions
                </label>
                <label className="vtf-check">
                  <input
                    type="checkbox"
                    checked={formData.settings.adaptiveDifficulty}
                    onChange={() => toggleSetting('adaptiveDifficulty')}
                  />
                  Adaptive difficulty
                </label>
                <label className="vtf-check">
                  <input
                    type="checkbox"
                    checked={formData.settings.allowMultipleAttempts}
                    onChange={() => toggleSetting('allowMultipleAttempts')}
                  />
                  Multiple attempts
                </label>
                <label className="vtf-check">
                  <input
                    type="checkbox"
                    checked={formData.settings.showResults}
                    onChange={() => toggleSetting('showResults')}
                  />
                  Show results to students
                </label>
              </div>
            </section>

            <section className="vtf-section">
              <h2 className="vtf-section-title">Schedule (optional)</h2>
              <p className="vtf-section-hint">Leave blank for an always-available interview.</p>
              <TestScheduleFields
                startDate={formData.startDate}
                endDate={formData.endDate}
                autoSubmitAtWindowEnd={formData.autoSubmitAtWindowEnd}
                onStartDateChange={handleChange}
                onEndDateChange={handleChange}
                onAutoSubmitChange={(checked) =>
                  setFormData((prev) => ({
                    ...prev,
                    autoSubmitAtWindowEnd: checked,
                    settings: { ...prev.settings, autoSubmitAtWindowEnd: checked },
                  }))
                }
                startId="int-start"
                endId="int-end"
                fieldClassName="vtf-field"
                rowClassName="vtf-row"
              />
            </section>

            <section className="vtf-section">
              <h2 className="vtf-section-title">Question pool (optional)</h2>
              <p className="vtf-section-hint">
                Pin specific questions, or leave empty so AI selects by type, topic, difficulty, and description.
              </p>
              <div className="vtf-segment">
                <button
                  type="button"
                  className={`vtf-segment-btn ${questionSource === 'my' ? 'active' : ''}`}
                  onClick={() => setQuestionSource('my')}
                >
                  My questions
                  <span className="vtf-segment-count">{myCount}</span>
                </button>
                <button
                  type="button"
                  className={`vtf-segment-btn ${questionSource === 'global' ? 'active' : ''}`}
                  onClick={() => setQuestionSource('global')}
                >
                  Global
                  <span className="vtf-segment-count">{globalCount}</span>
                </button>
              </div>
              <div className="vtf-search">
                <FiSearch />
                <input
                  type="search"
                  placeholder="Search by question, topic, type, or tag…"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') e.preventDefault();
                  }}
                />
              </div>
              {availableTags.length > 0 && (
                <div className="vtf-tags-filter-wrap">
                  <button
                    type="button"
                    className={`vtf-tag-chip ${selectedTag === '' ? 'is-active' : ''}`}
                    onClick={() => setSelectedTag('')}
                  >
                    All tags
                  </button>
                  {availableTags.map((tag) => (
                    <button
                      key={tag.slug}
                      type="button"
                      className={`vtf-tag-chip ${selectedTag === tag.slug ? 'is-active' : ''}`}
                      onClick={() =>
                        setSelectedTag(selectedTag === tag.slug ? '' : tag.slug)
                      }
                    >
                      #{tag.label}
                    </button>
                  ))}
                </div>
              )}
              {filtered.length === 0 ? (
                <div className="vtf-empty">
                  <h3>No questions found</h3>
                  <p>
                    {searchTerm
                      ? 'Try another search term.'
                      : 'Create interview questions in your question bank first.'}
                  </p>
                  <div className="vtf-empty-actions">
                    <Link
                      to="/vendor-admin/interview-questions/create"
                      className="vtf-btn-add"
                      style={{ width: 'auto', display: 'inline-flex' }}
                    >
                      Create question
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="vtf-q-grid">
                  {filtered.map((q) => {
                    const added = formData.questions.some(
                      (sel) => String(sel.questionId) === String(q._id)
                    );
                    return (
                      <div key={q._id} className="vtf-q-card">
                        <div className="vtf-q-card-top">
                          <h4>{q.question}</h4>
                          <span className={`vtf-badge vtf-badge--${q.difficulty || 'medium'}`}>
                            {q.difficulty || 'medium'}
                          </span>
                        </div>
                        <div className="vtf-q-meta">
                          <span>{q.interviewType}</span>
                          <span title={q.topic}>{formatTopicsCardPreview(q.topic)}</span>
                        </div>
                        {!!q.tags?.length && (
                          <div className="vtf-tags-row">
                            {q.tags.slice(0, 4).map((tag) => {
                              const slug = tagSlug(tag);
                              return (
                                <button
                                  key={slug}
                                  type="button"
                                  className={`vtf-tag-chip ${selectedTag === slug ? 'is-active' : ''}`}
                                  onClick={() =>
                                    setSelectedTag(selectedTag === slug ? '' : slug)
                                  }
                                >
                                  #{tag}
                                </button>
                              );
                            })}
                          </div>
                        )}
                        <button
                          type="button"
                          className={`vtf-btn-add ${added ? 'is-added' : ''}`}
                          disabled={added}
                          onClick={() => handleAddQuestion(q._id)}
                        >
                          {added ? 'Added to pool' : 'Add to pool'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>

          <aside className="vtf-builder-aside">
            <VendorTestSelectedPanel
              items={formData.questions.map((q, idx) => ({
                key: `${q.questionId}-${idx}`,
                id: q.questionId,
                raw: q,
                index: idx,
              }))}
              emptyTitle="No fixed pool"
              emptyHint="Leave empty and AI picks questions by type, topic, and difficulty—or pin specific ones here."
              showPoints={false}
              getTitle={(item) => getQuestionLabel(item.raw.questionId)}
              onMove={(idx, dir) => moveQuestion(idx, dir === 'up' ? -1 : 1)}
              onRemove={handleRemoveQuestion}
            />
          </aside>
        </div>
      </form>
    </VendorTestFormPage>
  );
};

export default CreateInterview;
