import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  FiBookOpen,
  FiLayers,
  FiSave,
  FiSettings,
  FiUsers,
} from 'react-icons/fi';
import axiosInstance from '../../utils/axios';
import VendorHubPage from '../../components/VendorAdmin/VendorHubPage';
import CourseCurriculumSidebar from '../../components/Courses/CourseCurriculumSidebar';
import CourseModuleLectureList from '../../components/Courses/CourseModuleLectureList';
import CourseLectureWorkspace, {
  getFirstIncompleteStep,
  getLectureStepStatus,
} from '../../components/Courses/CourseLectureWorkspace';
import CourseBuildProgress from '../../components/Courses/CourseBuildProgress';
import CourseEditorToast from '../../components/Courses/CourseEditorToast';
import CourseWorkspaceHeader from '../../components/Courses/CourseWorkspaceHeader';
import {
  SUPER_ADMIN_QUIZ_CATALOG,
  UNLOCK_MODE_OPTIONS,
  VENDOR_QUIZ_CATALOG,
} from '../../constants/courseQuizCatalog';
import '../../styles/super-admin-pages.css';

const COURSES_ACCENT = '#0f766e';

async function putToSignedUrl(uploadUrl, file) {
  const res = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
    body: file,
  });
  if (!res.ok) throw new Error(`Upload failed (${res.status})`);
}

