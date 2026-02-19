import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axiosInstance from '../../utils/axios';
import RichTextEditor from '../../components/RichTextEditor';
import './CreateSystemDesign.css';

const CATEGORIES = [
  { value: 'url_shortener', label: 'URL Shortener' },
  { value: 'chat_system', label: 'Chat System' },
  { value: 'ecommerce', label: 'E-Commerce' },
  { value: 'social_media', label: 'Social Media' },
  { value: 'streaming', label: 'Streaming Service' },
  { value: 'payment_system', label: 'Payment System' },
  { value: 'notification_system', label: 'Notification System' },
  { value: 'file_storage', label: 'File Storage' },
  { value: 'search_engine', label: 'Search Engine' },
  { value: 'rate_limiter', label: 'Rate Limiter' },
  { value: 'ride_sharing', label: 'Ride Sharing' },
  { value: 'food_delivery', label: 'Food Delivery' },
  { value: 'library_management', label: 'Library Management' },
  { value: 'parking_lot', label: 'Parking Lot' },
  { value: 'hotel_booking', label: 'Hotel Booking' },
  { value: 'custom', label: 'Custom' }
];

const SECTION_KEYS = [
  'requirements', 'capacityEstimation', 'coreEntities', 'apiDesign',
  'architecture', 'dataFlow', 'databaseDesign', 'scalingStrategy', 'deepDive', 'tradeoffs'
];

const SECTION_LABELS = {
  requirements: 'Requirements', capacityEstimation: 'Capacity Estimation', coreEntities: 'Core Entities',
  apiDesign: 'API Design', architecture: 'Architecture', dataFlow: 'Data Flow',
  databaseDesign: 'Database Design', scalingStrategy: 'Scaling Strategy', deepDive: 'Deep Dive', tradeoffs: 'Tradeoffs'
};

const DEFAULT_WEIGHTS = {
  requirements: 10, capacityEstimation: 10, coreEntities: 8, apiDesign: 10,
  architecture: 18, dataFlow: 8, databaseDesign: 12, scalingStrategy: 10, deepDive: 7, tradeoffs: 7
};

