import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FiBell, FiGlobe, FiUsers, FiAlertCircle, FiSave, FiSend } from 'react-icons/fi';
import axiosInstance from '../../utils/axios';
import RichTextEditor from '../../components/RichTextEditor';
import RichTextDisplay, { stripHtml } from '../../components/RichTextDisplay';
import { useToast } from '../../context/ToastContext';
import './CreateAnnouncement.css';

const CreateAnnouncement = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);
  const { showToast } = useToast();

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [targetType, setTargetType] = useState('all');
  const [selectedClassrooms, setSelectedClassrooms] = useState([]);
  const [priority, setPriority] = useState('normal');
  const [classrooms, setClassrooms] = useState([]);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('draft');

  const fetchClassrooms = useCallback(async () => {
    try {
      const { data } = await axiosInstance.get('/vendor-admin/classrooms');
      setClassrooms(Array.isArray(data) ? data : []);
    } catch {
      setClassrooms([]);
    }
  }, []);

  const fetchAnnouncement = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await axiosInstance.get(`/announcements/${id}`);
      if (data.success) {
        const a = data.announcement;
        setTitle(a.title || '');
        setBody(a.body || '');
        setTargetType(a.targetType || 'all');
        setSelectedClassrooms((a.targetClassroomIds || []).map((c) => (c._id || c).toString()));
        setPriority(a.priority || 'normal');
        setStatus(a.status || 'draft');
      }
    } catch {
      showToast('Failed to load announcement', 'error');
      navigate('/vendor-admin/announcements');
    } finally {
      setLoading(false);
    }
  }, [id, navigate, showToast]);

  useEffect(() => {
    fetchClassrooms();
    if (isEdit) fetchAnnouncement();
  }, [isEdit, fetchClassrooms, fetchAnnouncement]);

  const toggleClassroom = (classroomId) => {
    setSelectedClassrooms((prev) =>
      prev.includes(classroomId)
        ? prev.filter((x) => x !== classroomId)
        : [...prev, classroomId]
    );
  };

  const buildPayload = (publish) => ({
    title,
    body,
    targetType,
    targetClassroomIds: targetType === 'classrooms' ? selectedClassrooms : [],
    priority,
    ...(isEdit ? {} : { publish })
  });

  const validate = () => {
    if (!title.trim()) {
      showToast('Title is required', 'error');
      return false;
    }
    if (!stripHtml(body).trim()) {
      showToast('Announcement content is required', 'error');
      return false;
    }
    if (targetType === 'classrooms' && selectedClassrooms.length === 0) {
      showToast('Select at least one classroom', 'error');
      return false;
    }
    return true;
  };

  const handleSaveDraft = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      if (isEdit) {
        const { data } = await axiosInstance.put(`/announcements/${id}`, buildPayload(false));
        if (data.success) {
          showToast('Saved', 'success');
          navigate('/vendor-admin/announcements');
        } else showToast(data.message || 'Failed', 'error');
      } else {
        const { data } = await axiosInstance.post('/announcements', { ...buildPayload(false), publish: false });
        if (data.success) {
          showToast('Draft saved', 'success');
          navigate('/vendor-admin/announcements');
        } else showToast(data.message || 'Failed', 'error');
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to save', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      if (isEdit) {
        await axiosInstance.put(`/announcements/${id}`, buildPayload(false));
        const { data } = await axiosInstance.post(`/announcements/${id}/publish`);
        if (data.success) {
          showToast(`Published to ${data.audienceSize ?? 0} student(s)`, 'success');
          navigate('/vendor-admin/announcements');
        } else showToast(data.message || 'Failed', 'error');
      } else {
        const { data } = await axiosInstance.post('/announcements', { ...buildPayload(true), publish: true });
        if (data.success) {
          showToast(`Published to ${data.announcement?.audienceSize ?? 0} student(s)`, 'success');
          navigate('/vendor-admin/announcements');
        } else showToast(data.message || 'Failed', 'error');
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to publish', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="vca-container"><div className="vca-loading">Loading…</div></div>;
  }

  const audiencePreview =
    targetType === 'all'
      ? 'All active students in your organization'
      : selectedClassrooms.length === 0
        ? 'Select classrooms below'
        : `${selectedClassrooms.length} classroom(s) — students enrolled in those classes will see this`;

  return (
    <div className="vca-container">
      <header className="vca-header">
        <button type="button" className="vca-back" onClick={() => navigate('/vendor-admin/announcements')}>
          ← Back
        </button>
        <h1>
          <FiBell />
          {isEdit ? 'Edit announcement' : 'Create announcement'}
        </h1>
      </header>

      <div className="vca-layout">
        <div className="vca-form">
          <div className="vca-field">
            <label>Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Exam schedule update"
              maxLength={200}
            />
          </div>

          <div className="vca-field">
            <label>Message *</label>
            <RichTextEditor value={body} onChange={setBody} minHeight={200} placeholder="Write your announcement…" />
          </div>

          <div className="vca-field">
            <label>Priority</label>
            <div className="vca-priority-row">
              <button
                type="button"
                className={`vca-priority-btn ${priority === 'normal' ? 'active' : ''}`}
                onClick={() => setPriority('normal')}
              >
                Normal
              </button>
              <button
                type="button"
                className={`vca-priority-btn important ${priority === 'important' ? 'active' : ''}`}
                onClick={() => setPriority('important')}
              >
                <FiAlertCircle /> Important
              </button>
            </div>
          </div>

          <div className="vca-field">
            <label>Audience</label>
            <div className="vca-target-row">
              <button
                type="button"
                className={`vca-target-btn ${targetType === 'all' ? 'active' : ''}`}
                onClick={() => setTargetType('all')}
              >
                <FiGlobe /> All students
              </button>
              <button
                type="button"
                className={`vca-target-btn ${targetType === 'classrooms' ? 'active' : ''}`}
                onClick={() => setTargetType('classrooms')}
              >
                <FiUsers /> By classroom
              </button>
            </div>
            <p className="vca-audience-hint">{audiencePreview}</p>
          </div>

          {targetType === 'classrooms' && (
            <div className="vca-classrooms">
              {classrooms.length === 0 ? (
                <p className="vca-no-classrooms">No active classrooms. <a href="/vendor-admin/classrooms/create">Create one</a> first.</p>
              ) : (
                classrooms.map((c) => (
                  <label key={c._id} className={`vca-classroom-chip ${selectedClassrooms.includes(c._id) ? 'selected' : ''}`}>
                    <input
                      type="checkbox"
                      checked={selectedClassrooms.includes(c._id)}
                      onChange={() => toggleClassroom(c._id)}
                    />
                    <span>{c.name}</span>
                    <span className="vca-classroom-count">{(c.students || []).length} students</span>
                  </label>
                ))
              )}
            </div>
          )}

          <div className="vca-actions">
            {status !== 'published' && (
              <button type="button" className="vca-btn secondary" onClick={handleSaveDraft} disabled={saving}>
                <FiSave /> Save draft
              </button>
            )}
            {status === 'published' ? (
              <button type="button" className="vca-btn primary" onClick={handleSaveDraft} disabled={saving}>
                <FiSave /> {saving ? 'Saving…' : 'Save changes'}
              </button>
            ) : (
              <button type="button" className="vca-btn primary" onClick={handlePublish} disabled={saving}>
                <FiSend /> {saving ? 'Saving…' : 'Publish now'}
              </button>
            )}
          </div>
        </div>

        <aside className="vca-preview-panel">
          <h3>Student preview</h3>
          {stripHtml(body).trim() ? (
            <div className="vca-preview-card">
              {priority === 'important' && (
                <span className="vca-preview-important"><FiAlertCircle /> Important</span>
              )}
              <h4>{title || 'Untitled'}</h4>
              <RichTextDisplay content={body} className="vca-preview-body" />
              <p className="vca-preview-meta">{audiencePreview}</p>
            </div>
          ) : (
            <p className="vca-preview-empty">Start typing to see how students will view this announcement.</p>
          )}
        </aside>
      </div>
    </div>
  );
};

export default CreateAnnouncement;
