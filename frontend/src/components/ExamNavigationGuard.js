import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useExamLock } from '../context/ExamLockContext';

/**
 * Blocks SPA navigation away from an active exam route.
 * Records a navigation_attempt violation and keeps the student on the test.
 */
const ExamNavigationGuard = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    isExamLocked,
    lockedPath,
    consumeAllowNavigation,
    reportNavigationAttempt,
  } = useExamLock();

  useEffect(() => {
    if (!isExamLocked || !lockedPath) return undefined;

    const onClickCapture = (e) => {
      const anchor = e.target?.closest?.('a[href]');
      if (!anchor) return;

      const href = anchor.getAttribute('href');
      if (!href || href.startsWith('http') || href.startsWith('#') || href.startsWith('mailto:')) {
        return;
      }

      const path = href.split('?')[0].split('#')[0];
      if (!path.startsWith('/') || path === lockedPath) return;

      e.preventDefault();
      e.stopPropagation();
      reportNavigationAttempt();
    };

    document.addEventListener('click', onClickCapture, true);
    return () => document.removeEventListener('click', onClickCapture, true);
  }, [isExamLocked, lockedPath, reportNavigationAttempt]);

  useEffect(() => {
    if (!isExamLocked || !lockedPath) return;

    if (consumeAllowNavigation()) return;

    if (location.pathname !== lockedPath) {
      reportNavigationAttempt();
      navigate(lockedPath, { replace: true });
    }
  }, [
    location.pathname,
    isExamLocked,
    lockedPath,
    navigate,
    consumeAllowNavigation,
    reportNavigationAttempt,
  ]);

  useEffect(() => {
    if (!isExamLocked || !lockedPath) return undefined;

    const onPopState = () => {
      if (consumeAllowNavigation()) return;
      window.setTimeout(() => {
        if (window.location.pathname !== lockedPath) {
          reportNavigationAttempt();
          navigate(lockedPath, { replace: true });
        }
      }, 0);
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [isExamLocked, lockedPath, navigate, consumeAllowNavigation, reportNavigationAttempt]);

  useEffect(() => {
    document.body.classList.toggle('exam-navigation-locked', isExamLocked);
    return () => document.body.classList.remove('exam-navigation-locked');
  }, [isExamLocked]);

  return null;
};

export default ExamNavigationGuard;
