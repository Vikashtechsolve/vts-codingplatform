import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useExamLock } from '../context/ExamLockContext';

/**
 * Registers the current route as locked while an exam is in progress.
 * @param {boolean} active - true when the student must stay on the exam page
 * @param {{ trackViolation?: (type: string, details?: string) => void }} options
 */
export function useRegisterExamLock(active, { trackViolation } = {}) {
  const location = useLocation();
  const { registerLock, unregisterLock } = useExamLock();
  const trackViolationRef = useRef(trackViolation);

  useEffect(() => {
    trackViolationRef.current = trackViolation;
  }, [trackViolation]);

  useEffect(() => {
    if (!active || typeof trackViolationRef.current !== 'function') {
      unregisterLock();
      return undefined;
    }

    registerLock({
      path: location.pathname,
      onNavigationAttempt: () => {
        trackViolationRef.current?.(
          'navigation_attempt',
          'Attempted to leave the exam (navigation blocked)'
        );
      },
    });

    return () => unregisterLock();
  }, [active, location.pathname, registerLock, unregisterLock]);
}
