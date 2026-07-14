import { useEffect, useRef, useState, useCallback } from 'react';
import axiosInstance from '../utils/axios';
import { isDocumentFullscreen, requestDocumentFullscreen } from '../utils/fullscreen';
import {
  resetExamClipboard,
  recordInternalCopy,
  allowsInternalPaste,
} from '../utils/examClipboard';
import {
  isInternalEditableZone,
  isActiveElementInInternalZone,
  isExamChoiceControl,
  getCopyTextFromEvent,
  getPasteTextFromEvent,
  allowsEditorMetaShortcut,
  isSilentBlockMetaShortcut,
  isBlockedBrowserShortcut,
  allowsDragInExam,
  shouldAllowTypingInExamContext,
  shouldSilentlyBlockClipboardShortcut,
  isComposingKeyEvent,
} from '../utils/examSecurityDom';
import {
  MAX_EXAM_VIOLATIONS,
  EXAM_GRACE_PERIOD_MS,
  VIOLATION_DEBOUNCE_MS,
  VIOLATION_COOLDOWN_MS,
  FOCUS_LOSS_THRESHOLD_MS,
  FOCUS_POLL_INTERVAL_MS,
  getViolationCooldownKey,
} from '../constants/examSecurity';

export { MAX_EXAM_VIOLATIONS };

function resolveMaxViolations(value) {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : MAX_EXAM_VIOLATIONS;
}

function isSecurityPaused() {
  return Boolean(
    document.querySelector('.exam-fullscreen-prompt') ||
    document.querySelector('.modal-overlay') ||
    document.querySelector('.sdt-violation-overlay')
  );
}

/**
 * Proctoring for timed in-browser exams (coding, English, system design).
 * Detects focus loss (incl. macOS desktop swipe), tab hide, fullscreen exit,
 * copy/paste, and blocked shortcuts. Max violations → auto-submit on backend.
 */
