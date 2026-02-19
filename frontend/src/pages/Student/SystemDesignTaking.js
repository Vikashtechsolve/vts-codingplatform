import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axiosInstance from '../../utils/axios';
import { useExamSecurity } from '../../hooks/useExamSecurity';
import ArchitectureBuilder from '../../components/SystemDesign/ArchitectureBuilder';
import './SystemDesignTaking.css';

const STEPS = [
  { id: 'overview', label: 'Problem Overview', icon: '📋' },
  { id: 'requirements', label: 'Requirements', icon: '📝' },
  { id: 'capacityEstimation', label: 'Capacity Estimation', icon: '🧮' },
  { id: 'coreEntities', label: 'Core Entities', icon: '🗂️' },
  { id: 'apiDesign', label: 'API Design', icon: '🔌' },
  { id: 'architecture', label: 'Architecture', icon: '🏗️' },
  { id: 'dataFlow', label: 'Data Flow', icon: '🔄' },
  { id: 'databaseDesign', label: 'Database Design', icon: '💾' },
  { id: 'scalingStrategy', label: 'Scaling Strategy', icon: '📈' },
  { id: 'deepDive', label: 'Deep Dive', icon: '🔬' },
  { id: 'tradeoffs', label: 'Tradeoffs', icon: '⚖️' },
  { id: 'review', label: 'Review & Submit', icon: '🚀' }
];

