import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Link } from 'react-router-dom';
import axiosInstance from '../../utils/axios';
import './CreateTest.css';

const CreateTest = () => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    type: 'mixed',
    duration: 60,
    questions: [],
    startDate: '',
    endDate: ''
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
  const [selectedTab, setSelectedTab] = useState('coding');
  const [questionSource, setQuestionSource] = useState('my'); // 'my' or 'global'
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  const typeParam = new URLSearchParams(location.search).get('type');
  const lockedType = ['coding', 'mcq', 'aptitude', 'theory', 'mixed'].includes(typeParam) ? typeParam : null;

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

  useEffect(() => {
    // Filter questions based on search term and source
    const term = searchTerm.toLowerCase();
    
    // Filter by source first
    const sourceFilteredCoding = codingQuestions.filter(q => 
      questionSource === 'my' ? q.source === 'vendor' : q.source === 'global'
    );
    const sourceFilteredMcq = mcqQuestions.filter(q => 
      questionSource === 'my' ? q.source === 'vendor' : q.source === 'global'
    );
    const sourceFilteredAptitude = aptitudeQuestions.filter(q =>
      questionSource === 'my' ? q.source === 'vendor' : q.source === 'global'
    );
    const sourceFilteredTheory = theoryQuestions.filter(q =>
      questionSource === 'my' ? q.source === 'vendor' : q.source === 'global'
    );
    
    // Then filter by search term
    setFilteredCoding(
      sourceFilteredCoding.filter(q => 
        q.title.toLowerCase().includes(term) || 
        q.description?.toLowerCase().includes(term) ||
        q.difficulty?.toLowerCase().includes(term)
      )
    );
    setFilteredMcq(
      sourceFilteredMcq.filter(q => 
        q.question.toLowerCase().includes(term) ||
        q.difficulty?.toLowerCase().includes(term)
      )
    );
    setFilteredAptitude(
      sourceFilteredAptitude.filter(q =>
        q.question.toLowerCase().includes(term) ||
        q.section?.toLowerCase().includes(term) ||
        q.subCategory?.toLowerCase().includes(term)
      )
    );
    setFilteredTheory(
      sourceFilteredTheory.filter(q =>
        q.questionText.toLowerCase().includes(term) ||
        q.subjectId?.name?.toLowerCase().includes(term) ||
        q.topicId?.name?.toLowerCase().includes(term)
      )
    );
  }, [searchTerm, codingQuestions, mcqQuestions, aptitudeQuestions, theoryQuestions, questionSource]);

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
      alert(`This test only supports ${formData.type.toUpperCase()} questions.`);
      return;
    }
    // Check if question already added
    if (formData.questions.some(q => q.questionId === questionId)) {
      alert('This question is already added to the test');
      return;
    }

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

    // Mixed test can have either or both types
    // No additional validation needed for mixed type

    try {
      // Prepare data for API (remove questionData)
      const submitData = {
        ...formData,
        questions: formData.questions.map(({ questionData, ...q }) => q)
      };

      console.log('📤 Creating test:', submitData);
      const response = await axiosInstance.post('/tests', submitData);
      console.log('✅ Test created:', response.data);
      
      alert('Test created successfully!');
      navigate('/vendor-admin/tests');
    } catch (error) {
      console.error('❌ Error creating test:', error);
      const errorMsg = error.response?.data?.message || 
                      error.response?.data?.errors?.map(e => e.msg).join(', ') ||
                      'Error creating test. Please try again.';
      setError(errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

  const getQuestionTitle = (questionId, type) => {
    if (type === 'coding') {
      const q = codingQuestions.find(q => q._id === questionId);
      return q?.title || 'Coding Question';
    }
    if (type === 'mcq') {
      const q = mcqQuestions.find(q => q._id === questionId);
      return q?.question || 'MCQ Question';
    }
    if (type === 'theory') {
      const q = theoryQuestions.find(q => q._id === questionId);
      return q?.questionText || 'Theory Question';
    }
    const q = aptitudeQuestions.find(q => q._id === questionId);
    return q?.question || 'Aptitude Question';
  };

  if (loading) {
    return <div className="loading">Loading questions...</div>;
  }

  return (
    <div className="container">
      <div className="page-header">
        <h1 className="page-title">Create Test</h1>
        <Link to="/vendor-admin/tests" className="btn btn-secondary">
          Back to Tests
        </Link>
      </div>

      {error && (
        <div className="error" style={{ marginBottom: '20px' }}>
          {error}
        </div>
      )}

      <div className="card">
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label>Test Title *</label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleChange}
                required
                placeholder="e.g., DSA Assessment - Arrays and Strings"
              />
            </div>
            <div className="form-group">
              <label>Duration (minutes) *</label>
              <input
                type="number"
                name="duration"
                value={formData.duration}
                onChange={handleChange}
                required
                min="1"
                placeholder="60"
              />
            </div>
          </div>

          <div className="form-group">
            <label>Description</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows="3"
              placeholder="Test description and instructions..."
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Test Type *</label>
              <select name="type" value={formData.type} onChange={handleChange} required disabled={!!lockedType}>
                <option value="coding">Coding Only (DSA Questions)</option>
                <option value="mcq">MCQ Only</option>
                <option value="aptitude">Aptitude Only</option>
                <option value="theory">Theory Only</option>
                <option value="mixed">Mixed (All Types)</option>
              </select>
            </div>
            <div className="form-group">
              <label>Start Date (Optional)</label>
              <input
                type="datetime-local"
                name="startDate"
                value={formData.startDate}
                onChange={handleChange}
              />
            </div>
            <div className="form-group">
              <label>End Date (Optional)</label>
              <input
                type="datetime-local"
                name="endDate"
                value={formData.endDate}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="questions-section">
            <div className="section-header">
              <h2>Add Questions</h2>
              <div className="question-stats">
                <span>Total: {formData.questions.length}</span>
                <span>Coding: {formData.questions.filter(q => q.type === 'coding').length}</span>
                <span>MCQ: {formData.questions.filter(q => q.type === 'mcq').length}</span>
                <span>Aptitude: {formData.questions.filter(q => q.type === 'aptitude').length}</span>
                <span>Theory: {formData.questions.filter(q => q.type === 'theory').length}</span>
              </div>
            </div>

            {codingQuestions.length === 0 && mcqQuestions.length === 0 && aptitudeQuestions.length === 0 && theoryQuestions.length === 0 ? (
              <div className="no-questions">
                <p>No questions available. Create questions first!</p>
                <div style={{ marginTop: '20px' }}>
                  <Link to="/vendor-admin/questions/coding/create" className="btn btn-primary" style={{ marginRight: '10px' }}>
                    Create Coding Question
                  </Link>
                  <Link to="/vendor-admin/questions/mcq/create" className="btn btn-primary">
                    Create MCQ Question
                  </Link>
                  <Link to="/vendor-admin/questions/aptitude/create" className="btn btn-primary" style={{ marginLeft: '10px' }}>
                    Create Aptitude Question
                  </Link>
                  <Link to="/vendor-admin/questions/theory/create" className="btn btn-primary" style={{ marginLeft: '10px' }}>
                    Create Theory Question
                  </Link>
                </div>
              </div>
            ) : (
              <>
                {/* Question Source Selector */}
                <div className="btn-group" style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setQuestionSource('my')}
                    className={`btn ${questionSource === 'my' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ flex: 1 }}
                  >
                    🏢 My Questions ({codingQuestions.filter(q => q.source === 'vendor').length + mcqQuestions.filter(q => q.source === 'vendor').length + aptitudeQuestions.filter(q => q.source === 'vendor').length + theoryQuestions.filter(q => q.source === 'vendor').length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuestionSource('global')}
                    className={`btn ${questionSource === 'global' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ flex: 1 }}
                  >
                    🌐 Global Questions ({codingQuestions.filter(q => q.source === 'global').length + mcqQuestions.filter(q => q.source === 'global').length + aptitudeQuestions.filter(q => q.source === 'global').length + theoryQuestions.filter(q => q.source === 'global').length})
                  </button>
                </div>

                <div className="search-bar">
                  <input
                    type="text"
                    placeholder={`Search ${questionSource === 'my' ? 'my' : 'global'} questions...`}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="search-input"
                  />
                </div>

                <div className="question-tabs">
                  {(formData.type === 'mixed' || formData.type === 'coding') && (
                    <button
                      type="button"
                      className={`tab-btn ${selectedTab === 'coding' ? 'active' : ''}`}
                      onClick={() => setSelectedTab('coding')}
                    >
                      Coding Questions ({filteredCoding.length})
                    </button>
                  )}
                  {(formData.type === 'mixed' || formData.type === 'mcq') && (
                    <button
                      type="button"
                      className={`tab-btn ${selectedTab === 'mcq' ? 'active' : ''}`}
                      onClick={() => setSelectedTab('mcq')}
                    >
                      MCQ Questions ({filteredMcq.length})
                    </button>
                  )}
                  {(formData.type === 'mixed' || formData.type === 'aptitude') && (
                    <button
                      type="button"
                      className={`tab-btn ${selectedTab === 'aptitude' ? 'active' : ''}`}
                      onClick={() => setSelectedTab('aptitude')}
                    >
                      Aptitude Questions ({filteredAptitude.length})
                    </button>
                  )}
                  {(formData.type === 'mixed' || formData.type === 'theory') && (
                    <button
                      type="button"
                      className={`tab-btn ${selectedTab === 'theory' ? 'active' : ''}`}
                      onClick={() => setSelectedTab('theory')}
                    >
                      Theory Questions ({filteredTheory.length})
                    </button>
                  )}
                </div>

                <div className="questions-grid">
                  {selectedTab === 'coding' && (
                    <div className="question-list">
                      {filteredCoding.length === 0 ? (
                        <div className="empty-state">
                          {searchTerm ? 'No questions match your search' : `No ${questionSource === 'my' ? 'my' : 'global'} coding questions available`}
                          {questionSource === 'my' && (
                            <Link to="/vendor-admin/questions/coding/create" className="btn btn-primary" style={{ marginTop: '10px', display: 'inline-block' }}>
                              Create Coding Question
                            </Link>
                          )}
                        </div>
                      ) : (
                        filteredCoding.map(q => (
                          <div key={q._id} className="question-card">
                            <div className="question-header">
                              <h4>{q.title}</h4>
                              <span className={`difficulty-badge ${q.difficulty}`}>
                                {q.difficulty || 'medium'}
                              </span>
                            </div>
                            <p className="question-preview">
                              {q.description?.substring(0, 100)}...
                            </p>
                            <div className="question-meta">
                              <span>Languages: {q.allowedLanguages?.join(', ') || 'N/A'}</span>
                              <span>Test Cases: {q.testCases?.length || 0}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleAddQuestion(q._id, 'coding', q)}
                              className="btn btn-primary btn-sm"
                              disabled={formData.questions.some(added => added.questionId === q._id)}
                            >
                              {formData.questions.some(added => added.questionId === q._id) ? 'Added' : 'Add Question'}
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {selectedTab === 'mcq' && (
                    <div className="question-list">
                      {filteredMcq.length === 0 ? (
                        <div className="empty-state">
                          {searchTerm ? 'No questions match your search' : `No ${questionSource === 'my' ? 'my' : 'global'} MCQ questions available`}
                          {questionSource === 'my' && (
                            <Link to="/vendor-admin/questions/mcq/create" className="btn btn-primary" style={{ marginTop: '10px', display: 'inline-block' }}>
                              Create MCQ Question
                            </Link>
                          )}
                        </div>
                      ) : (
                        filteredMcq.map(q => (
                          <div key={q._id} className="question-card">
                            <div className="question-header">
                              <h4>{q.question}</h4>
                              <span className={`difficulty-badge ${q.difficulty}`}>
                                {q.difficulty || 'medium'}
                              </span>
                            </div>
                            <div className="question-meta">
                              <span>Options: {q.options?.length || 0}</span>
                              <span>Points: {q.points || 10}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleAddQuestion(q._id, 'mcq', q)}
                              className="btn btn-primary btn-sm"
                              disabled={formData.questions.some(added => added.questionId === q._id)}
                            >
                              {formData.questions.some(added => added.questionId === q._id) ? 'Added' : 'Add Question'}
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {selectedTab === 'aptitude' && (
                    <div className="question-list">
                      {filteredAptitude.length === 0 ? (
                        <div className="empty-state">
                          {searchTerm ? 'No questions match your search' : `No ${questionSource === 'my' ? 'my' : 'global'} aptitude questions available`}
                          {questionSource === 'my' && (
                            <Link to="/vendor-admin/questions/aptitude/create" className="btn btn-primary" style={{ marginTop: '10px', display: 'inline-block' }}>
                              Create Aptitude Question
                            </Link>
                          )}
                        </div>
                      ) : (
                        filteredAptitude.map(q => (
                          <div key={q._id} className="question-card">
                            <div className="question-header">
                              <h4>{q.question}</h4>
                              <span className={`difficulty-badge ${q.difficulty}`}>
                                {q.difficulty || 'medium'}
                              </span>
                            </div>
                            <div className="question-meta">
                              <span>Section: {q.section}</span>
                              <span>Type: {q.questionType}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleAddQuestion(q._id, 'aptitude', q)}
                              className="btn btn-primary btn-sm"
                              disabled={formData.questions.some(added => added.questionId === q._id)}
                            >
                              {formData.questions.some(added => added.questionId === q._id) ? 'Added' : 'Add Question'}
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {selectedTab === 'theory' && (
                    <div className="question-list">
                      {filteredTheory.length === 0 ? (
                        <div className="empty-state">
                          {searchTerm ? 'No questions match your search' : `No ${questionSource === 'my' ? 'my' : 'global'} theory questions available`}
                          {questionSource === 'my' && (
                            <Link to="/vendor-admin/questions/theory/create" className="btn btn-primary" style={{ marginTop: '10px', display: 'inline-block' }}>
                              Create Theory Question
                            </Link>
                          )}
                        </div>
                      ) : (
                        filteredTheory.map(q => (
                          <div key={q._id} className="question-card">
                            <div className="question-header">
                              <h4>{q.questionText}</h4>
                              <span className={`difficulty-badge ${q.difficulty}`}>
                                {q.difficulty || 'medium'}
                              </span>
                            </div>
                            <div className="question-meta">
                              <span>Subject: {q.subjectId?.name || 'N/A'}</span>
                              <span>Marks: {q.maxMarks || 10}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleAddQuestion(q._id, 'theory', q)}
                              className="btn btn-primary btn-sm"
                              disabled={formData.questions.some(added => added.questionId === q._id)}
                            >
                              {formData.questions.some(added => added.questionId === q._id) ? 'Added' : 'Add Question'}
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {formData.questions.length > 0 && (
            <div className="selected-questions-section">
              <h2>Selected Questions ({formData.questions.length})</h2>
              <div className="selected-questions-list">
                {formData.questions.map((q, index) => (
                  <div key={index} className="selected-question-item">
                    <div className="question-info">
                      <div className="question-number">Q{index + 1}</div>
                      <div className="question-details">
                        <h4>{getQuestionTitle(q.questionId, q.type)}</h4>
                        <span className={`question-type-badge ${q.type}`}>
                          {q.type.toUpperCase()}
                        </span>
                      </div>
                    </div>
                    <div className="question-controls">
                      <div className="points-input">
                        <label>Points:</label>
                        <input
                          type="number"
                          min="1"
                          value={q.points}
                          onChange={(e) => handlePointsChange(index, e.target.value)}
                          style={{ width: '80px', marginLeft: '5px' }}
                        />
                      </div>
                      <div className="move-buttons">
                        <button
                          type="button"
                          onClick={() => handleMoveQuestion(index, 'up')}
                          disabled={index === 0}
                          className="btn btn-sm btn-secondary"
                          title="Move up"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveQuestion(index, 'down')}
                          disabled={index === formData.questions.length - 1}
                          className="btn btn-sm btn-secondary"
                          title="Move down"
                        >
                          ↓
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveQuestion(index)}
                        className="btn btn-sm btn-danger"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="form-actions">
            <button
              type="button"
              onClick={() => navigate('/vendor-admin/tests')}
              className="btn btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting || formData.questions.length === 0}
            >
              {submitting ? 'Creating Test...' : 'Create Test'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateTest;
