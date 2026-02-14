import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axiosInstance from '../../utils/axios';
import RichTextDisplay from '../../components/RichTextDisplay';
import './SubmitAssignment.css';

const SubmitAssignment = () => {
  const { assignmentId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [assignment, setAssignment] = useState(null);
  const [enrollment, setEnrollment] = useState(null);
  const [timeRemaining, setTimeRemaining] = useState(null); // seconds remaining, null = not started
  const [formData, setFormData] = useState({
    githubRepoUrl: '',
    branchName: 'main',
    liveUrl: '',
    studentNotes: ''
  });
  const [showUpdateRepo, setShowUpdateRepo] = useState(false);
  const [updateRepoData, setUpdateRepoData] = useState({ githubRepoUrl: '', branchName: 'main' });
  const [submitSuccessMessage, setSubmitSuccessMessage] = useState('');

  const fetchAssignmentDetails = useCallback(async () => {
    try {
      const { data } = await axiosInstance.get(`/assignments/${assignmentId}`);
      if (data.success) {
        setAssignment(data.assignment);
        setEnrollment(data.enrollment || null);
      } else {
        setError(data.message);
      }
    } catch (err) {
      console.error('Error fetching assignment:', err);
      setError('Failed to fetch assignment details');
    }
  }, [assignmentId]);

  useEffect(() => {
    fetchAssignmentDetails();
  }, [fetchAssignmentDetails]);

  // Prefill updateRepoData when we have currentSubmission (submitted, can still edit URL)
  useEffect(() => {
    const sub = enrollment?.currentSubmission;
    if (sub) {
      setUpdateRepoData({
        githubRepoUrl: sub.githubRepoUrl || '',
        branchName: sub.branchName || 'main'
      });
    }
  }, [enrollment?.currentSubmission]);

  // Timer: compute submission deadline (earlier of assignment deadline or startedAt + duration)
  const getSubmissionDeadline = useCallback(() => {
    if (!enrollment?.startedAt || !assignment?.duration) return null;
    const startedAt = new Date(enrollment.startedAt).getTime();
    const durationMs = assignment.duration * 60 * 1000;
    const deadlineMs = enrollment.deadline ? new Date(enrollment.deadline).getTime() : Infinity;
    return Math.min(startedAt + durationMs, deadlineMs);
  }, [enrollment, assignment]);

  // Update time remaining - run when in_progress OR (submitted and timer not ended)
  useEffect(() => {
    if (!enrollment || enrollment.status === 'assigned' || enrollment.status === 'evaluated') return;
    if (enrollment.status === 'submitted') {
      const timerEnd = enrollment.timerEndAt ? new Date(enrollment.timerEndAt).getTime() : null;
      if (!timerEnd || Date.now() > timerEnd) {
        setTimeRemaining(null);
        return;
      }
    }
    const deadlineMs = getSubmissionDeadline();
    if (!deadlineMs) return;

    const tick = () => {
      const now = Date.now();
      const remaining = Math.max(0, Math.floor((deadlineMs - now) / 1000));
      setTimeRemaining(remaining);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [enrollment, getSubmissionDeadline]);

  const handleStartAssignment = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await axiosInstance.post(`/assignments/${assignmentId}/start`);
      if (data.success) {
        await fetchAssignmentDetails();
      } else {
        setError(data.message || 'Failed to start assignment');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to start assignment. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  };

  const isTimeExpired = timeRemaining !== null && timeRemaining <= 0;
  const canSubmit = enrollment?.status === 'in_progress' && !isTimeExpired;
  const hasStarted = enrollment?.status === 'in_progress' || enrollment?.status === 'submitted' || enrollment?.status === 'evaluated';

  const handleUpdateRepo = async (e) => {
    e.preventDefault();
    const submissionId = enrollment?.submissionId?._id || enrollment?.submissionId;
    if (!submissionId || !updateRepoData.githubRepoUrl.trim()) return;
    setLoading(true);
    setError('');
    try {
      const { data } = await axiosInstance.patch(`/project-submissions/${submissionId}`, updateRepoData);
      if (data.success) {
        await fetchAssignmentDetails();
        setShowUpdateRepo(false);
        alert('Repository link updated successfully.');
      } else {
        setError(data.message || 'Failed to update');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update repository link.');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const validateGithubUrl = (url) => {
    const pattern = /^https?:\/\/(www\.)?github\.com\/[\w-]+\/[\w.-]+(\.git)?$/;
    return pattern.test(url);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (isTimeExpired) {
      setError('The timer has ended. You must submit your repository link before the timer ends.');
      return;
    }

    if (!canSubmit) {
      setError('You must start the assignment before submitting.');
      return;
    }

    // Validation
    if (!formData.githubRepoUrl.trim()) {
      setError('GitHub repository URL is required');
      return;
    }

    if (!validateGithubUrl(formData.githubRepoUrl)) {
      setError('Invalid GitHub repository URL format. Example: https://github.com/username/repository');
      return;
    }

    if (assignment?.repositoryRules?.requireDeploymentUrl && !formData.liveUrl.trim()) {
      setError('Deployment URL is required for this assignment');
      return;
    }

    if (!window.confirm(
      '⚠️ IMPORTANT: Are you sure you want to submit?\n\n' +
      '✓ Make sure all your code is pushed to GitHub\n' +
      '✓ Double-check the repository URL\n' +
      '✓ Ensure the branch name is correct\n' +
      '✓ You cannot resubmit after this\n\n' +
      'Click OK to submit your project.'
    )) {
      return;
    }

    setLoading(true);

    try {
      const { data } = await axiosInstance.post('/project-submissions', {
        assignmentId,
        ...formData
      });

      if (data.success) {
        setSubmitSuccessMessage('Project submitted successfully. You can update your repository link until the timer ends.');
        await fetchAssignmentDetails();
      } else {
        setError(data.message || 'Failed to submit project');
      }
    } catch (err) {
      console.error('Error submitting project:', err);
      setError('Failed to submit project. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!assignment) {
    return (
      <div className="submit-assignment-container">
        <div className="loading">Loading assignment details...</div>
      </div>
    );
  }

  // Not assigned to this student
  if (!enrollment && assignment) {
    return (
      <div className="submit-assignment-container">
        <div className="submit-header">
          <button className="back-button" onClick={() => navigate('/student/assignments')}>
            ← Back to Dashboard
          </button>
        </div>
        <div className="error-message">This assignment is not assigned to you.</div>
      </div>
    );
  }

  // Not started yet - show Start Assignment screen
  if (enrollment?.status === 'assigned') {
    return (
      <div className="submit-assignment-container">
        <div className="submit-header">
          <button className="back-button" onClick={() => navigate('/student/assignments')}>
            ← Back to Dashboard
          </button>
          <h1>Start Assignment</h1>
        </div>
        <div className="start-assignment-card">
          <h2>{assignment.title}</h2>
          <p className="start-assignment-meta">
            {assignment.category} • {assignment.difficulty} • {assignment.totalMarks} marks
          </p>
          <p className="start-assignment-duration">
            ⏱️ You will have <strong>{assignment.duration} minutes</strong> from when you start to submit your GitHub repository link.
          </p>
          <div className="submission-policy-card">
            <h4>📋 Important Rules</h4>
            <ul>
              <li><strong>Submit your repository link before the timer ends.</strong> No late submissions.</li>
              <li><strong>Do not make any commits after the timer ends.</strong> All your work must be committed before time runs out.</li>
            </ul>
          </div>
          <p className="start-assignment-warning">
            Once you click Start, the timer will begin. Make sure you're ready to work on the project.
          </p>
          <button
            className="start-assignment-button"
            onClick={handleStartAssignment}
            disabled={loading}
          >
            {loading ? 'Starting...' : '▶ Start Assignment'}
          </button>
          {error && <div className="error-message">{error}</div>}
        </div>
      </div>
    );
  }

  return (
    <div className="submit-assignment-container">
      <div className="submit-header">
        <button className="back-button" onClick={() => navigate('/student/assignments')}>
          ← Back to Dashboard
        </button>
        <h1>Submit Project</h1>
      </div>

      {/* Timer - visible when started, or submitted but timer not ended yet */}
      {hasStarted && (enrollment?.status === 'in_progress' || (enrollment?.status === 'submitted' && enrollment?.timerEndAt && new Date(enrollment.timerEndAt) > new Date())) && (
        <div className={`assignment-timer ${isTimeExpired ? 'expired' : ''}`}>
          <span className="timer-icon">⏱️</span>
          <span className="timer-label">
            {isTimeExpired ? 'Time\'s up — submit link before timer ends' : 'Time remaining to submit:'}
          </span>
          <span className="timer-value">
            {isTimeExpired ? '—' : formatTime(timeRemaining ?? 0)}
          </span>
        </div>
      )}

      <div className="assignment-info-card">
        <h2>{assignment.title}</h2>
        <p className="assignment-category">
          {assignment.category} • {assignment.difficulty} • {assignment.totalMarks} marks
        </p>
        <div className="assignment-desc">
          <RichTextDisplay content={assignment.description} />
        </div>
        {assignment.featureChecklist?.length > 0 && (
          <div className="assignment-features">
            <h4>Feature Requirements</h4>
            <ul>
              {assignment.featureChecklist.map((f, i) => (
                <li key={i}>
                  <strong>{f.feature}</strong>
                  {f.marks > 0 && <span className="feature-marks"> ({f.marks} marks)</span>}
                  {f.description && (
                    <div className="feature-description">
                      <RichTextDisplay content={f.description} />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
        {assignment.additionalInstructions && (
          <div className="assignment-additional-instructions">
            <h4>Additional Instructions</h4>
            <RichTextDisplay content={assignment.additionalInstructions} />
          </div>
        )}
      </div>

      <div className="submission-policy-card">
        <h4>📋 Important Rules</h4>
        <ul>
          <li><strong>Submit your repository link before the timer ends.</strong> No late submissions.</li>
          <li><strong>Do not make any commits after the timer ends.</strong> All your work must be committed before time runs out.</li>
        </ul>
      </div>

      <div className="important-notice">
        <h3>⚠️ Before You Submit - Important Checklist</h3>
        <ul>
          <li>✓ All your code is pushed to GitHub</li>
          <li>✓ Repository is public or accessible</li>
          <li>✓ All required features are implemented</li>
          <li>✓ README file is included with setup instructions</li>
          {assignment.repositoryRules?.mustIncludeEnvExample && (
            <li>✓ .env.example file is included</li>
          )}
          {assignment.repositoryRules?.mustNotContainSecrets && (
            <li>✓ No .env file or secrets are committed</li>
          )}
          {assignment.repositoryRules?.minimumCommits && (
            <li>✓ At least {assignment.repositoryRules.minimumCommits} meaningful commits</li>
          )}
          <li>✓ Code is clean and properly commented</li>
          <li>✓ You cannot resubmit after submission</li>
        </ul>
      </div>

      {error && <div className="error-message">{error}</div>}
      {submitSuccessMessage && (
        <div className="success-message" style={{ background: '#d4edda', color: '#155724', padding: '12px 16px', borderRadius: 8, marginBottom: 16 }}>
          ✅ {submitSuccessMessage}
        </div>
      )}

      {enrollment?.status === 'submitted' || enrollment?.status === 'evaluated' ? (
        <div className="already-submitted-card">
          <h3>✅ {enrollment?.status === 'evaluated' ? 'Evaluation Complete' : 'Submission Received'}</h3>
          {enrollment?.status === 'submitted' ? (
            <>
              <p>Your project has been submitted successfully.</p>
              <p className="evaluation-timing">Evaluation will begin shortly. Check your dashboard for status.</p>
              {enrollment?.timerEndAt && new Date(enrollment.timerEndAt) > new Date() && (
                <>
                  <p className="update-repo-note">
                    You can still update your repository link until the timer ends.
                  </p>
                  {!showUpdateRepo ? (
                    <div className="submission-actions">
                      {(enrollment?.submissionId?._id || enrollment?.submissionId) && (
                        <button
                          type="button"
                          className="submit-button"
                          onClick={() => navigate(`/student/submission/${enrollment.submissionId?._id || enrollment.submissionId}/result`)}
                        >
                          Check Status →
                        </button>
                      )}
                      <button
                        type="button"
                        className="cancel-button"
                        onClick={() => setShowUpdateRepo(true)}
                      >
                        Edit Repository URL
                      </button>
                    </div>
                  ) : (
                    <form onSubmit={handleUpdateRepo} className="update-repo-form">
                      <div className="form-group">
                        <label>GitHub Repository URL</label>
                        <input
                          type="url"
                          value={updateRepoData.githubRepoUrl}
                          onChange={(e) => setUpdateRepoData(prev => ({ ...prev, githubRepoUrl: e.target.value }))}
                          placeholder="https://github.com/username/repository"
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label>Branch Name</label>
                        <input
                          type="text"
                          value={updateRepoData.branchName}
                          onChange={(e) => setUpdateRepoData(prev => ({ ...prev, branchName: e.target.value }))}
                          placeholder="main"
                        />
                      </div>
                      <div className="submission-actions">
                        <button type="submit" className="submit-button" disabled={loading}>
                          {loading ? 'Updating...' : 'Save'}
                        </button>
                        <button type="button" className="cancel-button" onClick={() => setShowUpdateRepo(false)}>
                          Cancel
                        </button>
                      </div>
                    </form>
                  )}
                </>
              )}
              {(!enrollment?.timerEndAt || new Date(enrollment.timerEndAt) <= new Date()) && (enrollment?.submissionId?._id || enrollment?.submissionId) && (
                <div className="submission-actions">
                  <button
                    type="button"
                    className="submit-button"
                    onClick={() => navigate(`/student/submission/${enrollment.submissionId?._id || enrollment.submissionId}/result`)}
                  >
                    Check Status →
                  </button>
                </div>
              )}
            </>
          ) : (
            <>
              <p>You have completed this assignment. View your detailed results below.</p>
              {(enrollment?.submissionId?._id || enrollment?.submissionId) && (
                <div className="submission-actions">
                  <button
                    type="button"
                    className="submit-button"
                    onClick={() => navigate(`/student/submission/${enrollment.submissionId?._id || enrollment.submissionId}/result`)}
                  >
                    View Result →
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      ) : (
      <form onSubmit={handleSubmit} className="submit-form">
        <div className="form-section">
          <h3>📁 Repository Details</h3>

          <div className="form-group">
            <label>GitHub Repository URL *</label>
            <input
              type="url"
              name="githubRepoUrl"
              value={formData.githubRepoUrl}
              onChange={handleInputChange}
              placeholder="https://github.com/username/repository"
              required
            />
            <p className="field-help">
              Example: https://github.com/johndoe/my-project
            </p>
          </div>

          <div className="form-group">
            <label>Branch Name *</label>
            <input
              type="text"
              name="branchName"
              value={formData.branchName}
              onChange={handleInputChange}
              placeholder="main"
              required
            />
            <p className="field-help">
              Default: main (or master if you're using the old default)
            </p>
          </div>

          {assignment.repositoryRules?.requireDeploymentUrl && (
            <div className="form-group">
              <label>Live Deployment URL *</label>
              <input
                type="url"
                name="liveUrl"
                value={formData.liveUrl}
                onChange={handleInputChange}
                placeholder="https://your-project.vercel.app"
                required
              />
              <p className="field-help">
                Deployment URL (Vercel, Netlify, Heroku, etc.)
              </p>
            </div>
          )}

          {!assignment.repositoryRules?.requireDeploymentUrl && (
            <div className="form-group">
              <label>Live Deployment URL (Optional)</label>
              <input
                type="url"
                name="liveUrl"
                value={formData.liveUrl}
                onChange={handleInputChange}
                placeholder="https://your-project.vercel.app"
              />
              <p className="field-help">
                If you deployed your project, provide the URL here
              </p>
            </div>
          )}
        </div>

        <div className="form-section">
          <h3>📝 Additional Notes</h3>

          <div className="form-group">
            <label>Notes for Instructor (Optional)</label>
            <textarea
              name="studentNotes"
              value={formData.studentNotes}
              onChange={handleInputChange}
              rows="5"
              placeholder="Add any notes, special instructions, or information about your project..."
            />
            <p className="field-help">
              Mention any special features, challenges faced, or things you want to highlight
            </p>
          </div>
        </div>

        <div className="form-actions">
          <button
            type="button"
            onClick={() => navigate('/student/assignments')}
            className="cancel-button"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="submit-button"
            disabled={loading || isTimeExpired || !canSubmit}
          >
            {loading ? 'Submitting...' : isTimeExpired ? '⏱️ Time Expired' : '🚀 Submit Project'}
          </button>
        </div>
        {isTimeExpired && (
          <p className="time-expired-message">
            The timer has ended. Repository link must be submitted before the timer ends. No late submissions allowed.
          </p>
        )}
      </form>
      )}
    </div>
  );
};

export default SubmitAssignment;
