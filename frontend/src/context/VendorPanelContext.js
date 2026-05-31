import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import axiosInstance from '../utils/axios';

const VendorPanelContext = createContext(null);

const defaultStats = {
  totalTests: 0,
  totalStudents: 0,
  totalResults: 0,
  completedResults: 0,
  totalClassrooms: 0,
  totalInterviews: 0,
  totalAssignments: 0,
  totalSystemDesigns: 0,
  totalDatasetTemplates: 0,
  totalAssessments: 0,
  testsByType: {},
  sectionCounts: {},
  questions: { coding: 0, mcq: 0, aptitude: 0, theory: 0 },
};

/** Same grouping as VendorAdmin TestList */
export function buildSectionCounts(tests, interviews, assignments, systemDesigns) {
  const counts = {
    coding: 0,
    aptitude: 0,
    mcq: 0,
    english: 0,
    theory: 0,
    mixed: 0,
    tools: 0,
    project: assignments.length,
    interview: interviews.length,
    system: systemDesigns.length,
    company: 0,
  };

  for (const t of tests) {
    const type = t.type;
    if (type === 'sql') {
      counts.tools += 1;
    } else if (type && Object.prototype.hasOwnProperty.call(counts, type)) {
      counts[type] += 1;
    }
  }

  return counts;
}

export function VendorPanelProvider({ children }) {
  const [stats, setStats] = useState(defaultStats);
  const [loading, setLoading] = useState(true);
  const location = useLocation();
  const hasLoadedRef = useRef(false);
  const skipPathRefreshRef = useRef(true);

  const refreshStats = useCallback(async ({ silent = false } = {}) => {
    const isBackground = silent || hasLoadedRef.current;
    if (!isBackground) setLoading(true);
    try {
      const [statsRes, testsRes, interviewsRes, assignmentsRes, systemDesignRes] = await Promise.all([
        axiosInstance.get('/vendor-admin/dashboard/stats').catch(() => ({ data: {} })),
        axiosInstance.get('/vendor-admin/tests'),
        axiosInstance.get('/interviews').catch(() => ({ data: [] })),
        axiosInstance.get('/assignments').catch(() => ({ data: { assignments: [] } })),
        axiosInstance.get('/system-design-problems').catch(() => ({ data: { problems: [] } })),
      ]);

      const tests = Array.isArray(testsRes.data) ? testsRes.data : [];
      const interviews = Array.isArray(interviewsRes.data) ? interviewsRes.data : [];
      const assignments = assignmentsRes.data?.assignments ?? [];
      const systemDesigns = systemDesignRes.data?.problems ?? [];

      const sectionCounts = buildSectionCounts(tests, interviews, assignments, systemDesigns);
      const totalAssessments =
        tests.length + interviews.length + assignments.length + systemDesigns.length;

      const testsByType = {};
      for (const t of tests) {
        const type = t.type || 'other';
        testsByType[type] = (testsByType[type] || 0) + 1;
      }

      const api = statsRes.data || {};
      setStats({
        ...defaultStats,
        ...api,
        totalTests: tests.length,
        totalInterviews: interviews.length,
        totalAssignments: assignments.length,
        totalSystemDesigns: systemDesigns.length,
        totalAssessments,
        testsByType,
        sectionCounts,
        questions: api.questions || defaultStats.questions,
      });
      hasLoadedRef.current = true;
    } catch (err) {
      console.error('Vendor panel stats:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshStats();
    const onFocus = () => refreshStats({ silent: true });
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [refreshStats]);

  useEffect(() => {
    if (skipPathRefreshRef.current) {
      skipPathRefreshRef.current = false;
      return;
    }
    if (!hasLoadedRef.current) return;
    refreshStats({ silent: true });
  }, [location.pathname, location.search, refreshStats]);

  const getSectionCount = useCallback(
    (sectionId) => {
      const counts = stats.sectionCounts;
      if (counts && typeof counts[sectionId] === 'number') {
        return counts[sectionId];
      }
      return 0;
    },
    [stats.sectionCounts]
  );

  return (
    <VendorPanelContext.Provider value={{ stats, loading, refreshStats, getSectionCount }}>
      {children}
    </VendorPanelContext.Provider>
  );
}

export function useVendorPanel() {
  const ctx = useContext(VendorPanelContext);
  if (!ctx) throw new Error('useVendorPanel must be used within VendorPanelProvider');
  return ctx;
}
