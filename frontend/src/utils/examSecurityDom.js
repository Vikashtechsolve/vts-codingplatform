/**
 * DOM helpers for exam proctoring — which zones may edit/copy/paste internally.
 */

const INTERNAL_ZONE_SELECTORS = [
  '.monaco-editor',
  '.monaco-code-editor-root .monaco-editor',
  '.test-taking-container textarea',
  '.test-taking-container input[type="text"]',
  '.test-taking-container input[type="number"]',
  '.test-taking-container input:not([type])',
  '.english-test-taking textarea',
  '.english-test-taking .ql-editor',
  '.english-test-taking input[type="text"]',
  '.sdt-container textarea',
  '.sdt-container input[type="text"]',
  '.sdt-container input:not([type])',
];

export function isInternalEditableZone(el) {
  if (!el || typeof el.closest !== 'function') return false;

  // Monaco loading/error shell — not an active typing surface.
  if (
    el.closest('.monaco-code-editor-root') &&
    !el.closest('.monaco-editor') &&
    !el.classList?.contains('inputarea')
  ) {
    return false;
  }

  return INTERNAL_ZONE_SELECTORS.some((sel) => el.closest(sel));
}

/** MCQ / aptitude option controls — allow interaction without treating as editable copy zone */
export function isExamChoiceControl(el) {
  if (!el || typeof el.closest !== 'function') return false;
  return Boolean(
    el.closest('.mcq-option') ||
    el.closest('.mcq-options') ||
    el.closest('input[type="radio"]') ||
    el.closest('input[type="checkbox"]')
  );
}

export function isMonacoEditorZone(el) {
  if (!el || typeof el.closest !== 'function') return false;
  return Boolean(el.closest('.monaco-editor'));
}

/** True when Monaco's hidden textarea (or focused editor widget) has focus. */
export function isMonacoEditorFocused() {
  const active = document.activeElement;
  if (!active) return false;
  if (active.classList?.contains('inputarea')) return true;
  if (active.closest?.('.monaco-editor')) return true;
  return Boolean(document.querySelector('.monaco-editor.focused'));
}

export function isActiveElementInInternalZone() {
  return isInternalEditableZone(document.activeElement);
}

/** Whether the event originates from (or focus is in) a code/text editor. */
export function isExamTypingContext(e) {
  return (
    isMonacoEditorFocused() ||
    isInternalEditableZone(e?.target) ||
    isActiveElementInInternalZone()
  );
}

/** IME / composition — never intercept (common on non-English keyboards). */
export function isComposingKeyEvent(e) {
  return Boolean(e?.isComposing || e?.keyCode === 229);
}

const FUNCTION_KEYS = new Set([
  'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12',
  'PrintScreen', 'ContextMenu',
]);

/** Text the user is copying from a focused field / selection. */
export function getCopyTextFromEvent(e) {
  const sel = window.getSelection()?.toString();
  if (sel) return sel;

  const active = document.activeElement;
  if (active && (active.tagName === 'TEXTAREA' || active.tagName === 'INPUT')) {
    const start = active.selectionStart ?? 0;
    const end = active.selectionEnd ?? 0;
    if (end > start) {
      return active.value.substring(start, end);
    }
  }

  try {
    return e.clipboardData?.getData('text/plain') || '';
  } catch {
    return '';
  }
}

/** Paste payload from clipboard event. */
export function getPasteTextFromEvent(e) {
  try {
    return e.clipboardData?.getData('text/plain') || '';
  } catch {
    return '';
  }
}

const EDITOR_META_KEYS = new Set(['c', 'x', 'v', 'a', 'z', 'y']);

/** Productivity shortcuts students often hit by mistake — block only, no violation. */
const SILENT_BLOCK_META_KEYS = new Set([
  'z', // undo
  'y', // redo (Windows)
  'a', // select all
  's', // save
  'f', // find
  'p', // print
  'b', // bold
  'i', // italic
  'u', // underline
  'k', // link
  'd', // bookmark
  '=', // zoom in
  '+',
  '-',
  '0',
]);

/**
 * Allow undo/redo/select/copy/cut/paste shortcuts only inside exam code/text editors.
 */
export function allowsEditorMetaShortcut(e) {
  if (!isInternalEditableZone(e.target) && !isActiveElementInInternalZone()) {
    return false;
  }
  if (!(e.ctrlKey || e.metaKey) || e.altKey) return false;

  const key = e.key?.length === 1 ? e.key.toLowerCase() : e.key;

  if (EDITOR_META_KEYS.has(key)) return true;
  if (key === 'z' && e.shiftKey) return true; // redo
  if (key === 'Backspace' || key === 'Delete') return false; // handled without meta

  return false;
}

