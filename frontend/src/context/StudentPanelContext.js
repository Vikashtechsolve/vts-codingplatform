import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import axiosInstance from '../utils/axios';

const StudentPanelContext = createContext(null);

export function useStudentPanel() {
  const ctx = useContext(StudentPanelContext);
  if (!ctx) {
    throw new Error('useStudentPanel must be used within StudentPanelProvider');
  }
  return ctx;
}

export function StudentPanelProvider({ children }) {
  const [tests, setTests] = useState([]);
  const [interviews, setInterviews] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [systemDesigns, setSystemDesigns] = useState([]);
  const [courses, setCourses] = useState([]);
  const [englishTrends, setEnglishTrends] = useState(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState(null);
  const hasLoadedRef = useRef(false);

  const refresh = useCallback(async ({ silent = false } = {}) => {
    const isBackground = silent || hasLoadedRef.current;
    if (!isBackground) {
      setInitialLoading(true);
    }
    setError(null);
    try {
      const [testsRes, interviewsRes, assignmentsRes, systemRes, coursesRes, trendsRes] =
        await Promise.all([
          axiosInstance.get('/students/tests'),
          axiosInstance.get('/interviews/assigned'),
          axiosInstance.get('/assignments/student/my-assignments'),
          axiosInstance.get('/system-design-problems/student-list'),
          axiosInstance
            .get('/student/courses', { params: { page: 1, limit: 50 } })
            .catch(() => ({ data: { items: [] } })),
          axiosInstance.get('/students/english-trends').catch(() => ({ data: null })),
        ]);

      setTests(testsRes.data || []);
      setInterviews(interviewsRes.data || []);
      const rawAssignments = assignmentsRes.data?.assignments ?? [];
      setAssignments(rawAssignments);
      setSystemDesigns(systemRes.data?.problems ?? []);
      setCourses(coursesRes.data?.items || []);
      if (trendsRes.data?.totalTests > 0) setEnglishTrends(trendsRes.data);
      else setEnglishTrends(null);
      hasLoadedRef.current = true;
    } catch (err) {
      console.error('Student panel data fetch failed:', err);
      setError('Unable to load your assessments. Please refresh.');
    } finally {
      setInitialLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const counts = useMemo(() => {
    const grouped = tests.reduce((acc, test) => {
      const rawType = test.type || 'other';
      const type = rawType === 'verbal' ? 'english' : rawType;
      if (!acc[type]) acc[type] = 0;
      acc[type] += 1;
      return acc;
    }, {});

    grouped.core = tests.filter((t) => t.type === 'theory').length;
    grouped.tools = tests.filter((t) => t.type === 'sql').length;

    return {
      coding: grouped.coding || 0,
      aptitude: grouped.aptitude || 0,
      mcq: grouped.mcq || 0,
      mixed: grouped.mixed || 0,
      english: (grouped.english || 0) + (grouped.verbal || 0),
      core: grouped.core || 0,
      project: assignments.length,
      interview: interviews.length,
      system: systemDesigns.length,
      tools: grouped.tools || 0,
      company: grouped.company || 0,
      courses: courses.length,
    };
  }, [tests, interviews, assignments, systemDesigns, courses]);

  const stats = useMemo(() => {
    const completedTests = tests.filter((t) => t.enrollmentStatus === 'completed');
    const inProgressTests = tests.filter((t) => t.enrollmentStatus === 'in_progress');
    const assignedTests = tests.filter((t) => !t.enrollmentStatus || t.enrollmentStatus === 'assigned');
    const completedInterviews = interviews.filter((i) => i.hasCompleted);
    const evaluatedAssignments = assignments.filter((a) => a.enrollmentStatus === 'evaluated');
    const evaluatedSystemDesigns = systemDesigns.filter(
      (sd) => sd.submission && sd.submission.status === 'evaluated'
    );
    const totalAssigned = tests.length + interviews.length + assignments.length + systemDesigns.length;
    const readinessScore =
      totalAssigned > 0
        ? Math.round(
            ((completedTests.length +
              completedInterviews.length +
              evaluatedAssignments.length +
              evaluatedSystemDesigns.length) /
              totalAssigned) *
              100
          )
        : 0;

    const upcomingTests = tests
      .filter((t) => t.startDate && new Date(t.startDate) > new Date())
      .sort((a, b) => new Date(a.startDate) - new Date(b.startDate));

    const pendingCount =
      inProgressTests.length +
      assignments.filter((a) => ['in_progress', 'submitted'].includes(a.enrollmentStatus)).length +
      systemDesigns.filter(
        (sd) => sd.submission && ['in_progress', 'submitted', 'evaluating'].includes(sd.submission.status)
      ).length;

    const readyCount =
      assignedTests.length +
      interviews.filter((i) => !i.hasCompleted).length +
      assignments.filter((a) => a.enrollmentStatus === 'assigned').length +
      systemDesigns.filter((sd) => !sd.submission).length;

    return {
      readinessScore,
      upcomingCount: upcomingTests.length,
      nextUpcoming: upcomingTests[0] || null,
      pendingCount,
      readyCount,
      totalAssigned,
      completedCount:
        completedTests.length + completedInterviews.length + evaluatedAssignments.length + evaluatedSystemDesigns.length,
    };
  }, [tests, interviews, assignments, systemDesigns]);

  const value = useMemo(
    () => ({
      tests,
      interviews,
      assignments,
      systemDesigns,
      courses,
      englishTrends,
      counts,
      stats,
      initialLoading,
      /** @deprecated use initialLoading — kept so existing screens only spin on first load */
      loading: initialLoading,
      error,
      refresh,
    }),
    [
      tests,
      interviews,
      assignments,
      systemDesigns,
      courses,
      englishTrends,
      counts,
      stats,
      initialLoading,
      error,
      refresh,
    ]
  );

  return <StudentPanelContext.Provider value={value}>{children}</StudentPanelContext.Provider>;
}
