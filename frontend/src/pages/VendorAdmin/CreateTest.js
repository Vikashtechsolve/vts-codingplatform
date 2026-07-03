import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import axiosInstance from '../../utils/axios';
import VendorTestFormPage from '../../components/VendorAdmin/VendorTestFormPage';
import VendorStandardTestBuilder from '../../components/VendorAdmin/VendorStandardTestBuilder';
import TestScheduleFields from '../../components/VendorAdmin/TestScheduleFields';
import '../../components/VendorAdmin/TestScheduleFields.css';
import {
  toLocalDateTimeInput,
  buildTestSchedulePayload,
  validateLocalScheduleRange,
} from '../../utils/datetimeLocal';
import { getTestFormMeta } from '../../utils/vendorTestFormMeta';
import { buildTagFilterOptions, filterQuestionsBySearchAndTag } from '../../utils/tagUtils';
import useQuestionTagRegistry from '../../hooks/useQuestionTagRegistry';

const CreateTest = () => {
  const { testId } = useParams();
  const isEditMode = !!testId;
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    type: 'mixed',
    duration: 60,
    questions: [],
    startDate: '',
    endDate: '',
    autoSubmitAtWindowEnd: true,
  });
  const [codingQuestions, setCodingQuestions] = useState([]);
  const [mcqQuestions, setMcqQuestions] = useState([]);
  const [aptitudeQuestions, setAptitudeQuestions] = useState([]);
  const [filteredCoding, setFilteredCoding] = useState([]);
  const [filteredMcq, setFilteredMcq] = useState([]);
  const [filteredAptitude, setFilteredAptitude] = useState([]);
  const [theoryQuestions, setTheoryQuestions] = useState([]);
  const [filteredTheory, setFilteredTheory] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTag, setSelectedTag] = useState('');
  const { registryTags } = useQuestionTagRegistry();
  const [selectedTab, setSelectedTab] = useState('coding');
  const [questionSource, setQuestionSource] = useState('my'); // 'my' or 'global'
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  const typeParam = new URLSearchParams(location.search).get('type');
  const queryLockedType = ['coding', 'mcq', 'aptitude', 'theory', 'mixed'].includes(typeParam) ? typeParam : null;
  const [lockedType, setLockedType] = useState(queryLockedType);
  const [testLoading, setTestLoading] = useState(false);

  useEffect(() => {
    fetchQuestions();
  }, []);

  useEffect(() => {
    if (lockedType) {
      setFormData(prev => ({ ...prev, type: lockedType }));
      setSelectedTab(lockedType === 'mixed' ? 'coding' : lockedType);
    }
  }, [lockedType]);

  useEffect(() => {
    if (formData.type !== 'mixed' && selectedTab !== formData.type) {
      setSelectedTab(formData.type);
    }
  }, [formData.type, selectedTab]);

  const fetchTest = async () => {
    if (!isEditMode || !testId) return;
    setTestLoading(true);
    try {
      const res = await axiosInstance.get(`/tests/${testId}`);
      const test = res.data;

      const supported = ['coding', 'mcq', 'aptitude', 'theory', 'mixed'].includes(test?.type);
      if (!supported) {
        setError('This test type is not editable in this UI.');
        return;
      }

      const nextType = test.type;

      const mappedQuestions = (test.questions || []).map((q) => {
        const qData = q?.questionId; // already populated in backend response
        const qId = qData && typeof qData === 'object' ? (qData._id || qData.id) : q?.questionId;
        return {
          questionId: qId ? String(qId) : q?.questionId,
          type: q.type,
          points: q.points ?? 10,
          order: q.order ?? 1,
          questionData: qData,
        };
      });

      setLockedType(nextType);
      setFormData({
        title: test.title || '',
        description: test.description || '',
        type: nextType,
        duration: test.duration ?? 60,
        startDate: toLocalDateTimeInput(test.startDate),
        endDate: toLocalDateTimeInput(test.endDate),
        autoSubmitAtWindowEnd: test.settings?.autoSubmitAtWindowEnd !== false,
        questions: mappedQuestions,
      });
      setSelectedTab(nextType === 'mixed' ? 'coding' : nextType);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load test');
    } finally {
      setTestLoading(false);
    }
  };

  useEffect(() => {
    // Wait until questions are loaded so selected questions can render titles correctly.
    if (isEditMode && testId && !loading) fetchTest();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditMode, testId, loading]);

  useEffect(() => {
    setSelectedTag('');
  }, [selectedTab, questionSource]);

  useEffect(() => {
    const sourceFilter = (list) =>
      list.filter((q) =>
        questionSource === 'my' ? q.source === 'vendor' : q.source === 'global'
      );

    const filterPool = (list, textFieldsFor) =>
      filterQuestionsBySearchAndTag(sourceFilter(list), {
        term: searchTerm,
        selectedTag,
        textFieldsFor,
      });

    setFilteredCoding(
      filterPool(codingQuestions, (q) => [q.title, q.description, q.difficulty])
    );
    setFilteredMcq(filterPool(mcqQuestions, (q) => [q.question, q.category, q.difficulty]));
    setFilteredAptitude(
      filterPool(aptitudeQuestions, (q) => [
        q.question,
        q.section,
        q.subCategory,
        q.questionType,
      ])
    );
    setFilteredTheory(
      filterPool(theoryQuestions, (q) => [
        q.questionText,
        q.subjectId?.name,
        q.topicId?.name,
      ])
    );
  }, [
    searchTerm,
    selectedTag,
    codingQuestions,
    mcqQuestions,
    aptitudeQuestions,
    theoryQuestions,
    questionSource,
  ]);

  const availableTagsByTab = useMemo(() => {
    const byTab = {
      coding: buildTagFilterOptions(
        registryTags,
        codingQuestions.flatMap((q) => q.tags || [])
      ),
      mcq: buildTagFilterOptions(registryTags, mcqQuestions.flatMap((q) => q.tags || [])),
      aptitude: buildTagFilterOptions(
        registryTags,
        aptitudeQuestions.flatMap((q) => q.tags || [])
      ),
      theory: buildTagFilterOptions(
        registryTags,
        theoryQuestions.flatMap((q) => q.tags || [])
      ),
    };
    return byTab;
  }, [registryTags, codingQuestions, mcqQuestions, aptitudeQuestions, theoryQuestions]);

  const fetchQuestions = async () => {
    try {
      setLoading(true);
      setError('');
      console.log('📥 Fetching questions...');
      
      const [codingRes, mcqRes, aptitudeRes, theoryRes] = await Promise.all([
        axiosInstance.get('/questions/coding'),
        axiosInstance.get('/questions/mcq'),
        axiosInstance.get('/questions/aptitude'),
        axiosInstance.get('/questions/theory')
      ]);
      
      console.log('✅ Coding questions:', codingRes.data?.length || 0);
      console.log('✅ MCQ questions:', mcqRes.data?.length || 0);
      console.log('✅ Aptitude questions:', aptitudeRes.data?.length || 0);
      console.log('✅ Theory questions:', theoryRes.data?.length || 0);
      
      setCodingQuestions(codingRes.data || []);
      setMcqQuestions(mcqRes.data || []);
      setAptitudeQuestions(aptitudeRes.data || []);
      setFilteredCoding(codingRes.data || []);
      setFilteredMcq(mcqRes.data || []);
      setFilteredAptitude(aptitudeRes.data || []);
      setTheoryQuestions(theoryRes.data || []);
      setFilteredTheory(theoryRes.data || []);
    } catch (error) {
      console.error('❌ Error fetching questions:', error);
      const errorMsg = error.response?.data?.message || 'Failed to load questions. Please try again.';
      setError(errorMsg);
      // Set empty arrays on error
      setCodingQuestions([]);
      setMcqQuestions([]);
      setAptitudeQuestions([]);
      setFilteredCoding([]);
      setFilteredMcq([]);
      setFilteredAptitude([]);
      setTheoryQuestions([]);
      setFilteredTheory([]);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleAddQuestion = (questionId, type, questionData) => {
    if (formData.type !== 'mixed' && type !== formData.type) {
      setError(`This test only supports ${formData.type.toUpperCase()} questions.`);
      return;
    }
    if (formData.questions.some((q) => String(q.questionId) === String(questionId))) {
      setError('This question is already in the test.');
      return;
    }
    setError('');

    const order = formData.questions.length + 1;
    setFormData({
      ...formData,
      questions: [...formData.questions, {
        questionId,
        type,
        points: 10,
        order,
        questionData // Store question data for display
      }]
    });
  };

  const handleRemoveQuestion = (index) => {
    const newQuestions = formData.questions.filter((_, i) => i !== index);
    // Reorder questions
    const reordered = newQuestions.map((q, i) => ({ ...q, order: i + 1 }));
    setFormData({
      ...formData,
      questions: reordered
    });
  };

  const handlePointsChange = (index, points) => {
    const newQuestions = [...formData.questions];
    newQuestions[index].points = parseInt(points) || 10;
    setFormData({
      ...formData,
      questions: newQuestions
    });
  };

  const handleMoveQuestion = (index, direction) => {
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === formData.questions.length - 1)
    ) {
      return;
    }

    const newQuestions = [...formData.questions];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    [newQuestions[index], newQuestions[targetIndex]] = [newQuestions[targetIndex], newQuestions[index]];
    
    // Update order
    newQuestions.forEach((q, i) => {
      q.order = i + 1;
    });

    setFormData({
      ...formData,
      questions: newQuestions
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    // Validation
    if (!formData.title.trim()) {
      setError('Test title is required');
      setSubmitting(false);
      return;
    }

    if (formData.questions.length === 0) {
      setError('Please add at least one question to the test');
      setSubmitting(false);
      return;
    }

    // Validate test type matches questions
    const hasCoding = formData.questions.some(q => q.type === 'coding');
    const hasMcq = formData.questions.some(q => q.type === 'mcq');
    const hasAptitude = formData.questions.some(q => q.type === 'aptitude');
    const hasTheory = formData.questions.some(q => q.type === 'theory');

    if (formData.type === 'coding' && (hasMcq || hasAptitude || hasTheory)) {
      setError('Coding test cannot contain other question types');
      setSubmitting(false);
      return;
    }

    if (formData.type === 'mcq' && (hasCoding || hasAptitude || hasTheory)) {
      setError('MCQ test cannot contain other question types');
      setSubmitting(false);
      return;
    }

    if (formData.type === 'aptitude' && (hasCoding || hasMcq || hasTheory)) {
      setError('Aptitude test cannot contain other question types');
      setSubmitting(false);
      return;
    }

    if (formData.type === 'theory' && (hasCoding || hasMcq || hasAptitude)) {
      setError('Theory test cannot contain other question types');
      setSubmitting(false);
      return;
    }

    const scheduleError = validateLocalScheduleRange(formData.startDate, formData.endDate);
    if (scheduleError) {
      setError(scheduleError);
      setSubmitting(false);
      return;
    }

    try {
      const schedulePayload = buildTestSchedulePayload({
        startDate: formData.startDate,
        endDate: formData.endDate,
      });
      // Prepare data for API (remove questionData)
      const submitData = {
        ...formData,
        ...schedulePayload,
        questions: formData.questions.map(({ questionData, ...q }) => q),
        settings: {
          autoSubmitAtWindowEnd: formData.autoSubmitAtWindowEnd,
        },
      };
      delete submitData.autoSubmitAtWindowEnd;

      if (isEditMode) {
        console.log('📤 Updating test:', submitData);
        await axiosInstance.put(`/tests/${testId}`, submitData);
        navigate(`/vendor-admin/tests?type=${encodeURIComponent(submitData.type || formData.type)}`);
      } else {
        await axiosInstance.post('/tests', submitData);
        navigate(`/vendor-admin/tests?type=${encodeURIComponent(formData.type)}`);
      }
    } catch (error) {
      console.error('❌ Error creating test:', error);
      const errorMsg = error.response?.data?.message || 
                      error.response?.data?.errors?.map(e => e.msg).join(', ') ||
                      isEditMode ? 'Error updating test. Please try again.' : 'Error creating test. Please try again.';
      setError(errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

  const getQuestionTitle = (questionId, type, questionData) => {
    if (questionData && typeof questionData === 'object') {
      if (type === 'coding') return questionData.title || 'Coding question';
      if (type === 'mcq') return questionData.question?.replace(/<[^>]+>/g, ' ').trim().slice(0, 60) || 'MCQ';
      if (type === 'theory') return questionData.questionText?.replace(/<[^>]+>/g, ' ').trim().slice(0, 60) || 'Theory';
      if (type === 'aptitude') return questionData.question?.replace(/<[^>]+>/g, ' ').trim().slice(0, 60) || 'Aptitude';
    }
    const id = String(questionId);
    if (type === 'coding') {
      const q = codingQuestions.find((x) => String(x._id) === id);
      return q?.title || 'Coding question';
    }
    if (type === 'mcq') {
      const q = mcqQuestions.find((x) => String(x._id) === id);
      return q?.question?.replace(/<[^>]+>/g, ' ').trim().slice(0, 60) || 'MCQ';
    }
    if (type === 'theory') {
      const q = theoryQuestions.find((x) => String(x._id) === id);
      return q?.questionText?.replace(/<[^>]+>/g, ' ').trim().slice(0, 60) || 'Theory';
    }
    const q = aptitudeQuestions.find((x) => String(x._id) === id);
    return q?.question?.replace(/<[^>]+>/g, ' ').trim().slice(0, 60) || 'Aptitude';
  };

  const testType = lockedType || formData.type;
  const meta = getTestFormMeta(testType, isEditMode);

  const questionPools = useMemo(
    () => ({
      coding: codingQuestions,
      mcq: mcqQuestions,
      aptitude: aptitudeQuestions,
      theory: theoryQuestions,
    }),
    [codingQuestions, mcqQuestions, aptitudeQuestions, theoryQuestions]
  );

  const totalPoints = useMemo(
    () => formData.questions.reduce((sum, q) => sum + (Number(q.points) || 0), 0),
    [formData.questions]
  );

  const stats = [
    { label: 'Questions', value: formData.questions.length, highlight: true },
    { label: 'Total points', value: totalPoints },
    { label: 'Duration', value: `${formData.duration} min` },
  ];

  const isQuestionAdded = (id) =>
    formData.questions.some((q) => String(q.questionId) === String(id));

  const footer = (
    <>
      <span className="vtf-footer-meta">
        {formData.questions.length === 0 ? (
          'Add at least one question to continue'
        ) : (
          <>
            <strong>{formData.questions.length}</strong> questions ·{' '}
            <strong>{totalPoints}</strong> points
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
        form="standard-test-form"
        className="va-btn va-btn--primary"
        disabled={submitting || formData.questions.length === 0}
        style={{ '--va-accent': meta.accent }}
      >
        {submitting
          ? isEditMode
            ? 'Saving…'
            : 'Creating…'
          : isEditMode
            ? 'Save test'
            : 'Create test'}
      </button>
    </>
  );

  return (
    <VendorTestFormPage
      loading={loading || testLoading}
      backTo={meta.back}
      backLabel="All assessments"
      eyebrow={meta.eyebrow}
      title={meta.title}
      subtitle={meta.subtitle}
      accent={meta.accent}
      error={error}
      stats={stats}
      footer={footer}
      wide
    >
      <form id="standard-test-form" onSubmit={handleSubmit}>
        <section className="vtf-section">
          <h2 className="vtf-section-title">Test details</h2>
          <div className="vtf-row">
            <div className="vtf-field">
              <label htmlFor="test-title">Title *</label>
              <input
                id="test-title"
                type="text"
                name="title"
                value={formData.title}
                onChange={handleChange}
                required
                placeholder="e.g. DSA Assessment — Arrays & Strings"
              />
            </div>
            <div className="vtf-field">
              <label htmlFor="test-duration">Duration (minutes) *</label>
              <input
                id="test-duration"
                type="number"
                name="duration"
                value={formData.duration}
                onChange={handleChange}
                required
                min={1}
              />
            </div>
            <div className="vtf-field">
              <label htmlFor="test-type">Test type *</label>
              <select
                id="test-type"
                name="type"
                value={formData.type}
                onChange={handleChange}
                required
                disabled={isEditMode || !!lockedType}
              >
                <option value="coding">Coding only</option>
                <option value="mcq">MCQ only</option>
                <option value="aptitude">Aptitude only</option>
                <option value="theory">Theory only</option>
                <option value="mixed">Mixed (all types)</option>
              </select>
            </div>
          </div>
          <div className="vtf-field">
            <label htmlFor="test-desc">Description</label>
            <textarea
              id="test-desc"
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={3}
              placeholder="Instructions and context for students…"
            />
          </div>
          <h3 className="vtf-subsection-title">Schedule (optional)</h3>
          <p className="vtf-section-hint">Leave blank for an always-available test.</p>
          <TestScheduleFields
            startDate={formData.startDate}
            endDate={formData.endDate}
            autoSubmitAtWindowEnd={formData.autoSubmitAtWindowEnd}
            onStartDateChange={handleChange}
            onEndDateChange={handleChange}
            onAutoSubmitChange={(checked) =>
              setFormData((prev) => ({ ...prev, autoSubmitAtWindowEnd: checked }))
            }
            startId="test-start"
            endId="test-end"
            fieldClassName="vtf-field"
            rowClassName="vtf-row"
          />
        </section>


        <VendorStandardTestBuilder
          formData={formData}
          selectedTab={selectedTab}
          setSelectedTab={setSelectedTab}
          questionSource={questionSource}
          setQuestionSource={setQuestionSource}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          selectedTag={selectedTag}
          setSelectedTag={setSelectedTag}
          availableTagsByTab={availableTagsByTab}
          filteredCoding={filteredCoding}
          filteredMcq={filteredMcq}
          filteredAptitude={filteredAptitude}
          filteredTheory={filteredTheory}
          questionPools={questionPools}
          onAddQuestion={handleAddQuestion}
          onRemoveQuestion={handleRemoveQuestion}
          onPointsChange={handlePointsChange}
          onMoveQuestion={handleMoveQuestion}
          getQuestionTitle={getQuestionTitle}
          isQuestionAdded={isQuestionAdded}
        />
      </form>
    </VendorTestFormPage>
  );
};

export default CreateTest;