const CourseEditor = ({ mode = 'super' }) => {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const isVendor = mode === 'vendor';
  const apiBase = isVendor ? '/vendor-admin/courses' : '/super-admin/courses';
  const coursePath = `${apiBase}/${courseId}`;
  const quizCatalog = isVendor ? VENDOR_QUIZ_CATALOG : SUPER_ADMIN_QUIZ_CATALOG;
  const coursesHome = isVendor ? '/vendor-admin/courses' : '/super-admin/courses';
  const [course, setCourse] = useState(null);
  const [modules, setModules] = useState([]);
  const [allocations, setAllocations] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [activeTab, setActiveTab] = useState('curriculum');
  const [activeModuleId, setActiveModuleId] = useState(null);
  const [activeLectureId, setActiveLectureId] = useState(null);
  const [workspaceMode, setWorkspaceMode] = useState('empty');
  const [lectureStep, setLectureStep] = useState('details');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [addingModule, setAddingModule] = useState(false);
  const [savingModule, setSavingModule] = useState(false);
  const [addingLecture, setAddingLecture] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [toast, setToast] = useState({ message: '', error: '' });
  const [lectureJustFinished, setLectureJustFinished] = useState(false);
  const [newModuleTitle, setNewModuleTitle] = useState('');
  const [moduleTest, setModuleTest] = useState(null);
  const [moduleAssessment, setModuleAssessment] = useState(null);
  const [loadingModuleTest, setLoadingModuleTest] = useState(false);
  const [savingQuiz, setSavingQuiz] = useState(false);
  const [selectedVendorIds, setSelectedVendorIds] = useState([]);

  const applyCourseData = useCallback((data) => {
    setCourse(data);
    setModules(data.modules || []);
    setAllocations(data.allocations || []);
    setActiveModuleId((prev) => {
      const exists = data.modules?.some((m) => m._id === prev);
      return exists ? prev : null;
    });
    setActiveLectureId((prev) => {
      if (!prev) return null;
      const mod = data.modules?.find((m) => (m.lectures || []).some((l) => l._id === prev));
      return mod ? prev : null;
    });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setToast({ message: '', error: '' });
    try {
      if (isVendor) {
        const { data } = await axiosInstance.get(coursePath);
        applyCourseData(data);
        setVendors([]);
      } else {
        const [{ data }, vendorsRes] = await Promise.all([
          axiosInstance.get(coursePath),
          axiosInstance.get('/super-admin/vendors'),
        ]);
        applyCourseData(data);
        setVendors(vendorsRes.data || []);
      }
    } catch (err) {
      setToast({ message: '', error: err.response?.data?.message || 'Failed to load course' });
    } finally {
      setLoading(false);
    }
  }, [coursePath, isVendor, applyCourseData]);

  const refreshCourse = useCallback(async () => {
    setRefreshing(true);
    try {
      const { data } = await axiosInstance.get(coursePath);
      applyCourseData(data);
    } catch (err) {
      setToast({ message: '', error: err.response?.data?.message || 'Failed to refresh' });
    } finally {
      setRefreshing(false);
    }
  }, [coursePath, applyCourseData]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!isVendor || loading || !course) return;
    if (course.canEdit === false) {
      navigate(`/vendor-admin/courses/${courseId}`, { replace: true });
    }
  }, [isVendor, loading, course, courseId, navigate]);

  useEffect(() => {
    setLectureJustFinished(false);
  }, [activeLectureId]);

  const activeModule = useMemo(
    () => modules.find((m) => m._id === activeModuleId) || null,
    [modules, activeModuleId]
  );

  const activeLecture = useMemo(() => {
    if (!activeModule || !activeLectureId) return null;
    return (activeModule.lectures || []).find((l) => l._id === activeLectureId) || null;
  }, [activeModule, activeLectureId]);

  useEffect(() => {
    if (!activeLecture) return undefined;
    const status = activeLecture.video?.status;
    if (status !== 'processing' && status !== 'uploading') return undefined;
    const timer = setInterval(() => {
      refreshCourse();
    }, 8000);
    return () => clearInterval(timer);
  }, [activeLecture, refreshCourse]);

  const lectureNav = useMemo(() => {
    if (!activeModule || !activeLectureId) return null;
    const lectures = activeModule.lectures || [];
    const index = lectures.findIndex((l) => l._id === activeLectureId);
    if (index < 0) return null;
    return {
      index,
      total: lectures.length,
      hasPrev: index > 0,
      hasNext: index < lectures.length - 1,
      prevId: lectures[index - 1]?._id,
      nextId: lectures[index + 1]?._id,
    };
  }, [activeModule, activeLectureId]);

  const buildProgress = useMemo(() => {
    const moduleCount = modules.length;
    const lectureCount = modules.reduce((n, m) => n + (m.lectures || []).length, 0);
    const videosReady = modules.reduce(
      (n, m) => n + (m.lectures || []).filter((l) => l.video?.status === 'ready').length,
      0
    );
    const quizzesSet = modules.filter(
      (m) => m.testId || m.interviewId || m.assignmentId || m.systemDesignProblemId
    ).length;
    const published = course?.status === 'published';
    return { moduleCount, lectureCount, videosReady, quizzesSet, published };
  }, [modules, course]);

  const flash = (message) => setToast({ message, error: '' });
  const showError = (error) => setToast({ message: '', error });

  const loadModuleAssessment = useCallback(async (moduleId) => {
    const targetId = moduleId || activeModuleId;
    if (!targetId) return;
    setLoadingModuleTest(true);
    try {
      const { data } = await axiosInstance.get(
        `${coursePath}/modules/${targetId}/assessment`
      );
      const assessment = data.assessment || null;
      setModuleAssessment(assessment);
      setModuleTest(assessment?.type === 'test' ? assessment.item : null);
    } catch (err) {
      setModuleAssessment(null);
      setModuleTest(null);
      showError(err.response?.data?.message || 'Failed to load assessment');
    } finally {
      setLoadingModuleTest(false);
    }
  }, [coursePath, activeModuleId]);

  const loadModuleTest = useCallback(async (moduleId) => {
    await loadModuleAssessment(moduleId);
  }, [loadModuleAssessment]);

  const resolvedModuleId = activeModule?._id || null;
  const activeModuleHasAssessment = Boolean(
    activeModule?.testId ||
      activeModule?.interviewId ||
      activeModule?.assignmentId ||
      activeModule?.systemDesignProblemId
  );

  useEffect(() => {
    if (workspaceMode === 'module' && resolvedModuleId && activeModuleHasAssessment) {
      loadModuleAssessment(resolvedModuleId);
    } else {
      setModuleAssessment(null);
      setModuleTest(null);
    }
  }, [workspaceMode, resolvedModuleId, activeModuleHasAssessment, loadModuleAssessment]);

  const saveCourseMeta = async () => {
    setSaving(true);
    setToast({ message: '', error: '' });
    try {
      const { data } = await axiosInstance.patch(`${coursePath}`, {
        title: course.title,
        description: course.description,
        level: course.level,
        estimatedHours: course.estimatedHours,
        status: course.status,
        unlockMode: course.unlockMode === 'open' ? 'open' : 'sequential',
      });
      setCourse((c) => ({ ...c, ...data }));
      flash('Course saved');
    } catch (err) {
      showError(err.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const addModule = async (e) => {
    e.preventDefault();
    if (!newModuleTitle.trim()) return;
    setAddingModule(true);
    try {
      const { data } = await axiosInstance.post(`${coursePath}/modules`, {
        title: newModuleTitle.trim(),
      });
      setNewModuleTitle('');
      await refreshCourse();
      selectModule(data._id);
      setActiveTab('curriculum');
      flash('Module added — create your first lecture');
    } catch (err) {
      showError(err.response?.data?.message || 'Failed to add module');
    } finally {
      setAddingModule(false);
    }
  };

  const updateModule = async ({ title, description }) => {
    if (!activeModuleId || !title?.trim()) return;
    setSavingModule(true);
    try {
      const { data } = await axiosInstance.patch(
        `${coursePath}/modules/${activeModuleId}`,
        { title: title.trim(), description: description || '' }
      );
      setModules((prev) =>
        prev.map((m) => (m._id === data._id ? { ...m, title: data.title, description: data.description } : m))
      );
      flash('Module saved');
    } catch (err) {
      showError(err.response?.data?.message || 'Failed to save module');
    } finally {
      setSavingModule(false);
    }
  };

  const addLecture = async (title, moduleIdOverride) => {
    const targetModuleId = moduleIdOverride || activeModuleId;
    if (!targetModuleId || !title?.trim()) return;
    setActiveModuleId(targetModuleId);
    setAddingLecture(true);
    try {
      const { data } = await axiosInstance.post(
        `${coursePath}/modules/${targetModuleId}/lectures`,
        { title: title.trim() }
      );
      await refreshCourse();
      setActiveLectureId(data._id);
      setWorkspaceMode('lecture');
      setLectureStep('details');
      flash('Lecture added — start with details');
    } catch (err) {
      showError(err.response?.data?.message || 'Failed to add lecture');
    } finally {
      setAddingLecture(false);
    }
  };

  const selectModule = (moduleId) => {
    setActiveModuleId(moduleId);
    setActiveLectureId(null);
    setWorkspaceMode('module');
  };

  const openModuleQuiz = (moduleId) => {
    setActiveModuleId(moduleId);
    setActiveLectureId(null);
    setWorkspaceMode('module');
    window.requestAnimationFrame(() => {
      document.getElementById('module-quiz-section')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    });
  };

  const selectLecture = (lectureId) => {
    if (!activeModuleId) return;
    const mod = modules.find((m) => m._id === activeModuleId);
    const lec = mod?.lectures?.find((l) => l._id === lectureId);
    setActiveLectureId(lectureId);
    setWorkspaceMode('lecture');
    if (lec) setLectureStep(getFirstIncompleteStep(lec));
  };

  const goToAdjacentLecture = (direction) => {
    if (!lectureNav || !activeModuleId) return;
    const targetId = direction === 'prev' ? lectureNav.prevId : lectureNav.nextId;
    if (targetId) selectLecture(targetId);
  };

  const findFirstIncompleteLecture = () => {
    for (const mod of modules) {
      for (const lec of mod.lectures || []) {
        const s = getLectureStepStatus(lec);
        if (!s.video || !s.details) {
          return { moduleId: mod._id, lectureId: lec._id, step: getFirstIncompleteStep(lec) };
        }
      }
    }
    return null;
  };

  const handleBuildAction = (action) => {
    if (action === 'focus-module') {
      document.getElementById('sidebar-new-module')?.focus();
      return;
    }
    if (action === 'focus-lecture') {
      const mod = modules[0];
      if (mod) selectModule(mod._id);
      return;
    }
    if (action === 'focus-incomplete') {
      const target = findFirstIncompleteLecture();
      if (target) {
        selectModule(target.moduleId);
        setActiveLectureId(target.lectureId);
        setWorkspaceMode('lecture');
        setLectureStep(target.step);
        setActiveTab('curriculum');
      }
      return;
    }
    if (action === 'go-settings') {
      setActiveTab('details');
      return;
    }
    if (action === 'go-vendors') {
      if (isVendor) {
        navigate(`/vendor-admin/courses/${courseId}/assign`);
        return;
      }
      setActiveTab('vendors');
    }
  };

  const saveLecture = async (andContinue = false) => {
    if (!activeLecture) return;
    setSaving(true);
    try {
      await axiosInstance.patch(`${coursePath}/lectures/${activeLecture._id}`, {
        title: activeLecture.title,
        description: activeLecture.description,
        notesHtml: activeLecture.notesHtml,
      });
      flash('Lecture saved');
      await refreshCourse();
      const status = getLectureStepStatus(activeLecture);
      if (status.details && status.video && status.notes) {
        setLectureJustFinished(true);
      }
      if (andContinue && lectureStep === 'details') {
        setLectureStep('video');
      }
    } catch (err) {
      showError(err.response?.data?.message || 'Failed to save lecture');
    } finally {
      setSaving(false);
    }
  };

  const uploadVideo = async (file) => {
    if (!file || !activeLecture) return;
    setUploadingVideo(true);
    flash('Uploading video…');
    try {
      const { data } = await axiosInstance.post(
        `${coursePath}/lectures/${activeLecture._id}/video/upload-url`,
        { fileName: file.name, contentType: file.type || 'video/mp4' }
      );
      await putToSignedUrl(data.uploadUrl, file);
      await axiosInstance.post(
        `${coursePath}/lectures/${activeLecture._id}/video/complete`
      );
      flash('Video uploaded — processing for streaming');
      await refreshCourse();
      setLectureStep('video');
    } catch (err) {
      showError(err.response?.data?.message || err.message || 'Video upload failed');
    } finally {
      setUploadingVideo(false);
    }
  };

  const uploadNotesPdf = async (file) => {
    if (!file || !activeLecture) return;
    setUploadingPdf(true);
    try {
      const { data } = await axiosInstance.post(
        `${coursePath}/lectures/${activeLecture._id}/notes-pdf/upload-url`,
        { fileName: file.name, contentType: file.type || 'application/pdf' }
      );
      await putToSignedUrl(data.uploadUrl, file);
      flash('Notes PDF uploaded');
      await refreshCourse();
    } catch (err) {
      showError(err.response?.data?.message || 'PDF upload failed');
    } finally {
      setUploadingPdf(false);
    }
  };

  const deleteLecture = async (lectureId) => {
    if (!window.confirm('Delete this lecture?')) return;
    await axiosInstance.delete(`${coursePath}/lectures/${lectureId}`);
    if (activeLectureId === lectureId) {
      setActiveLectureId(null);
      setWorkspaceMode('module');
    }
    await refreshCourse();
  };

  const deleteModule = async (moduleId) => {
    if (!window.confirm('Delete this module and all lectures?')) return;
    await axiosInstance.delete(`${coursePath}/modules/${moduleId}`);
    if (activeModuleId === moduleId) {
      setActiveModuleId(null);
      setActiveLectureId(null);
      setWorkspaceMode(modules.length > 1 ? 'module' : 'empty');
    }
    await refreshCourse();
  };

  const allocateVendors = async () => {
    if (!selectedVendorIds.length) return;
    try {
      await axiosInstance.post(`${coursePath}/allocations`, {
        vendorIds: selectedVendorIds,
      });
      setSelectedVendorIds([]);
      flash('Vendors allocated');
      await refreshCourse();
    } catch (err) {
      showError(err.response?.data?.message || 'Allocation failed');
    }
  };

  const attachPlatformAssessment = async (type, assessmentId) => {
    if (!activeModuleId || !type || !assessmentId) return;
    setSavingQuiz(true);
    try {
      const { data } = await axiosInstance.put(
        `${coursePath}/modules/${activeModuleId}/assessment`,
        { type, assessmentId }
      );
      setModuleAssessment(data.assessment || null);
      setModuleTest(data.assessment?.type === 'test' ? data.assessment.item : null);
      flash('Module assessment attached');
      await refreshCourse();
    } catch (err) {
      showError(err.response?.data?.message || 'Failed to attach assessment');
    } finally {
      setSavingQuiz(false);
    }
  };

  const createModuleQuiz = async ({ title, duration, type, questions }) => {
    if (!activeModuleId || !questions?.length) {
      showError('Pick at least one question from the bank');
      return;
    }
    setSavingQuiz(true);
    try {
      const { data } = await axiosInstance.put(
        `${coursePath}/modules/${activeModuleId}/test`,
        {
          create: {
            title: title || `${activeModule?.title || 'Module'} Quiz`,
            type: type || 'mcq',
            duration: Number(duration) || 30,
            questions,
          },
        }
      );
      setModuleTest(data.test || null);
      setModuleAssessment(data.test ? { type: 'test', item: data.test } : null);
      flash('Module quiz created');
      await refreshCourse();
    } catch (err) {
      showError(err.response?.data?.message || 'Failed to create quiz');
    } finally {
      setSavingQuiz(false);
    }
  };

  const updateModuleQuiz = async (update) => {
    if (!activeModuleId) return;
    setSavingQuiz(true);
    try {
      const { data } = await axiosInstance.put(
        `${coursePath}/modules/${activeModuleId}/test`,
        { update }
      );
      setModuleTest(data.test || null);
      flash('Quiz updated');
    } catch (err) {
      showError(err.response?.data?.message || 'Failed to update quiz');
    } finally {
      setSavingQuiz(false);
    }
  };

  const removeQuizQuestion = async (questionIndex) => {
    if (!moduleTest?.questions?.length) return;
    if (!window.confirm('Remove this question from the quiz?')) return;
    const questions = moduleTest.questions
      .filter((_, idx) => idx !== questionIndex)
      .map(({ type, questionId, questionType, points, order }, idx) => ({
        type,
        questionId,
        questionType,
        points,
        order: idx + 1,
      }));
    await updateModuleQuiz({ questions });
  };

  const addQuizQuestions = async (appendQuestions) => {
    if (!appendQuestions?.length) {
      showError('Select at least one question to add');
      return;
    }
    setSavingQuiz(true);
    try {
      const { data } = await axiosInstance.put(
        `${coursePath}/modules/${activeModuleId}/test`,
        { update: { appendQuestions } }
      );
      setModuleTest(data.test || null);
      flash('Questions added');
    } catch (err) {
      showError(err.response?.data?.message || 'Failed to add questions');
    } finally {
      setSavingQuiz(false);
    }
  };

  const clearAssessment = async () => {
    if (!activeModuleId) return;
    if (!window.confirm('Remove this module assessment?')) return;
    setSavingQuiz(true);
    try {
      await axiosInstance.put(
        `${coursePath}/modules/${activeModuleId}/assessment`,
        { clear: true }
      );
      setModuleTest(null);
      setModuleAssessment(null);
      await refreshCourse();
      flash('Assessment removed');
    } catch (err) {
      showError(err.response?.data?.message || 'Failed to remove assessment');
    } finally {
      setSavingQuiz(false);
    }
  };

  const handleWorkspaceBack = () => {
    if (workspaceMode === 'lecture') {
      setWorkspaceMode('module');
      setActiveLectureId(null);
    } else {
      setWorkspaceMode('empty');
      setActiveModuleId(null);
      setActiveLectureId(null);
    }
  };

  const updateLectureField = (field, value) => {
    setModules((prev) =>
      prev.map((m) => {
        if (m._id !== activeModuleId) return m;
        return {
          ...m,
          lectures: (m.lectures || []).map((l) =>
            l._id === activeLectureId ? { ...l, [field]: value } : l
          ),
        };
      })
    );
  };

  useEffect(() => {
    if (!modules.length) {
      setWorkspaceMode('empty');
      setActiveModuleId(null);
      setActiveLectureId(null);
    }
  }, [modules.length]);

  if (!course && loading) {
    return <VendorHubPage loading accent={COURSES_ACCENT} />;
  }

  const tabs = [
    { id: 'curriculum', label: 'Build curriculum', icon: FiLayers },
    { id: 'details', label: 'Course settings', icon: FiSettings },
    ...(!isVendor ? [{ id: 'vendors', label: 'Vendors', icon: FiUsers }] : []),
  ];

  const renderCurriculumMain = () => {
    let body = null;

    if (workspaceMode === 'lecture' && activeLecture && activeModule && lectureNav) {
      body = (
        <CourseLectureWorkspace
          lecture={activeLecture}
          lectureStep={lectureStep}
          lectureIndex={lectureNav.index}
          lectureTotal={lectureNav.total}
          onStepChange={setLectureStep}
          onFieldChange={updateLectureField}
          onSave={() => saveLecture(lectureStep === 'details')}
          onUploadVideo={uploadVideo}
          onUploadNotesPdf={uploadNotesPdf}
          onPrevLecture={() => goToAdjacentLecture('prev')}
          onNextLecture={() => goToAdjacentLecture('next')}
          hasPrevLecture={lectureNav.hasPrev}
          hasNextLecture={lectureNav.hasNext}
          saving={saving}
          uploadingVideo={uploadingVideo}
          uploadingPdf={uploadingPdf}
          justFinished={lectureJustFinished}
        />
      );
    } else if (workspaceMode === 'module' && activeModule) {
      body = (
        <CourseModuleLectureList
          module={activeModule}
          activeLectureId={activeLectureId}
          addingLecture={addingLecture}
          savingModule={savingModule}
          quizSectionId="module-quiz-section"
          onSelectLecture={selectLecture}
          onDeleteLecture={deleteLecture}
          onAddLecture={(title) => addLecture(title, activeModule._id)}
          onSaveModule={updateModule}
          moduleAssessment={moduleAssessment}
          moduleTest={moduleTest}
          loadingModuleTest={loadingModuleTest}
          onLoadModuleTest={() => loadModuleTest(activeModule._id)}
          savingQuiz={savingQuiz}
          onAttachPlatformAssessment={attachPlatformAssessment}
          onCreateModuleQuiz={createModuleQuiz}
          onClearAssessment={clearAssessment}
          onUpdateQuiz={updateModuleQuiz}
          onRemoveQuizQuestion={removeQuizQuestion}
          onAddQuizQuestions={addQuizQuestions}
          quizCatalog={quizCatalog}
          quizDescription={
            course?.unlockMode === 'open'
              ? 'Optional — students can take this anytime. It does not gate other modules.'
              : 'Optional — students complete it to unlock the next module.'
          }
        />
      );
    } else {
      body = (
        <div className="sa-curriculum-guide">
          <FiBookOpen size={40} />
          <h2>Select a module</h2>
          <p>Modules live on the left. Pick one to see its lectures, then open a lecture to edit content.</p>
          <ol className="sa-curriculum-guide-steps sa-curriculum-guide-steps--compact">
            <li>
              <span className="sa-guide-num">1</span>
              <div>
                <strong>Left panel</strong>
                <p>Add or select a module</p>
              </div>
            </li>
            <li>
              <span className="sa-guide-num">2</span>
              <div>
                <strong>This panel</strong>
                <p>Lists lectures in the module</p>
              </div>
            </li>
            <li>
              <span className="sa-guide-num">3</span>
              <div>
                <strong>Open a lecture</strong>
                <p>Edit details, video, and notes</p>
              </div>
            </li>
          </ol>
          {modules.length > 0 && (
            <button
              type="button"
              className="vh-btn vh-btn--primary"
              onClick={() => selectModule(modules[0]._id)}
            >
              Open first module
            </button>
          )}
        </div>
      );
    }

    return (
      <div className={`vh-panel sa-workspace-panel ${refreshing ? 'is-refreshing' : ''}`}>
        <CourseWorkspaceHeader
          mode={workspaceMode}
          moduleTitle={activeModule?.title}
          lectureTitle={activeLecture?.title}
          showBack={workspaceMode === 'lecture'}
          onBack={handleWorkspaceBack}
        />
        <div className="vh-panel-body sa-workspace-body">{body}</div>
      </div>
    );
  };

  return (
    <VendorHubPage
      loading={loading && !course}
      backTo={coursesHome}
      backLabel="All courses"
      eyebrow="Course editor"
      title={course?.title || 'Course'}
      subtitle={
        isVendor
          ? 'Build modules, add lectures and notes, optionally attach assessments, then publish and assign students'
          : 'Build modules, add lectures, upload content, then publish'
      }
      accent={COURSES_ACCENT}
      className="sa-page courses-page"
      actions={
        <button type="button" className="vh-btn vh-btn--primary" onClick={saveCourseMeta} disabled={saving}>
          <FiSave /> {saving ? 'Saving…' : 'Save course'}
        </button>
      }
    >
      <CourseEditorToast
        message={toast.message}
        error={toast.error}
        onDismiss={() => setToast({ message: '', error: '' })}
      />

      {course && (
        <>
          <div className="sa-courses-tabs">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                className={`sa-courses-tab ${activeTab === id ? 'is-active' : ''}`}
                onClick={() => setActiveTab(id)}
              >
                <Icon size={15} />
                {label}
              </button>
            ))}
            <span
              className={`vh-badge ${course.status === 'published' ? 'vh-badge--active' : 'vh-badge--inactive'}`}
              style={{ marginLeft: 'auto' }}
            >
              {course.status}
            </span>
          </div>

          {activeTab === 'curriculum' && (
            <>
              <CourseBuildProgress
                progress={buildProgress}
                refreshing={refreshing}
                audience={isVendor ? 'students' : 'vendors'}
                onAction={handleBuildAction}
              />

              <div className="sa-courses-curriculum">
                <CourseCurriculumSidebar
                  modules={modules}
                  activeModuleId={activeModuleId}
                  newModuleTitle={newModuleTitle}
                  addingModule={addingModule}
                  onNewModuleTitleChange={setNewModuleTitle}
                  onSelectModule={selectModule}
                  onOpenQuiz={openModuleQuiz}
                  onAddModule={addModule}
                  onDeleteModule={deleteModule}
                />
                <div className="sa-curriculum-main">{renderCurriculumMain()}</div>
              </div>
            </>
          )}

          {activeTab === 'details' && (
            <div className="vh-panel">
              <div className="vh-panel-head">
                <div>
                  <h2 className="vh-panel-title">Course settings</h2>
                  <p className="vh-panel-desc">Title, visibility, level, and description shown to students.</p>
                </div>
              </div>
              <div className="vh-panel-body">
                <div className="vh-form-grid vh-form-grid--2">
                  <div className="vh-field">
                    <label htmlFor="course-title">Title</label>
                    <input
                      id="course-title"
                      type="text"
                      value={course.title}
                      onChange={(e) => setCourse({ ...course, title: e.target.value })}
                    />
                  </div>
                  <div className="vh-field">
                    <label htmlFor="course-status">Status</label>
                    <select
                      id="course-status"
                      value={course.status}
                      onChange={(e) => setCourse({ ...course, status: e.target.value })}
                    >
                      <option value="draft">Draft</option>
                      <option value="published">Published</option>
                      <option value="archived">Archived</option>
                    </select>
                    <span className="vh-field-hint">
                      {isVendor
                        ? 'Publish when curriculum is ready for students.'
                        : 'Publish when curriculum is ready for vendors.'}
                    </span>
                  </div>
                  <div className="vh-field">
                    <label htmlFor="course-level">Level</label>
                    <select
                      id="course-level"
                      value={course.level}
                      onChange={(e) => setCourse({ ...course, level: e.target.value })}
                    >
                      <option value="beginner">Beginner</option>
                      <option value="intermediate">Intermediate</option>
                      <option value="advanced">Advanced</option>
                    </select>
                  </div>
                  <div className="vh-field">
                    <label htmlFor="course-hours">Estimated hours</label>
                    <input
                      id="course-hours"
                      type="number"
                      min="0"
                      value={course.estimatedHours || 0}
                      onChange={(e) =>
                        setCourse({ ...course, estimatedHours: Number(e.target.value) })
                      }
                    />
                  </div>
                </div>
                <div className="vh-field sa-unlock-field">
                  <span className="sa-unlock-label">Module access</span>
                  <p className="vh-field-hint" style={{ marginTop: 0, marginBottom: 10 }}>
                    Choose whether students wait for each module or can open the whole course at once.
                  </p>
                  <div className="sa-unlock-options" role="radiogroup" aria-label="Module access">
                    {UNLOCK_MODE_OPTIONS.map((opt) => {
                      const selected = (course.unlockMode || 'sequential') === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          className={`sa-unlock-option ${selected ? 'is-selected' : ''}`}
                          onClick={() => setCourse({ ...course, unlockMode: opt.id })}
                        >
                          <strong>{opt.label}</strong>
                          <span>{opt.description}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="vh-field" style={{ marginTop: 16 }}>
                  <label htmlFor="course-desc">Description</label>
                  <textarea
                    id="course-desc"
                    rows={4}
                    value={course.description || ''}
                    onChange={(e) => setCourse({ ...course, description: e.target.value })}
                    placeholder="What will students learn in this course?"
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'vendors' && !isVendor && (
            <div className="vh-panel">
              <div className="vh-panel-head">
                <div>
                  <h2 className="vh-panel-title">
                    <FiUsers style={{ verticalAlign: -2, marginRight: 6 }} />
                    Allocate to vendors
                  </h2>
                  <p className="vh-panel-desc">
                    Course must be <strong>published</strong> before vendors can assign it to students.
                  </p>
                </div>
              </div>
              <div className="vh-panel-body">
                <div className="sa-vendor-grid">
                  {vendors.map((v) => (
                    <label key={v._id} className="sa-vendor-card">
                      <input
                        type="checkbox"
                        checked={selectedVendorIds.includes(v._id)}
                        onChange={() =>
                          setSelectedVendorIds((prev) =>
                            prev.includes(v._id)
                              ? prev.filter((id) => id !== v._id)
                              : [...prev, v._id]
                          )
                        }
                      />
                      <span>
                        <strong style={{ display: 'block' }}>{v.companyName || v.name}</strong>
                        <span className="vh-cell-muted" style={{ fontSize: '0.84rem' }}>
                          {v.email}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
                <div className="vh-form-actions">
                  <button type="button" className="vh-btn vh-btn--primary" onClick={allocateVendors}>
                    Allocate selected vendors
                  </button>
                </div>
                {allocations.length > 0 && (
                  <div className="vh-table-wrap" style={{ marginTop: 20 }}>
                    <table className="vh-table">
                      <thead>
                        <tr>
                          <th>Vendor</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {allocations.map((a) => (
                          <tr key={a._id}>
                            <td>{a.vendorId?.companyName || a.vendorId?.name || 'Vendor'}</td>
                            <td>
                              <span
                                className={`vh-badge ${
                                  a.isActive === false ? 'vh-badge--inactive' : 'vh-badge--active'
                                }`}
                              >
                                {a.isActive === false ? 'Revoked' : 'Active'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </VendorHubPage>
  );
};

export default CourseEditor;