const DB_TYPES = ['PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'Cassandra', 'DynamoDB', 'Neo4j', 'Elasticsearch'];
const HTTP_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
const METHOD_COLORS = { GET: '#27ae60', POST: '#2980b9', PUT: '#f39c12', DELETE: '#e74c3c', PATCH: '#8e44ad' };
const SCALING_STRATEGIES = [
  'Horizontal Scaling', 'Vertical Scaling', 'Load Balancing', 'Database Sharding',
  'Read Replicas', 'Caching', 'CDN', 'Rate Limiting', 'Auto-scaling',
  'Connection Pooling', 'Database Federation', 'Async Processing'
];

const SystemDesignTaking = () => {
  const { problemId } = useParams();
  const navigate = useNavigate();
  const [problem, setProblem] = useState(null);
  const [submission, setSubmission] = useState(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [timeLeft, setTimeLeft] = useState(null);
  const [showHints, setShowHints] = useState(false);
  const [sectionTimers, setSectionTimers] = useState({});
  const [violationModal, setViolationModal] = useState(null);
  const timerRef = useRef(null);
  const sectionStartRef = useRef(Date.now());
  const handleSubmitRef = useRef(() => {});
  const autoSaveTimerRef = useRef(null);
  const submissionRef = useRef(null);
  const currentStepRef = useRef(0);

  // Exam security — anti-cheating
  const handleMaxViolations = useCallback(() => {
    setViolationModal({
      title: 'Auto-Submission',
      message: 'You have reached the maximum number of violations (3). Your test is being automatically submitted.',
      type: 'error'
    });
    setTimeout(() => {
      const sub = submissionRef.current;
      if (sub) navigate(`/student/system-design/${sub._id}/follow-up`);
    }, 2500);
  }, [navigate]);

  const handleViolationWarning = useCallback((current, max) => {
    setViolationModal({
      title: 'Violation Warning',
      message: `Warning: You have ${current} of ${max} allowed violations. After ${max} violations your test will be automatically submitted. Please follow the exam rules.`,
      type: 'warning'
    });
    setTimeout(() => setViolationModal(null), 5000);
  }, []);

  const { violations, isFullscreen, requestFullscreen } = useExamSecurity(
    submission?._id || null,
    handleMaxViolations,
    handleViolationWarning,
    { violationEndpoint: submission ? `/system-design-submissions/${submission._id}/violation` : null }
  );

  // Keep refs in sync for use in beforeunload / auto-save
  useEffect(() => { submissionRef.current = submission; }, [submission]);
  useEffect(() => { currentStepRef.current = currentStep; }, [currentStep]);

  const startDesign = useCallback(async () => {
    try {
      setLoading(true);
      const problemRes = await axiosInstance.get(`/system-design-problems/${problemId}`);
      if (!problemRes.data.success) return;
      setProblem(problemRes.data.problem);

      const { data } = await axiosInstance.post(`/system-design-submissions/start/${problemId}`);
      if (data.success) {
        setSubmission(data.submission);
        if (data.submission.currentStep > 0) setCurrentStep(data.submission.currentStep);
      }
    } catch (err) {
      console.error('Error starting:', err);
    } finally {
      setLoading(false);
    }
  }, [problemId]);

  useEffect(() => {
    startDesign();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [startDesign]);

  // Save current section on page close / refresh
  useEffect(() => {
    const handleBeforeUnload = () => {
      const sub = submissionRef.current;
      const step = currentStepRef.current;
      const sectionKey = STEPS[step]?.id;
      if (!sub || !sectionKey || sectionKey === 'overview' || sectionKey === 'review') return;
      const sectionData = sub.sections?.[sectionKey];
      if (!sectionData) return;
      const token = localStorage.getItem('token');
      const url = `${axiosInstance.defaults.baseURL}/system-design-submissions/${sub._id}/save-section`;
      fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ section: sectionKey, data: sectionData, timeSpent: 0 }),
        keepalive: true,
      }).catch(() => {});
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  // Countdown timer
  useEffect(() => {
    if (!submission?.startedAt || !problem?.duration) return;
    const endTime = new Date(submission.startedAt).getTime() + problem.duration * 60 * 1000;

    timerRef.current = setInterval(() => {
      const remaining = Math.max(0, endTime - Date.now());
      setTimeLeft(remaining);
      if (remaining <= 0) {
        clearInterval(timerRef.current);
        handleSubmitRef.current(true);
      }
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [submission?.startedAt, problem?.duration]);

  // Track section time
  useEffect(() => {
    sectionStartRef.current = Date.now();
    return () => {
      const sectionKey = STEPS[currentStep]?.id;
      if (sectionKey && sectionKey !== 'overview' && sectionKey !== 'review') {
        const elapsed = Math.round((Date.now() - sectionStartRef.current) / 1000);
        setSectionTimers(prev => ({ ...prev, [sectionKey]: (prev[sectionKey] || 0) + elapsed }));
      }
    };
  }, [currentStep]);

  const saveSection = useCallback(async (sectionKey, data) => {
    if (!submission) return;
    setSaving(true);
    try {
      await axiosInstance.put(`/system-design-submissions/${submission._id}/save-section`, {
        section: sectionKey,
        data,
        timeSpent: sectionTimers[sectionKey] || 0
      });
      setLastSaved(new Date());
    } catch (err) {
      console.error('Save error:', err);
    } finally {
      setSaving(false);
    }
  }, [submission, sectionTimers]);

  const updateSection = (sectionKey, data) => {
    setSubmission(prev => ({
      ...prev,
      sections: { ...prev.sections, [sectionKey]: data }
    }));

    // Debounced auto-save: saves 3 seconds after the last change
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      const sub = submissionRef.current;
      if (sub && sectionKey !== 'overview' && sectionKey !== 'review') {
        saveSection(sectionKey, sub.sections?.[sectionKey]);
      }
    }, 3000);
  };

  const goToStep = (step) => {
    const sectionKey = STEPS[currentStep]?.id;
    if (sectionKey && submission?.sections?.[sectionKey] && sectionKey !== 'overview' && sectionKey !== 'review') {
      saveSection(sectionKey, submission.sections[sectionKey]);
    }
    setCurrentStep(step);
    axiosInstance.put(`/system-design-submissions/${submission._id}/update-step`, { step }).catch(() => {});
  };

  const useHint = async (section, hintIndex) => {
    try {
      const { data } = await axiosInstance.post(`/system-design-submissions/${submission._id}/use-hint`, { section, hintIndex });
      if (data.success && !data.alreadyUsed) {
        setSubmission(prev => ({
          ...prev,
          hintsUsed: [...(prev.hintsUsed || []), { section, hintIndex }]
        }));
      }
    } catch (err) {
      console.error('Hint error:', err);
    }
  };

  const handleSubmit = async (auto = false) => {
    if (!auto && !window.confirm('Are you sure you want to submit? This cannot be undone.')) return;

    // Save current section first
    const sectionKey = STEPS[currentStep]?.id;
    if (sectionKey && submission?.sections?.[sectionKey] && sectionKey !== 'overview' && sectionKey !== 'review') {
      await saveSection(sectionKey, submission.sections[sectionKey]);
    }

    setSubmitting(true);
    try {
      const { data } = await axiosInstance.post(`/system-design-submissions/${submission._id}/submit`);
      if (data.success) {
        navigate(`/student/system-design/${submission._id}/follow-up`);
      }
    } catch (err) {
      alert('Submit failed');
      setSubmitting(false);
    }
  };
  handleSubmitRef.current = handleSubmit;

  const formatTimer = (ms) => {
    if (!ms) return '--:--';
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
  };

  if (loading) return <div className="sdt-loading">Loading...</div>;
  if (!problem || !submission) return <div className="sdt-loading">Problem not found</div>;

  const sections = submission.sections || {};
  const isTimeLow = timeLeft !== null && timeLeft < 600000;

  return (
    <div className="sdt-container">
      {/* Top bar */}
      <div className="sdt-topbar">
        <div className="sdt-topbar-left">
          <h2 className="sdt-problem-title">{problem.title}</h2>
        </div>
        <div className="sdt-topbar-center">
          {saving && <span className="sdt-save-indicator saving">Saving...</span>}
          {!saving && lastSaved && <span className="sdt-save-indicator saved">Saved {lastSaved.toLocaleTimeString()}</span>}
        </div>
        <div className="sdt-topbar-right">
          <div className={`sdt-violation-badge ${violations >= 2 ? 'danger' : violations >= 1 ? 'warn' : 'safe'}`}>
            Violations: {violations}/3
          </div>
          {!isFullscreen && (
            <button className="sdt-fullscreen-btn" onClick={requestFullscreen} title="Enter fullscreen">⛶</button>
          )}
          <button className="sdt-hint-toggle" onClick={() => setShowHints(!showHints)}>💡 Hints</button>
          <div className={`sdt-timer ${isTimeLow ? 'warning' : ''}`}>⏱️ {formatTimer(timeLeft)}</div>
        </div>
      </div>

      {/* Violation Modal Overlay */}
      {violationModal && (
        <div className="sdt-violation-overlay" onClick={() => violationModal.type !== 'error' && setViolationModal(null)}>
          <div className={`sdt-violation-modal ${violationModal.type}`} onClick={e => e.stopPropagation()}>
            <div className="sdt-violation-modal-icon">{violationModal.type === 'error' ? '🚫' : '⚠️'}</div>
            <h3>{violationModal.title}</h3>
            <p>{violationModal.message}</p>
            {violationModal.type !== 'error' && (
              <button className="sdt-violation-modal-close" onClick={() => setViolationModal(null)}>I Understand</button>
            )}
          </div>
        </div>
      )}

      <div className="sdt-main">
        {/* Sidebar */}
        <div className="sdt-sidebar">
          {STEPS.map((step, idx) => {
            const sKey = step.id;
            const isComplete = sKey !== 'overview' && sKey !== 'review' && sections[sKey] &&
              (Array.isArray(sections[sKey]) ? sections[sKey].length > 0 :
                typeof sections[sKey] === 'object' && Object.values(sections[sKey]).some(v =>
                  v && (typeof v === 'string' ? v.trim() : Array.isArray(v) ? v.length > 0 : true)
                ));
            return (
              <button
                key={idx}
                className={`sdt-step-btn ${currentStep === idx ? 'active' : ''} ${isComplete ? 'complete' : ''}`}
                onClick={() => goToStep(idx)}
              >
                <span className="sdt-step-icon">{step.icon}</span>
                <span className="sdt-step-label">{step.label}</span>
                {isComplete && <span className="sdt-step-check">✓</span>}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="sdt-content">
          {/* Hints drawer */}
          {showHints && currentStep > 0 && currentStep < 11 && (
            <HintDrawer
              hints={problem.hints?.[STEPS[currentStep].id] || []}
              used={submission.hintsUsed || []}
              section={STEPS[currentStep].id}
              onUse={useHint}
              onClose={() => setShowHints(false)}
            />
          )}

          {/* Step 0: Overview */}
          {currentStep === 0 && (
            <div className="sdt-step-content">
              <h2>Problem Overview</h2>
              <div className="sdt-problem-statement" dangerouslySetInnerHTML={{ __html: problem.problemStatement }} />
              {problem.businessContext && (
                <div className="sdt-context-box">
                  <h3>Business Context</h3>
                  <div className="sdt-rich-content" dangerouslySetInnerHTML={{ __html: problem.businessContext }} />
                </div>
              )}
              <div className="sdt-constraints-grid">
                {problem.constraints?.estimatedUsers && <div className="sdt-constraint"><label>Users</label><span>{problem.constraints.estimatedUsers}</span></div>}
                {problem.constraints?.estimatedQPS && <div className="sdt-constraint"><label>QPS</label><span>{problem.constraints.estimatedQPS}</span></div>}
                {problem.constraints?.storageNeeds && <div className="sdt-constraint"><label>Storage</label><span>{problem.constraints.storageNeeds}</span></div>}
                {problem.constraints?.latencyRequirement && <div className="sdt-constraint"><label>Latency</label><span>{problem.constraints.latencyRequirement}</span></div>}
                {problem.constraints?.availabilityTarget && <div className="sdt-constraint"><label>Availability</label><span>{problem.constraints.availabilityTarget}</span></div>}
              </div>
              <button className="sdt-next-btn" onClick={() => goToStep(1)}>Begin Design →</button>
            </div>
          )}

          {/* Step 1: Requirements */}
          {currentStep === 1 && (
            <div className="sdt-step-content">
              <h2>Step 1: Requirements Clarification</h2>
              <h3>Functional Requirements</h3>
              {(sections.requirements?.functional || []).map((fr, idx) => (
                <div key={idx} className="sdt-dynamic-row">
                  <span className="sdt-row-label">FR{idx + 1}</span>
                  <input type="text" value={fr.text || ''} onChange={e => {
                    const updated = [...(sections.requirements?.functional || [])];
                    updated[idx] = { ...updated[idx], text: e.target.value, id: updated[idx]?.id || `fr-${idx}` };
                    updateSection('requirements', { ...sections.requirements, functional: updated });
                  }} placeholder="e.g., Users can create short URLs from long URLs" />
                  <button className="sdt-remove-btn" onClick={() => {
                    const updated = (sections.requirements?.functional || []).filter((_, i) => i !== idx);
                    updateSection('requirements', { ...sections.requirements, functional: updated });
                  }}>×</button>
                </div>
              ))}
              <button className="sdt-add-btn" onClick={() => {
                const functional = [...(sections.requirements?.functional || []), { id: `fr-${Date.now()}`, text: '' }];
                updateSection('requirements', { ...sections.requirements, functional });
              }}>+ Add Functional Requirement</button>

              <h3 style={{ marginTop: 24 }}>Non-Functional Requirements</h3>
              {['scalability', 'availability', 'consistency', 'latency'].map(key => (
                <div key={key} className="sdt-nfr-field">
                  <label>{key.charAt(0).toUpperCase() + key.slice(1)}</label>
                  <textarea
                    value={sections.requirements?.nonFunctional?.[key] || ''}
                    onChange={e => {
                      updateSection('requirements', {
                        ...sections.requirements,
                        nonFunctional: { ...sections.requirements?.nonFunctional, [key]: e.target.value }
                      });
                    }}
                    placeholder={`Describe ${key} requirements...`}
                    rows={2}
                  />
                </div>
              ))}
              <div className="sdt-step-nav">
                <button className="sdt-nav-btn prev" onClick={() => goToStep(0)}>← Overview</button>
                <button className="sdt-nav-btn next" onClick={() => goToStep(2)}>Capacity Estimation →</button>
              </div>
            </div>
          )}

          {/* Step 2: Capacity Estimation */}
          {currentStep === 2 && (
            <div className="sdt-step-content">
              <h2>Step 2: Capacity Estimation</h2>
              <div className="sdt-calc-helper">
                <span className="sdt-calc-chip">1 day = 86,400 sec</span>
                <span className="sdt-calc-chip">1 month ≈ 2.5M sec</span>
                <span className="sdt-calc-chip">1 year ≈ 31.5M sec</span>
                <span className="sdt-calc-chip">1 KB = 1,024 bytes</span>
                <span className="sdt-calc-chip">1 MB = 1M bytes</span>
                <span className="sdt-calc-chip">1 GB = 1B bytes</span>
                <span className="sdt-calc-chip">1 TB = 1,000 GB</span>
              </div>
              {[
                { key: 'estimatedQPS', label: 'Read/Write QPS', placeholder: 'e.g., Reads: 100M DAU / 86400 ≈ 1160 QPS, Writes: ~100 QPS' },
                { key: 'readWriteRatio', label: 'Read/Write Ratio', placeholder: 'e.g., 10:1 read-heavy' },
                { key: 'storageEstimate', label: 'Storage Estimate', placeholder: 'e.g., 500 bytes/record × 100M records/year × 5 years = 250TB' },
                { key: 'bandwidthEstimate', label: 'Bandwidth Estimate', placeholder: 'e.g., 1160 QPS × 500 bytes = 580 KB/s incoming' },
                { key: 'memoryEstimate', label: 'Memory/Cache Estimate', placeholder: 'e.g., 20% of daily records: 0.2 × 100M × 500 bytes = 10GB cache' }
              ].map(({ key, label, placeholder }) => (
                <div key={key} className="sdt-nfr-field">
                  <label>{label}</label>
                  <input type="text" value={sections.capacityEstimation?.[key] || ''} onChange={e => {
                    updateSection('capacityEstimation', { ...sections.capacityEstimation, [key]: e.target.value });
                  }} placeholder={placeholder} />
                </div>
              ))}
              <div className="sdt-nfr-field">
                <label>Show Your Work (detailed calculations)</label>
                <textarea
                  value={sections.capacityEstimation?.calculations || ''}
                  onChange={e => updateSection('capacityEstimation', { ...sections.capacityEstimation, calculations: e.target.value })}
                  placeholder="Write out your back-of-envelope calculations step by step..."
                  rows={6}
                  style={{ fontFamily: 'monospace' }}
                />
              </div>
              <div className="sdt-step-nav">
                <button className="sdt-nav-btn prev" onClick={() => goToStep(1)}>← Requirements</button>
                <button className="sdt-nav-btn next" onClick={() => goToStep(3)}>Core Entities →</button>
              </div>
            </div>
          )}

          {/* Step 3: Core Entities */}
          {currentStep === 3 && (
            <div className="sdt-step-content">
              <h2>Step 3: Core Entities</h2>
              <div className="sdt-entities-list">
                {(sections.coreEntities || []).map((entity, idx) => (
                  <div key={idx} className="sdt-entity-card">
                    <div className="sdt-entity-header">
                      <input type="text" value={entity.name || ''} onChange={e => {
                        const updated = [...sections.coreEntities];
                        updated[idx] = { ...updated[idx], name: e.target.value };
                        updateSection('coreEntities', updated);
                      }} placeholder="Entity Name (e.g., User)" className="sdt-entity-name" />
                      <button className="sdt-remove-btn" onClick={() => {
                        updateSection('coreEntities', sections.coreEntities.filter((_, i) => i !== idx));
                      }}>×</button>
                    </div>
                    <div className="sdt-entity-fields">
                      <label>Fields:</label>
                      {(entity.fields || []).map((field, fIdx) => (
                        <div key={fIdx} className="sdt-field-row">
                          <input type="text" value={field.name || ''} placeholder="Field name" onChange={e => {
                            const updated = [...sections.coreEntities];
                            const fields = [...(updated[idx].fields || [])];
                            fields[fIdx] = { ...fields[fIdx], name: e.target.value };
                            updated[idx] = { ...updated[idx], fields };
                            updateSection('coreEntities', updated);
                          }} />
                          <input type="text" value={field.type || ''} placeholder="Type" onChange={e => {
                            const updated = [...sections.coreEntities];
                            const fields = [...(updated[idx].fields || [])];
                            fields[fIdx] = { ...fields[fIdx], type: e.target.value };
                            updated[idx] = { ...updated[idx], fields };
                            updateSection('coreEntities', updated);
                          }} style={{ maxWidth: 140 }} />
                          <button className="sdt-remove-btn small" onClick={() => {
                            const updated = [...sections.coreEntities];
                            updated[idx] = { ...updated[idx], fields: updated[idx].fields.filter((_, i) => i !== fIdx) };
                            updateSection('coreEntities', updated);
                          }}>×</button>
                        </div>
                      ))}
                      <button className="sdt-add-btn small" onClick={() => {
                        const updated = [...sections.coreEntities];
                        updated[idx] = { ...updated[idx], fields: [...(updated[idx].fields || []), { name: '', type: '' }] };
                        updateSection('coreEntities', updated);
                      }}>+ Field</button>
                    </div>
                    <textarea value={entity.notes || ''} onChange={e => {
                      const updated = [...sections.coreEntities];
                      updated[idx] = { ...updated[idx], notes: e.target.value };
                      updateSection('coreEntities', updated);
                    }} placeholder="Notes / relationships..." rows={2} className="sdt-entity-notes" />
                  </div>
                ))}
              </div>
              <button className="sdt-add-btn" onClick={() => {
                updateSection('coreEntities', [...(sections.coreEntities || []), { name: '', fields: [{ name: '', type: '' }], relationships: '', notes: '' }]);
              }}>+ Add Entity</button>
              <div className="sdt-step-nav">
                <button className="sdt-nav-btn prev" onClick={() => goToStep(2)}>← Capacity</button>
                <button className="sdt-nav-btn next" onClick={() => goToStep(4)}>API Design →</button>
              </div>
            </div>
          )}

          {/* Step 4: API Design */}
          {currentStep === 4 && (
            <div className="sdt-step-content">
              <h2>Step 4: API Design</h2>
              <div className="sdt-api-list">
                {(sections.apiDesign || []).map((api, idx) => (
                  <div key={idx} className="sdt-api-row">
                    <div className="sdt-api-top">
                      <select value={api.method || 'GET'} onChange={e => {
                        const updated = [...sections.apiDesign];
                        updated[idx] = { ...updated[idx], method: e.target.value };
                        updateSection('apiDesign', updated);
                      }} className="sdt-api-method" style={{ color: METHOD_COLORS[api.method] || 'inherit' }}>
                        {HTTP_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                      <input type="text" value={api.endpoint || ''} onChange={e => {
                        const updated = [...sections.apiDesign];
                        updated[idx] = { ...updated[idx], endpoint: e.target.value };
                        updateSection('apiDesign', updated);
                      }} placeholder="/api/v1/..." className="sdt-api-endpoint" />
                      <button className="sdt-remove-btn" onClick={() => updateSection('apiDesign', sections.apiDesign.filter((_, i) => i !== idx))}>×</button>
                    </div>
                    <div className="sdt-api-detail-row">
                      <div className="sdt-api-detail-col">
                        <label>Request Body</label>
                        <textarea value={api.requestBody || ''} onChange={e => {
                          const updated = [...sections.apiDesign]; updated[idx] = { ...updated[idx], requestBody: e.target.value };
                          updateSection('apiDesign', updated);
                        }} rows={2} placeholder='{ "url": "https://..." }' style={{ fontFamily: 'monospace', fontSize: '0.8rem' }} />
                      </div>
                      <div className="sdt-api-detail-col">
                        <label>Response Body</label>
                        <textarea value={api.responseBody || ''} onChange={e => {
                          const updated = [...sections.apiDesign]; updated[idx] = { ...updated[idx], responseBody: e.target.value };
                          updateSection('apiDesign', updated);
                        }} rows={2} placeholder='{ "shortUrl": "bit.ly/xyz" }' style={{ fontFamily: 'monospace', fontSize: '0.8rem' }} />
                      </div>
                    </div>
                    <input type="text" value={api.description || ''} onChange={e => {
                      const updated = [...sections.apiDesign]; updated[idx] = { ...updated[idx], description: e.target.value };
                      updateSection('apiDesign', updated);
                    }} placeholder="Description..." className="sdt-api-desc" />
                  </div>
                ))}
              </div>
              <button className="sdt-add-btn" onClick={() => {
                updateSection('apiDesign', [...(sections.apiDesign || []), { method: 'GET', endpoint: '', requestBody: '', responseBody: '', description: '' }]);
              }}>+ Add Endpoint</button>
              <div className="sdt-step-nav">
                <button className="sdt-nav-btn prev" onClick={() => goToStep(3)}>← Entities</button>
                <button className="sdt-nav-btn next" onClick={() => goToStep(5)}>Architecture →</button>
              </div>
            </div>
          )}

          {/* Step 5: Architecture */}
          {currentStep === 5 && (
            <div className="sdt-step-content sdt-architecture-step">
              <h2>Step 5: High-Level Architecture</h2>
              <ArchitectureBuilder
                diagramData={sections.architecture?.diagramData}
                textExplanation={sections.architecture?.textExplanation || ''}
                onChange={(diagramData, textExplanation, components) => {
                  updateSection('architecture', { ...sections.architecture, diagramData, textExplanation, components });
                }}
                validationRules={problem.validationRules}
                templates={problem.architectureTemplates}
              />
              <div className="sdt-step-nav">
                <button className="sdt-nav-btn prev" onClick={() => goToStep(4)}>← API Design</button>
                <button className="sdt-nav-btn next" onClick={() => goToStep(6)}>Data Flow →</button>
              </div>
            </div>
          )}

          {/* Step 6: Data Flow */}
          {currentStep === 6 && (
            <div className="sdt-step-content">
              <h2>Step 6: Data Flow</h2>
              {(sections.dataFlow || []).map((flow, fIdx) => (
                <div key={fIdx} className="sdt-flow-card">
                  <div className="sdt-flow-header">
                    <input type="text" value={flow.scenario || ''} onChange={e => {
                      const updated = [...sections.dataFlow];
                      updated[fIdx] = { ...updated[fIdx], scenario: e.target.value };
                      updateSection('dataFlow', updated);
                    }} placeholder="Scenario: e.g., User creates a short URL" className="sdt-flow-scenario" />
                    <button className="sdt-remove-btn" onClick={() => updateSection('dataFlow', sections.dataFlow.filter((_, i) => i !== fIdx))}>×</button>
                  </div>
                  <div className="sdt-flow-steps">
                    {(flow.steps || []).map((step, sIdx) => (
                      <div key={sIdx} className="sdt-flow-step">
                        <span className="sdt-flow-step-num">{sIdx + 1}</span>
                        <input type="text" value={step.description || ''} onChange={e => {
                          const updated = [...sections.dataFlow];
                          const steps = [...(updated[fIdx].steps || [])];
                          steps[sIdx] = { order: sIdx + 1, description: e.target.value };
                          updated[fIdx] = { ...updated[fIdx], steps };
                          updateSection('dataFlow', updated);
                        }} placeholder="Describe this step..." />
                        <button className="sdt-remove-btn small" onClick={() => {
                          const updated = [...sections.dataFlow];
                          updated[fIdx] = { ...updated[fIdx], steps: updated[fIdx].steps.filter((_, i) => i !== sIdx) };
                          updateSection('dataFlow', updated);
                        }}>×</button>
                      </div>
                    ))}
                    <button className="sdt-add-btn small" onClick={() => {
                      const updated = [...sections.dataFlow];
                      const steps = [...(updated[fIdx].steps || [])];
                      steps.push({ order: steps.length + 1, description: '' });
                      updated[fIdx] = { ...updated[fIdx], steps };
                      updateSection('dataFlow', updated);
                    }}>+ Add Step</button>
                  </div>
                </div>
              ))}
              <button className="sdt-add-btn" onClick={() => {
                updateSection('dataFlow', [...(sections.dataFlow || []), { scenario: '', steps: [{ order: 1, description: '' }] }]);
              }}>+ Add Scenario</button>
              <div className="sdt-step-nav">
                <button className="sdt-nav-btn prev" onClick={() => goToStep(5)}>← Architecture</button>
                <button className="sdt-nav-btn next" onClick={() => goToStep(7)}>Database Design →</button>
              </div>
            </div>
          )}

          {/* Step 7: Database Design */}
          {currentStep === 7 && (
            <div className="sdt-step-content">
              <h2>Step 7: Database Design</h2>
              {(sections.databaseDesign || []).map((db, idx) => (
                <div key={idx} className="sdt-db-card">
                  <div className="sdt-db-header">
                    <input type="text" value={db.entity || ''} onChange={e => {
                      const updated = [...sections.databaseDesign]; updated[idx] = { ...updated[idx], entity: e.target.value };
                      updateSection('databaseDesign', updated);
                    }} placeholder="Entity / Table name" className="sdt-db-entity" />
                    <select value={db.dbType || ''} onChange={e => {
                      const updated = [...sections.databaseDesign]; updated[idx] = { ...updated[idx], dbType: e.target.value };
                      updateSection('databaseDesign', updated);
                    }} className="sdt-db-type">
                      <option value="">Select DB Type</option>
                      {DB_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <button className="sdt-remove-btn" onClick={() => updateSection('databaseDesign', sections.databaseDesign.filter((_, i) => i !== idx))}>×</button>
                  </div>
                  {['justification', 'indexing', 'partitioning', 'replication'].map(field => (
                    <div key={field} className="sdt-nfr-field">
                      <label>{field.charAt(0).toUpperCase() + field.slice(1)} Strategy</label>
                      <textarea value={db[field] || ''} onChange={e => {
                        const updated = [...sections.databaseDesign]; updated[idx] = { ...updated[idx], [field]: e.target.value };
                        updateSection('databaseDesign', updated);
                      }} rows={2} placeholder={`Describe ${field} approach...`} />
                    </div>
                  ))}
                </div>
              ))}
              <button className="sdt-add-btn" onClick={() => {
                updateSection('databaseDesign', [...(sections.databaseDesign || []), { entity: '', dbType: '', justification: '', indexing: '', partitioning: '', replication: '' }]);
              }}>+ Add Database Entity</button>
              <div className="sdt-step-nav">
                <button className="sdt-nav-btn prev" onClick={() => goToStep(6)}>← Data Flow</button>
                <button className="sdt-nav-btn next" onClick={() => goToStep(8)}>Scaling Strategy →</button>
              </div>
            </div>
          )}

          {/* Step 8: Scaling Strategy */}
          {currentStep === 8 && (
            <div className="sdt-step-content">
              <h2>Step 8: Scaling Strategy</h2>
              <div className="sdt-scaling-list">
                {(sections.scalingStrategy?.strategies || SCALING_STRATEGIES.map(name => ({ name, selected: false, explanation: '' }))).map((strategy, idx) => (
                  <div key={idx} className={`sdt-scaling-card ${strategy.selected ? 'selected' : ''}`}>
                    <label className="sdt-scaling-header">
                      <input type="checkbox" checked={strategy.selected || false} onChange={e => {
                        const updated = { ...sections.scalingStrategy };
                        const strategies = [...(updated.strategies || [])];
                        strategies[idx] = { ...strategies[idx], selected: e.target.checked };
                        updateSection('scalingStrategy', { ...updated, strategies });
                      }} />
                      <span>{strategy.name}</span>
                    </label>
                    {strategy.selected && (
                      <textarea value={strategy.explanation || ''} onChange={e => {
                        const updated = { ...sections.scalingStrategy };
                        const strategies = [...(updated.strategies || [])];
                        strategies[idx] = { ...strategies[idx], explanation: e.target.value };
                        updateSection('scalingStrategy', { ...updated, strategies });
                      }} placeholder={`Explain how you would apply ${strategy.name}...`} rows={3} />
                    )}
                  </div>
                ))}
              </div>
              <div className="sdt-nfr-field">
                <label>Additional Notes</label>
                <textarea value={sections.scalingStrategy?.additionalNotes || ''} onChange={e => {
                  updateSection('scalingStrategy', { ...sections.scalingStrategy, additionalNotes: e.target.value });
                }} placeholder="Any additional scaling considerations..." rows={3} />
              </div>
              <div className="sdt-step-nav">
                <button className="sdt-nav-btn prev" onClick={() => goToStep(7)}>← Database</button>
                <button className="sdt-nav-btn next" onClick={() => goToStep(9)}>Deep Dive →</button>
              </div>
            </div>
          )}

          {/* Step 9: Deep Dive */}
          {currentStep === 9 && (
            <div className="sdt-step-content">
              <h2>Step 9: Deep Dive</h2>
              <p className="sdt-step-desc">Choose one area and explain it in depth. This simulates a real interview deep-dive.</p>
              <div className="sdt-topic-grid">
                {(problem.deepDiveOptions || ['Database Scaling', 'Message Queue Handling', 'Consistency Models', 'Cache Invalidation', 'Rate Limiting', 'Search System Design', 'Data Partitioning']).map(topic => (
                  <button key={topic} className={`sdt-topic-btn ${sections.deepDive?.topic === topic ? 'selected' : ''}`} onClick={() => {
                    updateSection('deepDive', { ...sections.deepDive, topic });
                  }}>{topic}</button>
                ))}
              </div>
              {sections.deepDive?.topic && (
                <div className="sdt-nfr-field">
                  <label>Deep Dive: {sections.deepDive.topic}</label>
                  <textarea value={sections.deepDive?.explanation || ''} onChange={e => {
                    updateSection('deepDive', { ...sections.deepDive, explanation: e.target.value });
                  }} rows={10} placeholder="Explain in detail. Include specific techniques, edge cases, failure scenarios, and real-world examples..." />
                </div>
              )}
              <div className="sdt-step-nav">
                <button className="sdt-nav-btn prev" onClick={() => goToStep(8)}>← Scaling</button>
                <button className="sdt-nav-btn next" onClick={() => goToStep(10)}>Tradeoffs →</button>
              </div>
            </div>
          )}

          {/* Step 10: Tradeoffs */}
          {currentStep === 10 && (
            <div className="sdt-step-content">
              <h2>Step 10: Tradeoff Analysis</h2>
              <p className="sdt-step-desc">List at least 3 key tradeoffs you made in your design. This is what interviewers care about most.</p>
              {(sections.tradeoffs || []).map((tradeoff, idx) => (
                <div key={idx} className="sdt-tradeoff-card">
                  <div className="sdt-tradeoff-header">
                    <span className="sdt-tradeoff-num">Tradeoff #{idx + 1}</span>
                    <button className="sdt-remove-btn" onClick={() => updateSection('tradeoffs', sections.tradeoffs.filter((_, i) => i !== idx))}>×</button>
                  </div>
                  <div className="sdt-tradeoff-row">
                    <div className="sdt-tradeoff-col">
                      <label>I chose:</label>
                      <input type="text" value={tradeoff.optionChosen || ''} onChange={e => {
                        const updated = [...sections.tradeoffs]; updated[idx] = { ...updated[idx], optionChosen: e.target.value };
                        updateSection('tradeoffs', updated);
                      }} placeholder="e.g., MongoDB" />
                    </div>
                    <div className="sdt-tradeoff-vs">over</div>
                    <div className="sdt-tradeoff-col">
                      <label>Instead of:</label>
                      <input type="text" value={tradeoff.optionRejected || ''} onChange={e => {
                        const updated = [...sections.tradeoffs]; updated[idx] = { ...updated[idx], optionRejected: e.target.value };
                        updateSection('tradeoffs', updated);
                      }} placeholder="e.g., PostgreSQL" />
                    </div>
                  </div>
                  <div className="sdt-nfr-field">
                    <label>Because:</label>
                    <textarea value={tradeoff.reasoning || ''} onChange={e => {
                      const updated = [...sections.tradeoffs]; updated[idx] = { ...updated[idx], reasoning: e.target.value };
                      updateSection('tradeoffs', updated);
                    }} rows={3} placeholder="Explain your reasoning..." />
                  </div>
                </div>
              ))}
              <button className="sdt-add-btn" onClick={() => {
                updateSection('tradeoffs', [...(sections.tradeoffs || []), { decision: '', optionChosen: '', optionRejected: '', reasoning: '' }]);
              }}>+ Add Tradeoff</button>
              <div className="sdt-step-nav">
                <button className="sdt-nav-btn prev" onClick={() => goToStep(9)}>← Deep Dive</button>
                <button className="sdt-nav-btn next" onClick={() => goToStep(11)}>Review & Submit →</button>
              </div>
            </div>
          )}

          {/* Step 11: Review & Submit */}
          {currentStep === 11 && (
            <div className="sdt-step-content">
              <h2>Review & Submit</h2>
              <div className="sdt-review-list">
                {STEPS.filter(s => s.id !== 'overview' && s.id !== 'review').map((step, idx) => {
                  const sKey = step.id;
                  const sData = sections[sKey];
                  const hasContent = sData && (
                    Array.isArray(sData) ? sData.length > 0 :
                    typeof sData === 'object' && Object.values(sData).some(v =>
                      v && (typeof v === 'string' ? v.trim() : Array.isArray(v) ? v.length > 0 : true)
                    )
                  );
                  return (
                    <div key={sKey} className={`sdt-review-item ${hasContent ? 'complete' : 'incomplete'}`}>
                      <span className="sdt-review-icon">{hasContent ? '✅' : '⚠️'}</span>
                      <span className="sdt-review-label">{step.icon} {step.label}</span>
                      <span className="sdt-review-status">{hasContent ? 'Completed' : 'Incomplete'}</span>
                      <button className="sdt-review-jump" onClick={() => goToStep(idx + 1)}>Edit</button>
                    </div>
                  );
                })}
              </div>
              {(submission.hintsUsed || []).length > 0 && (
                <div className="sdt-hint-summary">
                  Hints used: {submission.hintsUsed.length} (score penalty will apply)
                </div>
              )}
              <button
                className="sdt-submit-btn"
                onClick={() => handleSubmit(false)}
                disabled={submitting}
              >
                {submitting ? 'Submitting...' : 'Submit for AI Evaluation'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Hint Drawer Component
const HintDrawer = ({ hints, used, section, onUse, onClose }) => {
  if (!hints || hints.length === 0) return (
    <div className="sdt-hint-drawer">
      <div className="sdt-hint-drawer-header"><h3>Hints</h3><button onClick={onClose}>×</button></div>
      <p className="sdt-hint-empty">No hints available for this section.</p>
    </div>
  );

  return (
    <div className="sdt-hint-drawer">
      <div className="sdt-hint-drawer-header"><h3>Hints</h3><button onClick={onClose}>×</button></div>
      {hints.map((hint, idx) => {
        const isUsed = used.some(u => u.section === section && u.hintIndex === idx);
        return (
          <div key={idx} className={`sdt-hint-item ${isUsed ? 'revealed' : ''}`}>
            {isUsed ? (
              <div className="sdt-hint-text sdt-rich-content" dangerouslySetInnerHTML={{ __html: hint.text }} />
            ) : (
              <button className="sdt-hint-unlock" onClick={() => onUse(section, idx)}>
                🔒 Unlock Hint #{idx + 1} (-{hint.penaltyPercent || 5}% penalty)
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default SystemDesignTaking;
