import { loader } from '@monaco-editor/react';

const PUBLIC_URL = (process.env.PUBLIC_URL || '').replace(/\/$/, '');

/** Same-origin path served from public/monaco/vs (see scripts/copy-monaco-assets.js). */
export const MONACO_VS_PATH = `${PUBLIC_URL}/monaco/vs`;

/** Max wait on slow connections before showing retry UI. */
const INIT_TIMEOUT_MS = 90000;

let configured = false;
/** @type {Promise<import('monaco-editor')> | null} */
let initPromise = null;

export function configureMonacoLoader() {
  if (configured) return;
  configured = true;
  loader.config({
    paths: {
      vs: MONACO_VS_PATH,
    },
  });
}

function loadWithTimeout() {
  configureMonacoLoader();
  const init = loader.init();
  const timeout = new Promise((_, reject) => {
    window.setTimeout(() => {
      reject(
        new Error(
          'Code editor took too long to load. Please check your connection and tap Retry.'
        )
      );
    }, INIT_TIMEOUT_MS);
  });
  return Promise.race([init, timeout]);
}

/**
 * Warm Monaco once (shared across all editor instances on the page).
 * Safe to call multiple times.
 */
export function preloadMonacoEditor() {
  if (!initPromise) {
    initPromise = loadWithTimeout().catch((err) => {
      initPromise = null;
      throw err;
    });
  }
  return initPromise;
}

/** Force a fresh load after a failure. */
export function retryMonacoEditor() {
  initPromise = null;
  return preloadMonacoEditor();
}

/** Lighter editor defaults for timed exams (less RAM / CPU on low-end laptops). */
export const EXAM_MONACO_OPTIONS = {
  minimap: { enabled: false },
  fontSize: 14,
  wordWrap: 'on',
  lineNumbers: 'on',
  scrollBeyondLastLine: false,
  automaticLayout: true,
  tabSize: 2,
  'bracketPairColorization.enabled': true,
  quickSuggestions: false,
  suggestOnTriggerCharacters: false,
  wordBasedSuggestions: 'off',
  parameterHints: { enabled: false },
  occurrencesHighlight: 'off',
  selectionHighlight: false,
  codeLens: false,
  smoothScrolling: false,
  cursorSmoothCaretAnimation: 'off',
  renderWhitespace: 'none',
  padding: { top: 8 },
};

configureMonacoLoader();