export const useExamSecurity = (
  resultId,
  onMaxViolationsReached,
  onViolationWarning,
  options = {}
) => {
  const {
    violationEndpoint,
    autoRequestFullscreen = true,
    initialViolationCount = 0,
    maxViolations: initialMaxViolations,
  } = options;

  const [violations, setViolations] = useState(initialViolationCount);
  const [maxViolationsLimit, setMaxViolationsLimit] = useState(() =>
    resolveMaxViolations(initialMaxViolations)
  );
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [securityOverlay, setSecurityOverlay] = useState(null);

  const violationsRef = useRef(initialViolationCount);
  const maxViolationsRef = useRef(maxViolationsLimit);
  const onMaxViolationsRef = useRef(onMaxViolationsReached);
  const onViolationWarningRef = useRef(onViolationWarning);

  useEffect(() => {
    violationsRef.current = violations;
  }, [violations]);

  useEffect(() => {
    maxViolationsRef.current = maxViolationsLimit;
  }, [maxViolationsLimit]);

  useEffect(() => {
    if (initialMaxViolations != null) {
      setMaxViolationsLimit(resolveMaxViolations(initialMaxViolations));
    }
  }, [initialMaxViolations, resultId]);

  useEffect(() => {
    onMaxViolationsRef.current = onMaxViolationsReached;
  }, [onMaxViolationsReached]);

  useEffect(() => {
    onViolationWarningRef.current = onViolationWarning;
  }, [onViolationWarning]);

  const warningShownFor = useRef(new Set());
  const fullscreenRequested = useRef(false);
  const violationCheckInterval = useRef(null);
  const focusPollInterval = useRef(null);
  const isActive = useRef(false);
  const initializationTime = useRef(null);
  const isInitializing = useRef(true);
  const lastViolationTime = useRef({});
  const pendingViolations = useRef(new Map());
  const focusLostAt = useRef(null);
  const focusLossTimer = useRef(null);

  useEffect(() => {
    if (typeof initialViolationCount === 'number' && initialViolationCount >= 0) {
      violationsRef.current = initialViolationCount;
      setViolations(initialViolationCount);
    }
  }, [initialViolationCount, resultId]);

  const trackViolation = useCallback(
    async (type, details = '') => {
      if (!resultId || !isActive.current) return violationsRef.current;

      if (isSecurityPaused()) return violationsRef.current;

      if (isInitializing.current && initializationTime.current) {
        const timeSinceInit = Date.now() - initializationTime.current;
        if (timeSinceInit < EXAM_GRACE_PERIOD_MS) {
          return violationsRef.current;
        }
        isInitializing.current = false;
      }

      if (isInitializing.current && ['window_blur', 'tab_switch', 'desktop_switch', 'fullscreen_exit', 'page_hidden'].includes(type)) {
        return violationsRef.current;
      }

      const cooldownKey = getViolationCooldownKey(type);
      const now = Date.now();
      const lastTime = lastViolationTime.current[cooldownKey] || 0;
      if (now - lastTime < VIOLATION_COOLDOWN_MS) {
        return violationsRef.current;
      }

      if (pendingViolations.current.has(cooldownKey)) {
        clearTimeout(pendingViolations.current.get(cooldownKey));
      }

      const timeoutId = setTimeout(async () => {
        try {
          lastViolationTime.current[cooldownKey] = Date.now();
          pendingViolations.current.delete(cooldownKey);

          const endpoint = violationEndpoint || `/results/${resultId}/violation`;
          const response = await axiosInstance.post(endpoint, { type, details });

          const newViolationCount =
            response.data.violationCount ?? violationsRef.current + 1;
          const serverMax = response.data.maxViolations;
          const limit = serverMax != null
            ? resolveMaxViolations(serverMax)
            : maxViolationsRef.current;
          if (serverMax != null) {
            setMaxViolationsLimit(limit);
          }
          violationsRef.current = newViolationCount;
          setViolations(newViolationCount);

          if (newViolationCount >= limit && response.data.autoSubmitted) {
            onMaxViolationsRef.current?.();
          }
        } catch (error) {
          console.error('Error tracking violation:', error);
          pendingViolations.current.delete(cooldownKey);
        }
      }, VIOLATION_DEBOUNCE_MS);

      pendingViolations.current.set(cooldownKey, timeoutId);
      return violationsRef.current;
    },
    [resultId, violationEndpoint]
  );

  const trackViolationRef = useRef(trackViolation);
  useEffect(() => {
    trackViolationRef.current = trackViolation;
  }, [trackViolation]);

  const recordFocusLoss = useCallback((type, details) => {
    if (!isActive.current || isInitializing.current || isSecurityPaused()) return;
    if (document.hasFocus() && !document.hidden) return;
    trackViolationRef.current?.(type, details);
  }, []);

  const scheduleFocusLossCheck = useCallback(
    (type) => {
      if (focusLossTimer.current) clearTimeout(focusLossTimer.current);
      focusLossTimer.current = setTimeout(() => {
        focusLossTimer.current = null;
        if (!document.hasFocus() || document.hidden) {
          recordFocusLoss(
            type,
            document.hidden
              ? 'Page hidden (tab switch or app switch)'
              : 'Window lost focus (app switch or desktop)'
          );
        }
      }, FOCUS_LOSS_THRESHOLD_MS);
    },
    [recordFocusLoss]
  );

  const requestFullscreen = useCallback(async () => {
    const ok = await requestDocumentFullscreen();
    if (ok || isDocumentFullscreen()) {
      fullscreenRequested.current = true;
      setIsFullscreen(true);
    }
  }, []);

  const checkFullscreen = useCallback(() => {
    const isCurrentlyFullscreen = isDocumentFullscreen();

    if (!isCurrentlyFullscreen && fullscreenRequested.current && !isInitializing.current) {
      setIsFullscreen(false);
      setSecurityOverlay('fullscreen');
      trackViolationRef.current?.('fullscreen_exit', 'Exited fullscreen mode');
    } else {
      setIsFullscreen(isCurrentlyFullscreen);
      if (isCurrentlyFullscreen) {
        setSecurityOverlay((prev) => (prev === 'fullscreen' ? null : prev));
      }
    }
  }, []);

  const checkMultipleScreens = useCallback(() => {
    if (window.screen?.isExtended) {
      trackViolationRef.current?.('multiple_screens', 'Extended or multiple displays detected');
      return;
    }
    if (window.screen && window.screen.width > 2560) {
      trackViolationRef.current?.('multiple_screens', `Unusually wide screen: ${window.screen.width}px`);
    }
  }, []);

  useEffect(() => {
    const blockAndViolate = (type, details) => {
      trackViolationRef.current?.(type, details);
    };

    const blockOnly = (e) => {
      e.preventDefault();
      e.stopPropagation();
    };

    const handleCopyBlock = (e) => {
      if (isSecurityPaused()) return;
      if (isInternalEditableZone(e.target)) return;

      blockOnly(e);
    };

    const handleCopyRecord = (e) => {
      if (isSecurityPaused()) return;
      if (!isInternalEditableZone(e.target)) return;

      const record = () => {
        const text = getCopyTextFromEvent(e);
        if (text) recordInternalCopy(text);
      };

      record();
      requestAnimationFrame(record);
    };

    const handleCutBlock = (e) => {
      if (isSecurityPaused()) return;
      if (isInternalEditableZone(e.target)) return;

      blockOnly(e);
    };

    const handleCutRecord = (e) => {
      if (isSecurityPaused()) return;
      if (!isInternalEditableZone(e.target)) return;

      const record = () => {
        const text = getCopyTextFromEvent(e);
        if (text) recordInternalCopy(text);
      };

      record();
      requestAnimationFrame(record);
    };

    const handlePaste = (e) => {
      if (isSecurityPaused()) return;

      if (!isInternalEditableZone(e.target)) {
        blockOnly(e);
        return;
      }

      const pasted = getPasteTextFromEvent(e);
      if (allowsInternalPaste(pasted)) {
        return;
      }

      blockOnly(e);
    };

    const handleContextMenu = (e) => {
      if (isSecurityPaused()) return;

      if (isInternalEditableZone(e.target)) {
        return;
      }

      blockOnly(e);
    };

    const handleKeyDown = (e) => {
      if (isSecurityPaused()) return;

      if (isComposingKeyEvent(e)) return;

      // Never intercept normal typing inside Monaco / text editors (incl. sticky Alt).
      if (shouldAllowTypingInExamContext(e)) {
        return;
      }

      const allowedTypingKeys = [
        'Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
        'Tab', 'Enter', 'Escape', 'Home', 'End', 'PageUp', 'PageDown', ' ',
      ];

      if (allowedTypingKeys.includes(e.key) && !e.metaKey && !e.ctrlKey && !e.altKey) {
        return;
      }

      // In-editor undo/copy/paste etc. — allowed without violation
      if (allowsEditorMetaShortcut(e)) {
        return;
      }

      // Copy/cut/paste outside editor — block only, never count as violation
      if (shouldSilentlyBlockClipboardShortcut(e)) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      // Navigation / devtools / tab shortcuts — block and count violation
      const blocked = isBlockedBrowserShortcut(e);
      if (blocked) {
        e.preventDefault();
        e.stopPropagation();
        const lower = blocked.toLowerCase();
        let violationType = 'shortcut_key';
        if (lower.includes('developer')) violationType = 'devtools_attempt';
        else if (lower.includes('browser shortcut') || lower.includes('window switch')) {
          violationType = 'navigation_attempt';
        }
        blockAndViolate(violationType, `Blocked: ${blocked}`);
        return;
      }

      // Undo/redo/save/find etc. — block only, no violation (accidental muscle memory)
      if (isSilentBlockMetaShortcut(e)) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      // Other unknown modifier combos — block silently, do not penalize
      if ((e.ctrlKey || e.metaKey || e.altKey) && !allowedTypingKeys.includes(e.key)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    const syncTabOverlay = () => {
      if (!isActive.current || isSecurityPaused()) return;
      setSecurityOverlay((prev) => {
        if (prev === 'fullscreen') return prev;
        return document.hidden ? 'focus' : null;
      });
    };

    const handleVisibilityChange = () => {
      if (!isActive.current || isInitializing.current || isSecurityPaused()) return;

      if (document.hidden) {
        syncTabOverlay();
        recordFocusLoss('tab_switch', 'Tab hidden or window not visible');
      } else {
        syncTabOverlay();
        focusLostAt.current = null;
        window.focus();
      }
    };

    const handleWindowBlur = () => {
      if (!isActive.current || isInitializing.current || isSecurityPaused()) return;
      scheduleFocusLossCheck('window_blur');
    };

    const handleWindowFocus = () => {
      if (focusLossTimer.current) {
        clearTimeout(focusLossTimer.current);
        focusLossTimer.current = null;
      }
      focusLostAt.current = null;
      if (!document.hidden) {
        syncTabOverlay();
      }
    };

    const handlePageHide = () => {
      if (!isActive.current || isInitializing.current) return;
      recordFocusLoss('page_hidden', 'Page hidden or navigating away');
    };

    const handleBeforeUnload = (e) => {
      if (!isActive.current) return;
      e.preventDefault();
      e.returnValue = '';
    };

    const handleDragStart = (e) => {
      if (allowsDragInExam(e.target)) return;
      e.preventDefault();
    };

    const handleDrop = (e) => {
      if (allowsDragInExam(e.target) && !(e.dataTransfer?.files?.length > 0)) {
        return;
      }
      if (e.dataTransfer?.files?.length > 0) {
        e.preventDefault();
        return;
      }
      if (!isInternalEditableZone(e.target)) {
        e.preventDefault();
      }
    };

    const handleSelectStart = (e) => {
      if (isSecurityPaused()) return;
      if (
        isInternalEditableZone(e.target) ||
        isActiveElementInInternalZone() ||
        isExamChoiceControl(e.target)
      ) {
        return;
      }
      e.preventDefault();
    };

    if (!resultId) return undefined;

    isActive.current = true;
    initializationTime.current = Date.now();
    isInitializing.current = true;
    const pendingSnapshot = pendingViolations.current;

    setTimeout(() => {
      isInitializing.current = false;
    }, EXAM_GRACE_PERIOD_MS);

    document.body.classList.add('exam-protected');

    document.addEventListener('copy', handleCopyBlock, true);
    document.addEventListener('copy', handleCopyRecord, false);
    document.addEventListener('paste', handlePaste, true);
    document.addEventListener('cut', handleCutBlock, true);
    document.addEventListener('cut', handleCutRecord, false);
    document.addEventListener('contextmenu', handleContextMenu, true);
    document.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('selectstart', handleSelectStart, true);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('focus', handleWindowFocus);
    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('dragstart', handleDragStart);
    document.addEventListener('drop', handleDrop);

    document.addEventListener('fullscreenchange', checkFullscreen);
    document.addEventListener('webkitfullscreenchange', checkFullscreen);
    document.addEventListener('mozfullscreenchange', checkFullscreen);
    document.addEventListener('MSFullscreenChange', checkFullscreen);

    violationCheckInterval.current = setInterval(() => {
      checkFullscreen();
      checkMultipleScreens();
    }, 1000);

    focusPollInterval.current = setInterval(() => {
      if (!isActive.current || isInitializing.current || isSecurityPaused()) {
        focusLostAt.current = null;
        return;
      }
      if (document.hidden) {
        setSecurityOverlay((prev) => (prev === 'fullscreen' ? prev : 'focus'));
      }

      if (!document.hasFocus() || document.hidden) {
        if (!focusLostAt.current) {
          focusLostAt.current = Date.now();
        } else if (Date.now() - focusLostAt.current >= FOCUS_LOSS_THRESHOLD_MS) {
          recordFocusLoss(
            'desktop_switch',
            'Focus lost — switched app, desktop, or Mission Control (macOS/Windows)'
          );
          focusLostAt.current = null;
        }
      } else {
        focusLostAt.current = null;
      }
    }, FOCUS_POLL_INTERVAL_MS);

    checkFullscreen();
    checkMultipleScreens();

    if (autoRequestFullscreen) {
      setTimeout(() => requestFullscreen(), 500);
    }

    return () => {
      document.body.classList.remove('exam-protected');
      resetExamClipboard();
      setSecurityOverlay(null);

      document.removeEventListener('copy', handleCopyBlock, true);
      document.removeEventListener('copy', handleCopyRecord, false);
      document.removeEventListener('paste', handlePaste, true);
      document.removeEventListener('cut', handleCutBlock, true);
      document.removeEventListener('cut', handleCutRecord, false);
      document.removeEventListener('contextmenu', handleContextMenu, true);
      document.removeEventListener('keydown', handleKeyDown, true);
      document.removeEventListener('selectstart', handleSelectStart, true);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('focus', handleWindowFocus);
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('dragstart', handleDragStart);
      document.removeEventListener('drop', handleDrop);
      document.removeEventListener('fullscreenchange', checkFullscreen);
      document.removeEventListener('webkitfullscreenchange', checkFullscreen);
      document.removeEventListener('mozfullscreenchange', checkFullscreen);
      document.removeEventListener('MSFullscreenChange', checkFullscreen);

      if (focusLossTimer.current) clearTimeout(focusLossTimer.current);
      pendingSnapshot?.forEach((id) => clearTimeout(id));
      pendingSnapshot?.clear();
      if (violationCheckInterval.current) clearInterval(violationCheckInterval.current);
      if (focusPollInterval.current) clearInterval(focusPollInterval.current);
      isActive.current = false;
    };
  }, [
    resultId,
    recordFocusLoss,
    scheduleFocusLossCheck,
    checkFullscreen,
    checkMultipleScreens,
    requestFullscreen,
    autoRequestFullscreen,
  ]);

  useEffect(() => {
    if (
      violations > 0 &&
      violations < maxViolationsLimit &&
      !warningShownFor.current.has(violations)
    ) {
      onViolationWarningRef.current?.(violations, maxViolationsLimit);
      warningShownFor.current.add(violations);
    }
  }, [violations, maxViolationsLimit]);

  const handleReenterFullscreen = useCallback(async () => {
    await requestFullscreen();
    if (isDocumentFullscreen()) {
      setSecurityOverlay((prev) => (prev === 'fullscreen' ? null : prev));
    }
  }, [requestFullscreen]);

  return {
    violations,
    maxViolations: maxViolationsLimit,
    isFullscreen,
    requestFullscreen,
    trackViolation,
    securityOverlay,
    onReenterFullscreen: handleReenterFullscreen,
  };
};
