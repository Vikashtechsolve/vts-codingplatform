import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axiosInstance from '../../utils/axios';
import RichTextEditor from '../../components/RichTextEditor';
import { stripHtml } from '../../components/RichTextDisplay';
import './CreateAssignment.css';

const CreateAssignment = () => {
  const navigate = useNavigate();
  const { id: assignmentId } = useParams();
  const isEditMode = Boolean(assignmentId);

  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(isEditMode);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    difficulty: 'medium',
    category: 'fullstack',
    allowedTechStack: [],
    deadline: '',
    duration: 180, // minutes
    totalMarks: 100,
    additionalInstructions: '',
    assignmentType: 'individual'
  });

  const [techStackInput, setTechStackInput] = useState('');
  const [featureChecklist, setFeatureChecklist] = useState([
    { feature: '', marks: 0, required: false, description: '' }
  ]);

  const [evaluationWeights, setEvaluationWeights] = useState({
    featureCompletion: 40,
    codeQuality: 20,
    architecture: 15,
    security: 10,
    gitPractices: 10,
    documentation: 5
  });

  const [repositoryRules, setRepositoryRules] = useState({
    requiredBranch: 'main',
    mustIncludeReadme: true,
    mustIncludeEnvExample: true,
    mustNotContainSecrets: true,
    minimumCommits: 5,
    requireDeploymentUrl: false
  });

  useEffect(() => {
    if (!isEditMode || !assignmentId) return;
    const fetchAssignment = async () => {
      try {
        setInitialLoading(true);
        const { data } = await axiosInstance.get(`/assignments/${assignmentId}`);
        if (data.success && data.assignment) {
          const a = data.assignment;
          const deadlineStr = a.deadline ? new Date(a.deadline).toISOString().slice(0, 16) : '';
          setFormData({
            title: a.title || '',
            description: a.description || '',
            difficulty: a.difficulty || 'medium',
            category: a.category || 'fullstack',
            allowedTechStack: a.allowedTechStack || [],
            deadline: deadlineStr,
            duration: a.duration ?? 180,
            totalMarks: a.totalMarks ?? 100,
            additionalInstructions: a.additionalInstructions || '',
            assignmentType: a.assignmentType || 'individual'
          });
          setFeatureChecklist(
            a.featureChecklist?.length > 0
              ? a.featureChecklist.map(f => ({
                  feature: f.feature || '',
                  marks: f.marks ?? 0,
                  required: f.required ?? false,
                  description: f.description || ''
                }))
              : [{ feature: '', marks: 0, required: false, description: '' }]
          );
          setEvaluationWeights(a.evaluationWeights || {
            featureCompletion: 40, codeQuality: 20, architecture: 15,
            security: 10, gitPractices: 10, documentation: 5
          });
          setRepositoryRules(a.repositoryRules || {
            requiredBranch: 'main', mustIncludeReadme: true, mustIncludeEnvExample: true,
            mustNotContainSecrets: true, minimumCommits: 5, requireDeploymentUrl: false
          });
        }
      } catch (err) {
        console.error('Error fetching assignment:', err);
        setError(err.response?.data?.message || 'Failed to load assignment');
      } finally {
        setInitialLoading(false);
      }
    };
    fetchAssignment();
  }, [assignmentId, isEditMode]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleAddTechStack = () => {
    if (techStackInput.trim()) {
      setFormData(prev => ({
        ...prev,
        allowedTechStack: [...prev.allowedTechStack, techStackInput.trim()]
      }));
      setTechStackInput('');
    }
  };

  const handleRemoveTechStack = (index) => {
    setFormData(prev => ({
      ...prev,
      allowedTechStack: prev.allowedTechStack.filter((_, i) => i !== index)
    }));
  };

  const handleFeatureChange = (index, field, value) => {
    const updated = [...featureChecklist];
    updated[index][field] = field === 'marks' ? parseInt(value) || 0 : value;
    setFeatureChecklist(updated);
  };

  const handleAddFeature = () => {
    setFeatureChecklist([
      ...featureChecklist,
      { feature: '', marks: 0, required: false, description: '' }
    ]);
  };

  const handleRemoveFeature = (index) => {
    if (featureChecklist.length > 1) {
      setFeatureChecklist(featureChecklist.filter((_, i) => i !== index));
    }
  };

  const handleWeightChange = (category, value) => {
    setEvaluationWeights(prev => ({
      ...prev,
      [category]: parseInt(value) || 0
    }));
  };

  const handleRuleChange = (rule, value) => {
    setRepositoryRules(prev => ({
      ...prev,
      [rule]: value
    }));
  };

  const isRichTextEmpty = (html) => !stripHtml(html || '').trim();

  const validateForm = () => {
    if (!formData.title.trim()) {
      setError('Title is required');
      return false;
    }

    if (isRichTextEmpty(formData.description)) {
      setError('Description is required');
      return false;
    }

    if (!formData.deadline) {
      setError('Deadline is required');
      return false;
    }

    const validFeatures = featureChecklist.filter(f => f.feature.trim() && f.marks > 0);
    if (validFeatures.length === 0) {
      setError('At least one valid feature is required');
      return false;
    }

    const totalWeights = Object.values(evaluationWeights).reduce((sum, w) => sum + w, 0);
    if (Math.abs(totalWeights - 100) > 1) {
      setError('Evaluation weights must total 100%');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!validateForm()) return;

    setLoading(true);

    try {
      const validFeatures = featureChecklist.filter(f => f.feature.trim() && f.marks > 0);

      const payload = {
        ...formData,
        featureChecklist: validFeatures,
        evaluationWeights,
        repositoryRules
      };

      const { data } = isEditMode
        ? await axiosInstance.put(`/assignments/${assignmentId}`, payload)
        : await axiosInstance.post('/assignments', payload);

      if (data.success) {
        alert(isEditMode ? 'Assignment updated successfully!' : 'Assignment created successfully!');
        navigate('/vendor-admin/assignments');
      } else {
        setError(data.message || (isEditMode ? 'Failed to update assignment' : 'Failed to create assignment'));
      }
    } catch (err) {
      console.error(isEditMode ? 'Error updating assignment:' : 'Error creating assignment:', err);
      const message = err.response?.data?.message || err.message || (isEditMode ? 'Failed to update assignment. Please try again.' : 'Failed to create assignment. Please try again.');
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const totalFeatureMarks = featureChecklist.reduce((sum, f) => sum + (f.marks || 0), 0);
  const weightsTotal = Object.values(evaluationWeights).reduce((sum, w) => sum + w, 0);

  if (initialLoading) {
    return (
      <div className="create-assignment-container">
        <div className="loading">Loading assignment...</div>
      </div>
    );
  }

  return (
    <div className="create-assignment-container">
      <div className="create-assignment-header">
        <button className="back-button" onClick={() => navigate('/vendor-admin/assignments')}>
          ← Back
        </button>
        <h1>{isEditMode ? 'Edit Assignment' : 'Create New Assignment'}</h1>
      </div>

      {error && <div className="error-message">{error}</div>}

      <form onSubmit={handleSubmit} className="create-assignment-form">
        {/* Basic Details */}
        <div className="form-section">
          <h2>📝 Basic Details</h2>
          
          <div className="form-group">
            <label>Title *</label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleInputChange}
              placeholder="E.g., Build a Full Stack E-Commerce Platform"
              required
            />
          </div>

          <div className="form-group">
            <label>Description *</label>
            <RichTextEditor
              value={formData.description}
              onChange={(value) => setFormData(prev => ({ ...prev, description: value }))}
              placeholder="Detailed description of what students need to build. Use headings, bullets, bold, links, etc."
              minHeight={180}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Difficulty *</label>
              <select name="difficulty" value={formData.difficulty} onChange={handleInputChange}>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>

            <div className="form-group">
              <label>Category *</label>
              <select name="category" value={formData.category} onChange={handleInputChange}>
                <option value="frontend">Frontend</option>
                <option value="backend">Backend</option>
                <option value="fullstack">Full Stack</option>
                <option value="mobile">Mobile</option>
                <option value="devops">DevOps</option>
                <option value="data-science">Data Science</option>
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Deadline *</label>
              <input
                type="datetime-local"
                name="deadline"
                value={formData.deadline}
                onChange={handleInputChange}
                required
              />
            </div>

            <div className="form-group">
              <label>Duration (minutes) *</label>
              <input
                type="number"
                name="duration"
                value={formData.duration}
                onChange={handleInputChange}
                min="30"
                required
              />
            </div>

            <div className="form-group">
              <label>Total Marks *</label>
              <input
                type="number"
                name="totalMarks"
                value={formData.totalMarks}
                onChange={handleInputChange}
                min="10"
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label>Allowed Tech Stack</label>
            <div className="tech-stack-input">
              <input
                type="text"
                value={techStackInput}
                onChange={(e) => setTechStackInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTechStack())}
                placeholder="E.g., React, Node.js, MongoDB"
              />
              <button type="button" onClick={handleAddTechStack} className="add-button">
                Add
              </button>
            </div>
            <div className="tech-stack-list">
              {formData.allowedTechStack.map((tech, index) => (
                <span key={index} className="tech-tag">
                  {tech}
                  <button type="button" onClick={() => handleRemoveTechStack(index)}>×</button>
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Feature Checklist */}
        <div className="form-section">
          <h2>✅ Feature Checklist (VERY IMPORTANT)</h2>
          <p className="section-description">
            Define the features students must implement. This will be used by AI for evaluation.
          </p>
          
          {featureChecklist.map((feature, index) => (
            <div key={index} className="feature-item">
              <div className="feature-header">
                <h4>Feature {index + 1}</h4>
                {featureChecklist.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveFeature(index)}
                    className="remove-button"
                  >
                    Remove
                  </button>
                )}
              </div>
              
              <div className="form-row">
                <div className="form-group flex-2">
                  <label>Feature Name *</label>
                  <input
                    type="text"
                    value={feature.feature}
                    onChange={(e) => handleFeatureChange(index, 'feature', e.target.value)}
                    placeholder="E.g., User Authentication"
                  />
                </div>

                <div className="form-group">
                  <label>Marks *</label>
                  <input
                    type="number"
                    value={feature.marks}
                    onChange={(e) => handleFeatureChange(index, 'marks', e.target.value)}
                    min="0"
                  />
                </div>

                <div className="form-group checkbox-group">
                  <label>
                    <input
                      type="checkbox"
                      checked={feature.required}
                      onChange={(e) => handleFeatureChange(index, 'required', e.target.checked)}
                    />
                    Required
                  </label>
                </div>
              </div>

              <div className="form-group">
                <label>Description (optional)</label>
                <RichTextEditor
                  value={feature.description}
                  onChange={(value) => handleFeatureChange(index, 'description', value)}
                  placeholder="Additional details about this feature (headings, bullets, bold, etc.)"
                  minHeight={100}
                />
              </div>
            </div>
          ))}

          <button type="button" onClick={handleAddFeature} className="add-feature-button">
            + Add Feature
          </button>

          <div className="marks-summary">
            Total Feature Marks: {totalFeatureMarks} / {formData.totalMarks}
            {Math.abs(totalFeatureMarks - formData.totalMarks) > 5 && (
              <span className="warning"> ⚠️ Should roughly match total marks</span>
            )}
          </div>
        </div>

        {/* Evaluation Weights */}
        <div className="form-section">
          <h2>⚖️ Evaluation Weights</h2>
          <p className="section-description">
            Define how much each category contributes to the final score (must total 100%).
          </p>

          <div className="weights-grid">
            {Object.entries(evaluationWeights).map(([key, value]) => (
              <div key={key} className="weight-item">
                <label>{key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}</label>
                <div className="weight-input">
                  <input
                    type="number"
                    value={value}
                    onChange={(e) => handleWeightChange(key, e.target.value)}
                    min="0"
                    max="100"
                  />
                  <span>%</span>
                </div>
              </div>
            ))}
          </div>

          <div className="weights-total">
            Total: {weightsTotal}%
            {weightsTotal !== 100 && <span className="warning"> ⚠️ Must be 100%</span>}
          </div>
        </div>

        {/* Repository Rules */}
        <div className="form-section">
          <h2>📋 Repository Rules</h2>

          <div className="form-group">
            <label>Required Branch</label>
            <input
              type="text"
              value={repositoryRules.requiredBranch}
              onChange={(e) => handleRuleChange('requiredBranch', e.target.value)}
              placeholder="main"
            />
          </div>

          <div className="form-group">
            <label>Minimum Commits</label>
            <input
              type="number"
              value={repositoryRules.minimumCommits}
              onChange={(e) => handleRuleChange('minimumCommits', parseInt(e.target.value))}
              min="1"
            />
          </div>

          <div className="rules-checkboxes">
            <label>
              <input
                type="checkbox"
                checked={repositoryRules.mustIncludeReadme}
                onChange={(e) => handleRuleChange('mustIncludeReadme', e.target.checked)}
              />
              Must include README
            </label>

            <label>
              <input
                type="checkbox"
                checked={repositoryRules.mustIncludeEnvExample}
                onChange={(e) => handleRuleChange('mustIncludeEnvExample', e.target.checked)}
              />
              Must include .env.example
            </label>

            <label>
              <input
                type="checkbox"
                checked={repositoryRules.mustNotContainSecrets}
                onChange={(e) => handleRuleChange('mustNotContainSecrets', e.target.checked)}
              />
              Must not contain secrets (.env file)
            </label>

            <label>
              <input
                type="checkbox"
                checked={repositoryRules.requireDeploymentUrl}
                onChange={(e) => handleRuleChange('requireDeploymentUrl', e.target.checked)}
              />
              Require deployment URL
            </label>
          </div>
        </div>

        {/* Additional Instructions */}
        <div className="form-section">
          <h2>📌 Additional Instructions</h2>
          <RichTextEditor
            value={formData.additionalInstructions}
            onChange={(value) => setFormData(prev => ({ ...prev, additionalInstructions: value }))}
            placeholder="Any additional instructions or guidelines for students..."
            minHeight={120}
          />
        </div>

        {/* Submit Buttons */}
        <div className="form-actions">
          <button
            type="button"
            onClick={() => navigate('/vendor-admin/assignments')}
            className="cancel-button"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="submit-button"
            disabled={loading}
          >
            {loading ? (isEditMode ? 'Saving...' : 'Creating...') : (isEditMode ? 'Save Changes' : 'Create Assignment')}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreateAssignment;
