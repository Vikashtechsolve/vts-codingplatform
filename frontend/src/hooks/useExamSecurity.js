import { useEffect, useRef, useState, useCallback } from 'react';
import axiosInstance from '../utils/axios';

const MAX_VIOLATIONS = parseInt(process.env.REACT_APP_MAX_VIOLATIONS || '3', 10);

export const useExamSecurity = (resultId, onMaxViolationsReached, onViolationWarning) => {
  const [violations, setViolations] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const warningShownFor = useRef(new Set()); // Track which violation counts we've warned about
  const fullscreenRequested = useRef(false);
  const violationCheckInterval = useRef(null);
  const isActive = useRef(false);
  const initializationTime = useRef(null);
  const gracePeriod = 3000; // 3 seconds grace period after initialization
  const isInitializing = useRef(true);
  const lastViolationTime = useRef({}); // Track last violation time per type
  const violationCooldown = 2000; // 2 seconds cooldown between same type violations
  const pendingViolations = useRef(new Map()); // Debounce violations

  // Track violation on backend with debouncing and cooldown
  const trackViolation = useCallback(async (type, details = '') => {
    if (!resultId || !isActive.current) return;
    
    // Ignore violations during grace period (initial page load)
    if (isInitializing.current && initializationTime.current) {
      const timeSinceInit = Date.now() - initializationTime.current;
      if (timeSinceInit < gracePeriod) {
        console.log(`Ignoring violation during grace period: ${type}`);
        return violations;
      }
      isInitializing.current = false;
    }
    
    // Ignore certain violation types during initialization
    if (isInitializing.current && ['window_blur', 'tab_switch', 'fullscreen_exit'].includes(type)) {
      return violations;
    }
    
    // Cooldown check - prevent rapid-fire violations of the same type
    const now = Date.now();
    const lastTime = lastViolationTime.current[type] || 0;
    if (now - lastTime < violationCooldown) {
      console.log(`Ignoring duplicate violation (cooldown): ${type}`);
      return violations;
    }
    
    // Debounce - cancel any pending violation of the same type
    if (pendingViolations.current.has(type)) {
      clearTimeout(pendingViolations.current.get(type));
    }
    
    // Set debounce timeout
    const timeoutId = setTimeout(async () => {
      try {
        lastViolationTime.current[type] = Date.now();
        pendingViolations.current.delete(type);
        
        const response = await axiosInstance.post(`/results/${resultId}/violation`, {
          type,
          details
        });
        
        const newViolationCount = response.data.violationCount || violations + 1;
        setViolations(newViolationCount);
        
        // Check if max violations reached
        if (newViolationCount >= MAX_VIOLATIONS && response.data.autoSubmitted) {
          if (onMaxViolationsReached) {
            onMaxViolationsReached();
          }
        }
      } catch (error) {
        console.error('Error tracking violation:', error);
        pendingViolations.current.delete(type);
      }
    }, 500); // 500ms debounce
    
    pendingViolations.current.set(type, timeoutId);
    return violations;
  }, [resultId, violations, onMaxViolationsReached, gracePeriod, violationCooldown]);

  // Request fullscreen
  const requestFullscreen = useCallback(async () => {
    try {
      const element = document.documentElement;
      
      // Try different fullscreen APIs for cross-platform compatibility
      if (element.requestFullscreen) {
        await element.requestFullscreen().catch(() => {
          // User might have denied, don't track as violation
        });
      } else if (element.webkitRequestFullscreen) {
        // Safari
        await element.webkitRequestFullscreen().catch(() => {});
      } else if (element.mozRequestFullScreen) {
        // Firefox
        await element.mozRequestFullScreen().catch(() => {});
      } else if (element.msRequestFullscreen) {
        // IE/Edge
        await element.msRequestFullscreen().catch(() => {});
      }
      
      // Check if we actually entered fullscreen
      const isCurrentlyFullscreen = !!(
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.mozFullScreenElement ||
        document.msFullscreenElement
      );
      
      if (isCurrentlyFullscreen) {
        fullscreenRequested.current = true;
        setIsFullscreen(true);
      }
    } catch (error) {
      // Don't track as violation if user denies fullscreen permission
      console.log('Fullscreen request failed (user may have denied):', error.message);
    }
  }, []);

    // Check fullscreen status
  const checkFullscreen = useCallback(() => {
    const isCurrentlyFullscreen = !!(
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.mozFullScreenElement ||
      document.msFullscreenElement
    );
    
    // Only track fullscreen exit if we're past initialization and it was actually requested
    if (!isCurrentlyFullscreen && fullscreenRequested.current && !isInitializing.current) {
      setIsFullscreen(false);
      trackViolation('fullscreen_exit', 'User exited fullscreen mode');
    } else {
      setIsFullscreen(isCurrentlyFullscreen);
    }
  }, [trackViolation]);

  // Detect multiple screens
  const checkMultipleScreens = useCallback(() => {
    if (window.screen && window.screen.width > 1920) {
      trackViolation('multiple_screens', `Screen width: ${window.screen.width}`);
    }
  }, [trackViolation]);

  // Block copy/paste
  useEffect(() => {
    const handleCopy = (e) => {
      e.preventDefault();
      trackViolation('copy_paste', 'Copy attempt');
      return false;
    };

    const handlePaste = (e) => {
      e.preventDefault();
      trackViolation('copy_paste', 'Paste attempt');
      return false;
    };

    const handleCut = (e) => {
      e.preventDefault();
      trackViolation('copy_paste', 'Cut attempt');
      return false;
    };

    // Block context menu (right-click)
    const handleContextMenu = (e) => {
      e.preventDefault();
      trackViolation('copy_paste', 'Right-click context menu');
      return false;
    };

    // Block keyboard shortcuts
    const handleKeyDown = (e) => {
      // Allow essential keys for typing
      const allowedKeys = [
        'Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
        'Tab', 'Enter', 'Escape', 'Home', 'End', 'PageUp', 'PageDown'
      ];
      
      // Block Ctrl/Cmd combinations
      if ((e.ctrlKey || e.metaKey) && !allowedKeys.includes(e.key)) {
        e.preventDefault();
        trackViolation('shortcut_key', `Blocked shortcut: ${e.key} (Ctrl/Cmd)`);
        return false;
      }
      
      // Block F5 (refresh), F11 (fullscreen toggle), F12 (dev tools)
      if (['F5', 'F11', 'F12'].includes(e.key)) {
        e.preventDefault();
        trackViolation('shortcut_key', `Blocked function key: ${e.key}`);
        return false;
      }
      
      // Block Print Screen
      if (e.key === 'PrintScreen') {
        e.preventDefault();
        trackViolation('shortcut_key', 'Print Screen blocked');
        return false;
      }
    };

    // Block tab/window switching
    const handleVisibilityChange = () => {
      // Ignore during initialization or if not active
      if (!isActive.current || isInitializing.current) return;
      
      if (document.hidden) {
        trackViolation('tab_switch', 'Tab switched or window hidden');
      }
    };

    const handleBlur = () => {
      // Ignore during initialization or if not active
      if (!isActive.current || isInitializing.current) return;
      
      // Only track blur if window actually lost focus (not just internal focus changes)
      // Add delay to avoid false positives from fullscreen request or internal navigation
      setTimeout(() => {
        // Check if window actually lost focus (not just focus moved to another element in same window)
        if (!document.hasFocus() && document.hidden) {
          trackViolation('window_blur', 'Window lost focus');
        }
      }, 500); // Increased delay to avoid false positives
    };

    // Block drag and drop - but only track if it's actually a file/content drop
    const handleDragStart = (e) => {
      // Allow drag within the editor (for text selection)
      const target = e.target;
      if (target && typeof target.closest === 'function') {
        if (target.closest('.monaco-editor') || target.closest('button') || target.closest('input') || target.closest('textarea')) {
          return true; // Allow drag within editor and form elements
        }
      }
      e.preventDefault();
      return false;
    };

    const handleDrop = (e) => {
      // Only track if dropping files or external content
      const target = e.target;
      if (target && typeof target.closest === 'function') {
        // Allow drop in editor and form elements
        if (target.closest('.monaco-editor') || target.closest('input') || target.closest('textarea')) {
          return true;
        }
      }
      
      // Check if it's a file drop
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        e.preventDefault();
        trackViolation('copy_paste', 'File drag and drop attempt');
        return false;
      }
      
      // Allow text drops in editor
      return true;
    };

    // Block text selection - REMOVED as it's too aggressive and causes false positives
    // Normal clicking and UI interactions should not be violations
    // Only actual copy/paste actions are blocked via copy/paste event handlers

    // Only activate if resultId is provided
    if (!resultId) {
      return;
    }

    isActive.current = true;
    initializationTime.current = Date.now();
    isInitializing.current = true;
    
    // End grace period after delay
    setTimeout(() => {
      isInitializing.current = false;
    }, gracePeriod);

    // Add event listeners
    document.addEventListener('copy', handleCopy);
    document.addEventListener('paste', handlePaste);
    document.addEventListener('cut', handleCut);
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
    document.addEventListener('dragstart', handleDragStart);
    document.addEventListener('drop', handleDrop);
    // Removed selectstart listener - too aggressive, causes false positives

    // Fullscreen change listeners
    document.addEventListener('fullscreenchange', checkFullscreen);
    document.addEventListener('webkitfullscreenchange', checkFullscreen);
    document.addEventListener('mozfullscreenchange', checkFullscreen);
    document.addEventListener('MSFullscreenChange', checkFullscreen);

    // Check fullscreen periodically
    violationCheckInterval.current = setInterval(() => {
      checkFullscreen();
      checkMultipleScreens();
    }, 1000);

    // Initial fullscreen check
    checkFullscreen();
    checkMultipleScreens();

    // Request fullscreen on mount
    setTimeout(() => {
      requestFullscreen();
    }, 500);

    return () => {
      document.removeEventListener('copy', handleCopy);
      document.removeEventListener('paste', handlePaste);
      document.removeEventListener('cut', handleCut);
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('dragstart', handleDragStart);
      document.removeEventListener('drop', handleDrop);
      // Clear any pending violation timeouts
      pendingViolations.current.forEach(timeoutId => clearTimeout(timeoutId));
      pendingViolations.current.clear();
      document.removeEventListener('fullscreenchange', checkFullscreen);
      document.removeEventListener('webkitfullscreenchange', checkFullscreen);
      document.removeEventListener('mozfullscreenchange', checkFullscreen);
      document.removeEventListener('MSFullscreenChange', checkFullscreen);
      
      if (violationCheckInterval.current) {
        clearInterval(violationCheckInterval.current);
      }
      
      isActive.current = false;
    };
  }, [resultId, trackViolation, checkFullscreen, checkMultipleScreens, requestFullscreen]);

  // Show warning when violations approach limit
  useEffect(() => {
    if (violations > 0 && violations < MAX_VIOLATIONS && !warningShownFor.current.has(violations)) {
      // Show warning for violations 1 and 2 (when approaching limit)
      if (onViolationWarning) {
        onViolationWarning(violations, MAX_VIOLATIONS);
        warningShownFor.current.add(violations);
      }
    }
  }, [violations, onViolationWarning]);

  return {
    violations,
    isFullscreen,
    requestFullscreen,
    trackViolation
  };
};

