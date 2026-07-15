import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
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

/** Same grouping as VendorAdmin TestList — derived from dashboard stats only. */
export function buildSectionCounts(testsByType = {}, totals = {}) {
  return {
    coding: testsByType.coding || 0,
    aptitude: testsByType.aptitude || 0,
    mcq: testsByType.mcq || 0,
    english: testsByType.english || 0,
    theory: testsByType.theory || 0,
    mixed: testsByType.mixed || 0,
    tools: testsByType.sql || 0,
    project: totals.totalAssignments || 0,
    interview: totals.totalInterviews || 0,
    system: totals.totalSystemDesigns || 0,
    company: 0,
  };
}

export function VendorPanelProvider({ children }) {
  const [stats, setStats] = useState(defaultStats);
  const [loading, setLoading] = useState(true);
  const hasLoadedRef = useRef(false);

  const refreshStats = useCallback(async ({ silent = false } = {}) => {
    const isBackground = silent || hasLoadedRef.current;
    if (!isBackground) setLoading(true);
    try {
      const { data: api } = await axiosInstance.get('/vendor-admin/dashboard/stats');

      const testsByType = api?.testsByType || {};
      const sectionCounts = api?.sectionCounts || buildSectionCounts(testsByType, api);

      setStats({
        ...defaultStats,
        ...api,
        testsByType,
        sectionCounts,
        totalAssessments:
          api?.totalAssessments ??
          (api?.totalTests || 0) +
            (api?.totalInterviews || 0) +
            (api?.totalAssignments || 0) +
            (api?.totalSystemDesigns || 0),
        questions: api?.questions || defaultStats.questions,
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