const CreateSystemDesign = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);
  const [activeTab, setActiveTab] = useState('basics');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    title: '', problemStatement: '', difficulty: 'medium', category: 'custom',
    duration: 90, businessContext: '',
    constraints: { estimatedUsers: '', estimatedQPS: '', storageNeeds: '', latencyRequirement: '', availabilityTarget: '' },
    sectionWeights: { ...DEFAULT_WEIGHTS },
    dataFlowScenarios: [''],
    deepDiveOptions: ['Database Scaling', 'Message Queue Handling', 'Consistency Models', 'Cache Invalidation', 'Rate Limiting', 'Search System Design', 'Data Partitioning'],
    evaluationConfig: { strictness: 'moderate', enableFollowUp: true, followUpCount: 3 },
    referenceAnswer: {},
    hints: {},
    isActive: true
  });

  const fetchProblem = useCallback(async () => {
    try {
      const { data } = await axiosInstance.get(`/system-design-problems/${id}`);
      if (data.success) {
        const p = data.problem;
        const defaultConstraints = { estimatedUsers: '', estimatedQPS: '', storageNeeds: '', latencyRequirement: '', availabilityTarget: '' };
        const defaultDeepDive = ['Database Scaling', 'Message Queue Handling', 'Consistency Models', 'Cache Invalidation', 'Rate Limiting', 'Search System Design', 'Data Partitioning'];
        const defaultEvalConfig = { strictness: 'moderate', enableFollowUp: true, followUpCount: 3 };
        setForm({
          title: p.title || '', problemStatement: p.problemStatement || '',
          difficulty: p.difficulty || 'medium', category: p.category || 'custom',
          duration: p.duration || 90, businessContext: p.businessContext || '',
          constraints: p.constraints || defaultConstraints,
          sectionWeights: p.sectionWeights || DEFAULT_WEIGHTS,
          dataFlowScenarios: p.dataFlowScenarios?.length ? p.dataFlowScenarios : [''],
          deepDiveOptions: p.deepDiveOptions?.length ? p.deepDiveOptions : defaultDeepDive,
          evaluationConfig: p.evaluationConfig || defaultEvalConfig,
          referenceAnswer: p.referenceAnswer || {},
          hints: p.hints || {},
          isActive: p.isActive !== false
        });
      }
    } catch (err) {
      setError('Failed to load problem');
    }
  }, [id]);

  useEffect(() => {
    if (isEdit) {
      fetchProblem();
    }
  }, [id, isEdit, fetchProblem]);

  const handleSave = async () => {
    if (!form.title.trim()) return setError('Title is required');
    if (!form.problemStatement.trim()) return setError('Problem statement is required');

    setSaving(true);
    setError('');
    try {
      if (isEdit) {
        await axiosInstance.put(`/system-design-problems/${id}`, form);
      } else {
        await axiosInstance.post('/system-design-problems', form);
      }
      navigate('/vendor-admin/tests?type=system');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const updateConstraint = (key, value) => {
    setForm(prev => ({ ...prev, constraints: { ...prev.constraints, [key]: value } }));
  };

  const updateWeight = (key, value) => {
    setForm(prev => ({ ...prev, sectionWeights: { ...prev.sectionWeights, [key]: parseInt(value) || 0 } }));
  };

  const totalWeight = Object.values(form.sectionWeights).reduce((a, b) => a + b, 0);

  const tabs = [
    { id: 'basics', label: 'Basics' },
    { id: 'problem', label: 'Problem Statement' },
    { id: 'weights', label: 'Section Weights' },
    { id: 'reference', label: 'Reference Answers' },
    { id: 'hints', label: 'Hints' },
    { id: 'advanced', label: 'Advanced' }
  ];

  return (
    <div className="csd-container">
      <div className="csd-header">
        <h1>{isEdit ? 'Edit' : 'Create'} System Design Problem</h1>
        <div className="csd-header-actions">
          <button className="csd-btn secondary" onClick={() => navigate('/vendor-admin/tests?type=system')}>Cancel</button>
          <button className="csd-btn primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : isEdit ? 'Update' : 'Create'}
          </button>
        </div>
      </div>

      {error && <div className="csd-error">{error}</div>}

      <div className="csd-tabs">
        {tabs.map(t => (
          <button key={t.id} className={`csd-tab ${activeTab === t.id ? 'active' : ''}`} onClick={() => setActiveTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="csd-content">
        {activeTab === 'basics' && (
          <div className="csd-section">
            <div className="csd-field">
              <label>Title *</label>
              <input type="text" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g., Design a URL Shortener like Bitly" />
            </div>
            <div className="csd-row">
              <div className="csd-field">
                <label>Category *</label>
                <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                  {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div className="csd-field">
                <label>Difficulty *</label>
                <select value={form.difficulty} onChange={e => setForm({ ...form, difficulty: e.target.value })}>
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </div>
              <div className="csd-field">
                <label>Duration (minutes) *</label>
                <input type="number" value={form.duration} min="15" max="300" onChange={e => setForm({ ...form, duration: parseInt(e.target.value) || 90 })} />
              </div>
            </div>
            <div className="csd-field">
              <label>Business Context</label>
              <RichTextEditor
                value={form.businessContext}
                onChange={val => setForm({ ...form, businessContext: val })}
                placeholder="Describe the business scenario and context..."
                minHeight={120}
              />
            </div>
            <h3>Constraints</h3>
            <div className="csd-row">
              <div className="csd-field"><label>Estimated Users</label><input type="text" value={form.constraints.estimatedUsers} onChange={e => updateConstraint('estimatedUsers', e.target.value)} placeholder="e.g., 100M monthly active users" /></div>
              <div className="csd-field"><label>Estimated QPS</label><input type="text" value={form.constraints.estimatedQPS} onChange={e => updateConstraint('estimatedQPS', e.target.value)} placeholder="e.g., 10K reads/sec, 1K writes/sec" /></div>
            </div>
            <div className="csd-row">
              <div className="csd-field"><label>Storage Needs</label><input type="text" value={form.constraints.storageNeeds} onChange={e => updateConstraint('storageNeeds', e.target.value)} placeholder="e.g., 500TB over 5 years" /></div>
              <div className="csd-field"><label>Latency Requirement</label><input type="text" value={form.constraints.latencyRequirement} onChange={e => updateConstraint('latencyRequirement', e.target.value)} placeholder="e.g., < 200ms for reads" /></div>
            </div>
            <div className="csd-field" style={{ maxWidth: '50%' }}>
              <label>Availability Target</label>
              <input type="text" value={form.constraints.availabilityTarget} onChange={e => updateConstraint('availabilityTarget', e.target.value)} placeholder="e.g., 99.99%" />
            </div>
            <div className="csd-field">
              <label className="csd-checkbox-label">
                <input type="checkbox" checked={form.isActive} onChange={e => setForm({ ...form, isActive: e.target.checked })} />
                Active (visible to students)
              </label>
            </div>
          </div>
        )}

        {activeTab === 'problem' && (
          <div className="csd-section">
            <div className="csd-field">
              <label>Problem Statement * (Rich Text)</label>
              <RichTextEditor value={form.problemStatement} onChange={val => setForm({ ...form, problemStatement: val })} />
            </div>
          </div>
        )}

        {activeTab === 'weights' && (
          <div className="csd-section">
            <p className="csd-info">Configure how much each section contributes to the total score. Weights should sum to 100.</p>
            <div className="csd-weight-total" style={{ color: totalWeight === 100 ? '#27ae60' : '#e53935' }}>
              Total: {totalWeight}/100 {totalWeight === 100 ? '(Valid)' : '(Must equal 100)'}
            </div>
            <div className="csd-weights-grid">
              {SECTION_KEYS.map(key => (
                <div key={key} className="csd-weight-item">
                  <label>{SECTION_LABELS[key]}</label>
                  <div className="csd-weight-input-wrap">
                    <input type="range" min="0" max="30" value={form.sectionWeights[key] || 0} onChange={e => updateWeight(key, e.target.value)} />
                    <span className="csd-weight-value">{form.sectionWeights[key] || 0}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'reference' && (
          <div className="csd-section">
            <p className="csd-info">Provide ideal/reference answers for each section. Use rich text formatting for clarity. These help the AI evaluate student submissions more accurately.</p>
            {SECTION_KEYS.map(key => (
              <div key={key} className="csd-ref-section">
                <h3>{SECTION_LABELS[key]}</h3>
                <RichTextEditor
                  value={typeof form.referenceAnswer[key] === 'string' ? form.referenceAnswer[key] : ''}
                  onChange={val => {
                    setForm(prev => ({
                      ...prev,
                      referenceAnswer: { ...prev.referenceAnswer, [key]: val }
                    }));
                  }}
                  placeholder={`Ideal answer for ${SECTION_LABELS[key]}...`}
                  minHeight={120}
                />
              </div>
            ))}
          </div>
        )}

        {activeTab === 'hints' && (
          <div className="csd-section">
            <p className="csd-info">Add progressive hints for each section. Each hint used incurs a score penalty. Use rich text for formatting.</p>
            {SECTION_KEYS.map(key => (
              <div key={key} className="csd-hint-section">
                <h3>{SECTION_LABELS[key]}</h3>
                {(form.hints[key] || []).map((hint, idx) => (
                  <div key={idx} className="csd-hint-item">
                    <div className="csd-hint-editor-row">
                      <div className="csd-hint-editor-wrap">
                        <RichTextEditor
                          value={hint.text || ''}
                          onChange={val => {
                            const updated = [...(form.hints[key] || [])];
                            updated[idx] = { ...updated[idx], text: val };
                            setForm(prev => ({ ...prev, hints: { ...prev.hints, [key]: updated } }));
                          }}
                          placeholder={`Hint ${idx + 1} content...`}
                          minHeight={80}
                        />
                      </div>
                      <div className="csd-hint-controls">
                        <div className="csd-hint-penalty-wrap">
                          <label>Penalty:</label>
                          <input type="number" min="0" max="50" value={hint.penaltyPercent || 5} onChange={e => {
                            const updated = [...(form.hints[key] || [])];
                            updated[idx] = { ...updated[idx], penaltyPercent: parseInt(e.target.value) || 5 };
                            setForm(prev => ({ ...prev, hints: { ...prev.hints, [key]: updated } }));
                          }} className="csd-hint-penalty" />
                          <span>%</span>
                        </div>
                        <button className="csd-hint-remove" onClick={() => {
                          const updated = (form.hints[key] || []).filter((_, i) => i !== idx);
                          setForm(prev => ({ ...prev, hints: { ...prev.hints, [key]: updated } }));
                        }}>Remove</button>
                      </div>
                    </div>
                  </div>
                ))}
                <button className="csd-btn-small" onClick={() => {
                  const updated = [...(form.hints[key] || []), { text: '', penaltyPercent: 5 }];
                  setForm(prev => ({ ...prev, hints: { ...prev.hints, [key]: updated } }));
                }}>+ Add Hint</button>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'advanced' && (
          <div className="csd-section">
            <h3>Data Flow Scenarios</h3>
            <p className="csd-info">Pre-populated scenarios that students will describe step-by-step.</p>
            {form.dataFlowScenarios.map((s, idx) => (
              <div key={idx} className="csd-scenario-row">
                <input type="text" value={s} onChange={e => {
                  const updated = [...form.dataFlowScenarios];
                  updated[idx] = e.target.value;
                  setForm(prev => ({ ...prev, dataFlowScenarios: updated }));
                }} placeholder="e.g., User creates a short URL" />
                <button className="csd-hint-remove" onClick={() => {
                  setForm(prev => ({ ...prev, dataFlowScenarios: prev.dataFlowScenarios.filter((_, i) => i !== idx) }));
                }}>Remove</button>
              </div>
            ))}
            <button className="csd-btn-small" onClick={() => setForm(prev => ({ ...prev, dataFlowScenarios: [...prev.dataFlowScenarios, ''] }))}>+ Add Scenario</button>

            <h3 style={{ marginTop: 24 }}>Deep Dive Topic Options</h3>
            {form.deepDiveOptions.map((opt, idx) => (
              <div key={idx} className="csd-scenario-row">
                <input type="text" value={opt} onChange={e => {
                  const updated = [...form.deepDiveOptions];
                  updated[idx] = e.target.value;
                  setForm(prev => ({ ...prev, deepDiveOptions: updated }));
                }} />
                <button className="csd-hint-remove" onClick={() => {
                  setForm(prev => ({ ...prev, deepDiveOptions: prev.deepDiveOptions.filter((_, i) => i !== idx) }));
                }}>Remove</button>
              </div>
            ))}
            <button className="csd-btn-small" onClick={() => setForm(prev => ({ ...prev, deepDiveOptions: [...prev.deepDiveOptions, ''] }))}>+ Add Topic</button>

            <h3 style={{ marginTop: 24 }}>Evaluation Settings</h3>
            <div className="csd-row">
              <div className="csd-field">
                <label>Strictness</label>
                <select value={form.evaluationConfig.strictness} onChange={e => setForm(prev => ({ ...prev, evaluationConfig: { ...prev.evaluationConfig, strictness: e.target.value } }))}>
                  <option value="lenient">Lenient</option>
                  <option value="moderate">Moderate</option>
                  <option value="strict">Strict</option>
                </select>
              </div>
              <div className="csd-field">
                <label>Follow-up Questions Count</label>
                <input type="number" min="1" max="5" value={form.evaluationConfig.followUpCount} onChange={e => setForm(prev => ({ ...prev, evaluationConfig: { ...prev.evaluationConfig, followUpCount: parseInt(e.target.value) || 3 } }))} />
              </div>
            </div>
            <div className="csd-field">
              <label className="csd-checkbox-label">
                <input type="checkbox" checked={form.evaluationConfig.enableFollowUp} onChange={e => setForm(prev => ({ ...prev, evaluationConfig: { ...prev.evaluationConfig, enableFollowUp: e.target.checked } }))} />
                Enable AI Follow-up Questions (post-submission defense)
              </label>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CreateSystemDesign;
