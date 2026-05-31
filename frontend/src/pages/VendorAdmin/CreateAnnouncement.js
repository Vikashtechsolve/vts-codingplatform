import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  FiBell,
  FiGlobe,
  FiUsers,
  FiAlertCircle,
  FiSave,
  FiSend,
  FiSearch,
  FiCheckSquare,
  FiSquare,
} from 'react-icons/fi';
import axiosInstance from '../../utils/axios';
import RichTextEditor from '../../components/RichTextEditor';
import RichTextDisplay, { stripHtml } from '../../components/RichTextDisplay';
import { useToast } from '../../context/ToastContext';
import VendorHubPage from '../../components/VendorAdmin/VendorHubPage';
import './CreateAnnouncement.css';

const normalizeId = (value) => String(value?._id || value || '');

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
  const [classroomSearch, setClassroomSearch] = useState('');
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
        setSelectedClassrooms((a.targetClassroomIds || []).map((c) => normalizeId(c)));
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

  const filteredClassrooms = useMemo(() => {
    const q = classroomSearch.trim().toLowerCase();
    if (!q) return classrooms;
    return classrooms.filter((c) => c.name?.toLowerCase().includes(q));
  }, [classrooms, classroomSearch]);

  const selectedStudentCount = useMemo(() => {
    if (targetType !== 'classrooms') return null;
    return classrooms
      .filter((c) => selectedClassrooms.includes(normalizeId(c._id)))
      .reduce((sum, c) => sum + (c.students?.length || 0), 0);
  }, [classrooms, selectedClassrooms, targetType]);

  const toggleClassroom = (classroomId) => {
    const cid = normalizeId(classroomId);
    setSelectedClassrooms((prev) =>
      prev.includes(cid) ? prev.filter((x) => x !== cid) : [...prev, cid]
    );
  };

  const handleSelectAllClassrooms = () => {
    const ids = filteredClassrooms.map((c) => normalizeId(c._id));
    const allSelected = ids.length > 0 && ids.every((cid) => selectedClassrooms.includes(cid));
    if (allSelected) {
      setSelectedClassrooms((prev) => prev.filter((cid) => !ids.includes(cid)));
      return;
    }
    setSelectedClassrooms((prev) => Array.from(new Set([...prev, ...ids])));
  };

  const buildPayload = () => ({
    title,
    body,
    targetType,
    targetClassroomIds: targetType === 'classrooms' ? selectedClassrooms : [],
    priority,
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
        const { data } = await axiosInstance.put(`/announcements/${id}`, buildPayload());
        if (data.success) {
          showToast('Saved', 'success');
          navigate('/vendor-admin/announcements');
        } else showToast(data.message || 'Failed', 'error');
      } else {
        const { data } = await axiosInstance.post('/announcements', {
          ...buildPayload(),
          publish: false,
        });
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
        await axiosInstance.put(`/announcements/${id}`, buildPayload());
        const { data } = await axiosInstance.post(`/announcements/${id}/publish`);
        if (data.success) {
          showToast(`Published to ${data.audienceSize ?? 0} student(s)`, 'success');
          navigate('/vendor-admin/announcements');
        } else showToast(data.message || 'Failed', 'error');
      } else {
        const { data } = await axiosInstance.post('/announcements', {
          ...buildPayload(),
          publish: true,
        });
        if (data.success) {
          showToast(
            `Published to ${data.announcement?.audienceSize ?? 0} student(s)`,
            'success'
          );
          navigate('/vendor-admin/announcements');
        } else showToast(data.message || 'Failed', 'error');
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to publish', 'error');
    } finally {
      setSaving(false);
    }
  };

  const audiencePreview =
    targetType === 'all'
      ? 'All active students in your organization'
      : selectedClassrooms.length === 0
        ? 'Select one or more classrooms below'
        : `${selectedClassrooms.length} classroom(s) · ~${selectedStudentCount ?? 0} student(s)`;

  if (loading) {
    return (
      <VendorHubPage
        loading
        backTo="/vendor-admin/announcements"
        backLabel="Back to announcements"
        accent="#e7210b"
      />
    );
  }

  return (
    <VendorHubPage
      className="vca-page"
      backTo="/vendor-admin/announcements"
      backLabel="Back to announcements"
      eyebrow={isEdit ? 'Edit broadcast' : 'New broadcast'}
      title={isEdit ? 'Edit announcement' : 'Create announcement'}
      subtitle="Write your message, choose who should see it, then save as draft or publish immediately."
      accent="#e7210b"
    >
      <div className="vca-layout">
        <div className="vca-main">
          <section className="vh-panel vca-section">
            <div className="vh-panel-head">
              <div>
                <h2 className="vh-panel-title">Content</h2>
                <p className="vh-panel-desc">Title and message students will read.</p>
              </div>
            </div>
            <div className="vh-panel-body">
              <div className="vh-field">
                <label htmlFor="ann-title">Title *</label>
                <input
                  id="ann-title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Exam schedule update"
                  maxLength={200}
                />
                <span className="vh-field-hint">{title.length}/200 characters</span>
              </div>

              <div className="vh-field">
                <label htmlFor="ann-body">Message *</label>
                <RichTextEditor
                  value={body}
                  onChange={setBody}
                  minHeight={220}
                  placeholder="Write your announcement…"
                />
              </div>
            </div>
          </section>

          <section className="vh-panel vca-section">
            <div className="vh-panel-head">
              <div>
                <h2 className="vh-panel-title">Priority</h2>
                <p className="vh-panel-desc">Important announcements stand out in the student inbox.</p>
              </div>
            </div>
            <div className="vh-panel-body">
              <div className="vca-choice-row">
                <button
                  type="button"
                  className={`vca-choice ${priority === 'normal' ? 'is-active' : ''}`}
                  onClick={() => setPriority('normal')}
                >
                  <FiBell />
                  <span>Normal</span>
                  <small>Standard update</small>
                </button>
                <button
                  type="button"
                  className={`vca-choice vca-choice--warn ${priority === 'important' ? 'is-active' : ''}`}
                  onClick={() => setPriority('important')}
                >
                  <FiAlertCircle />
                  <span>Important</span>
                  <small>Highlighted for students</small>
                </button>
              </div>
            </div>
          </section>

          <section className="vh-panel vca-section">
            <div className="vh-panel-head">
              <div>
                <h2 className="vh-panel-title">Audience</h2>
                <p className="vh-panel-desc">{audiencePreview}</p>
              </div>
            </div>
            <div className="vh-panel-body">
              <div className="vca-choice-row vca-choice-row--compact">
                <button
                  type="button"
                  className={`vca-choice ${targetType === 'all' ? 'is-active' : ''}`}
                  onClick={() => setTargetType('all')}
                >
                  <FiGlobe />
                  <span>All students</span>
                </button>
                <button
                  type="button"
                  className={`vca-choice ${targetType === 'classrooms' ? 'is-active' : ''}`}
                  onClick={() => setTargetType('classrooms')}
                >
                  <FiUsers />
                  <span>By classroom</span>
                </button>
              </div>

              {targetType === 'classrooms' && (
                <div className="vca-classrooms">
                  {classrooms.length === 0 ? (
                    <div className="vca-no-classrooms">
                      <p>No active classrooms yet.</p>
                      <Link to="/vendor-admin/classrooms/create" className="vh-btn vh-btn--secondary vh-btn--sm">
                        Create classroom
                      </Link>
                    </div>
                  ) : (
                    <>
                      <div className="vca-classroom-toolbar">
                        <div className="vh-search vca-classroom-search">
                          <FiSearch />
                          <input
                            type="search"
                            placeholder="Search classrooms…"
                            value={classroomSearch}
                            onChange={(e) => setClassroomSearch(e.target.value)}
                          />
                        </div>
                        <button
                          type="button"
                          className="vh-btn vh-btn--ghost vh-btn--sm"
                          onClick={handleSelectAllClassrooms}
                          disabled={filteredClassrooms.length === 0}
                        >
                          {filteredClassrooms.length > 0 &&
                          filteredClassrooms.every((c) =>
                            selectedClassrooms.includes(normalizeId(c._id))
                          ) ? (
                            <>
                              <FiSquare /> Unselect shown
                            </>
                          ) : (
                            <>
                              <FiCheckSquare /> Select shown
                            </>
                          )}
                        </button>
                      </div>

                      <div className="vca-classroom-list">
                        {filteredClassrooms.map((c) => {
                          const cid = normalizeId(c._id);
                          const isSelected = selectedClassrooms.includes(cid);
                          return (
                            <label
                              key={cid}
                              className={`vca-classroom-row ${isSelected ? 'is-selected' : ''}`}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleClassroom(cid)}
                              />
                              <div className="vca-classroom-info">
                                <span className="vca-classroom-name">{c.name}</span>
                                <span className="vca-classroom-count">
                                  {(c.students || []).length} student
                                  {(c.students || []).length !== 1 ? 's' : ''}
                                </span>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </section>

          <div className="vca-actions">
            {status !== 'published' && (
              <button
                type="button"
                className="vh-btn vh-btn--secondary"
                onClick={handleSaveDraft}
                disabled={saving}
              >
                <FiSave /> {saving ? 'Saving…' : 'Save draft'}
              </button>
            )}
            {status === 'published' ? (
              <button
                type="button"
                className="vh-btn vh-btn--primary"
                onClick={handleSaveDraft}
                disabled={saving}
              >
                <FiSave /> {saving ? 'Saving…' : 'Save changes'}
              </button>
            ) : (
              <button
                type="button"
                className="vh-btn vh-btn--primary"
                onClick={handlePublish}
                disabled={saving}
              >
                <FiSend /> {saving ? 'Publishing…' : 'Publish now'}
              </button>
            )}
          </div>
        </div>

        <aside className="vca-preview">
          <div className="vca-preview-inner">
            <p className="vca-preview-label">Student preview</p>
            {stripHtml(body).trim() || title.trim() ? (
              <div
                className={`vca-preview-card ${priority === 'important' ? 'vca-preview-card--important' : ''}`}
              >
                {priority === 'important' && (
                  <span className="vca-preview-badge">
                    <FiAlertCircle /> Important
                  </span>
                )}
                <h3>{title.trim() || 'Untitled announcement'}</h3>
                {stripHtml(body).trim() ? (
                  <RichTextDisplay content={body} className="vca-preview-body" />
                ) : (
                  <p className="vca-preview-placeholder">Your message will appear here.</p>
                )}
                <div className="vca-preview-foot">
                  <span>
                    {targetType === 'all' ? (
                      <>
                        <FiGlobe /> All students
                      </>
                    ) : (
                      <>
                        <FiUsers /> {audiencePreview}
                      </>
                    )}
                  </span>
                </div>
              </div>
            ) : (
              <div className="vca-preview-empty">
                <FiBell />
                <p>Start typing to preview how students will see this announcement.</p>
              </div>
            )}
          </div>
        </aside>
      </div>
    </VendorHubPage>
  );
};

export default CreateAnnouncement;
