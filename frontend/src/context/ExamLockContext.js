import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';

const ExamLockContext = createContext(null);

export function ExamLockProvider({ children }) {
  const [lock, setLock] = useState(null);
  const allowNavigateRef = useRef(false);

  const registerLock = useCallback((config) => {
    if (!config?.path) return;
    setLock({
      path: config.path,
      onNavigationAttempt: config.onNavigationAttempt,
    });
  }, []);

  const unregisterLock = useCallback(() => {
    setLock(null);
  }, []);

  const allowNextNavigation = useCallback(() => {
    allowNavigateRef.current = true;
  }, []);

  const consumeAllowNavigation = useCallback(() => {
    if (allowNavigateRef.current) {
      allowNavigateRef.current = false;
      return true;
    }
    return false;
  }, []);

  const lastNavAttemptRef = useRef(0);

  const reportNavigationAttempt = useCallback(() => {
    const now = Date.now();
    if (now - lastNavAttemptRef.current < 1000) return;
    lastNavAttemptRef.current = now;
    lock?.onNavigationAttempt?.();
  }, [lock]);

  const value = useMemo(
    () => ({
      lock,
      isExamLocked: Boolean(lock?.path),
      lockedPath: lock?.path ?? null,
      registerLock,
      unregisterLock,
      allowNextNavigation,
      consumeAllowNavigation,
      reportNavigationAttempt,
    }),
    [
      lock,
      registerLock,
      unregisterLock,
      allowNextNavigation,
      consumeAllowNavigation,
      reportNavigationAttempt,
    ]
  );

  return (
    <ExamLockContext.Provider value={value}>{children}</ExamLockContext.Provider>
  );
}

export function useExamLock() {
  const ctx = useContext(ExamLockContext);
  if (!ctx) {
    throw new Error('useExamLock must be used within ExamLockProvider');
  }
  return ctx;
}