/**
 * Common modifier shortcuts (undo, redo, save, etc.) — block the action but do not
 * count as a proctoring violation when pressed accidentally.
 */
export function isSilentBlockMetaShortcut(e) {
  const meta = e.ctrlKey || e.metaKey;
  if (!meta && !e.altKey) return false;

  const key = e.key?.length === 1 ? e.key.toLowerCase() : e.key;

  // Redo variants
  if (meta && key === 'z' && e.shiftKey) return true;
  if (meta && key === 'y' && !e.altKey) return true;

  if (meta && SILENT_BLOCK_META_KEYS.has(key)) return true;

  // Zoom: Ctrl/Cmd + Shift + +/-
  if (meta && e.shiftKey && (key === '+' || key === '=' || key === '-')) return true;

  return false;
}

/**
 * Copy/cut/paste shortcuts outside the editor — handled by clipboard listeners
 * (block + violation). Skip keydown handling so those events still fire.
 */
export function isClipboardShortcut(e) {
  if (!(e.ctrlKey || e.metaKey) || e.altKey) return false;
  const key = e.key?.length === 1 ? e.key.toLowerCase() : e.key;
  return ['c', 'x', 'v'].includes(key);
}

export function isBlockedBrowserShortcut(e) {
  const key = e.key?.length === 1 ? e.key.toLowerCase() : e.key;
  const meta = e.ctrlKey || e.metaKey;
  const shift = e.shiftKey;
  const alt = e.altKey;

  if (['F5', 'F11', 'F12'].includes(e.key)) return `Function key ${e.key}`;
  if (e.key === 'PrintScreen') return 'Print Screen';

  if (meta && shift && ['3', '4', '5', 'i', 'j', 'c', 'k', 's'].includes(key)) {
    return `Shortcut ${e.metaKey ? 'Cmd' : 'Ctrl'}+Shift+${e.key}`;
  }
  if (meta && alt && ['i', 'j', 'c'].includes(key)) return 'Developer tools shortcut';
  if (meta && ['t', 'n', 'w', 'l', 'r', 'h', 'p', 'f', 'g', 'u', 'o', 'j'].includes(key)) {
    return `Browser shortcut ${e.metaKey ? 'Cmd' : 'Ctrl'}+${e.key.toUpperCase()}`;
  }
  if (alt && key === 'Tab') return 'Alt+Tab (task switch)';
  if (alt && key === 'F4') return 'Alt+F4 (close window)';
  if (meta && key === 'Tab') return 'Window switch shortcut';

  return null;
}

/**
 * Copy/cut/paste shortcuts outside the editor — block silently (no violation).
 */
export function shouldSilentlyBlockClipboardShortcut(e) {
  return isClipboardShortcut(e) && !isExamTypingContext(e);
}

/**
 * Allow normal typing inside exam editors without running global shortcut blocking.
 * Fixes plain a/s/d and sticky-Alt (Windows menu bar) swallowing keys in Monaco.
 */
export function shouldAllowTypingInExamContext(e) {
  if (!isExamTypingContext(e)) return false;

  if (isComposingKeyEvent(e)) return true;

  const hasMeta = e.ctrlKey || e.metaKey;
  const key = e.key;

  // Cheating / browser shortcuts — always handled by the block path below.
  if (isBlockedBrowserShortcut(e)) return false;

  // Ctrl/Cmd+Z, copy, paste, select-all inside the editor.
  if (allowsEditorMetaShortcut(e)) return true;

  // Ctrl/Cmd+S, Ctrl/Cmd+P, etc. — block silently even inside the editor.
  if (hasMeta && isSilentBlockMetaShortcut(e)) return false;

  if (hasMeta) return false;

  if (FUNCTION_KEYS.has(key)) return false;

  // Plain typing, Shift+capital, editor navigation keys.
  if (!e.altKey) return true;

  // Sticky Alt after Windows menu / accidental Alt — allow single-character keys in editor.
  if (key?.length === 1) return true;

  return false;
}

export function allowsDragInExam(target) {
  if (!target || typeof target.closest !== 'function') return false;
  return Boolean(
    target.closest('.monaco-editor') ||
    target.closest('button') ||
    target.closest('input') ||
    target.closest('textarea') ||
    target.closest('.arch-workspace') ||
    target.closest('.arch-palette') ||
    target.closest('.react-flow') ||
    target.hasAttribute('draggable')
  );
}
