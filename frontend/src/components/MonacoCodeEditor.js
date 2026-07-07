import React, { useCallback, useEffect, useRef, useState } from 'react';
import Editor from '@monaco-editor/react';
import { useTheme } from '../context/ThemeContext';
import { monacoThemeForApp, setupMonacoThemes } from '../utils/monacoThemes';
import {
  EXAM_MONACO_OPTIONS,
  preloadMonacoEditor,
  retryMonacoEditor,
} from '../utils/monacoLoader';
import './MonacoCodeEditor.css';

let themesRegistered = false;

const ensureThemes = (monaco) => {
  if (themesRegistered) return;
  setupMonacoThemes(monaco);
  themesRegistered = true;
};

const MonacoEditorStatus = ({ variant, message, onRetry, retrying }) => (
  <div className={`monaco-code-editor-status monaco-code-editor-status--${variant}`} role="status">
    {variant === 'loading' && <div className="monaco-code-editor-spinner" aria-hidden />}
    <p className="monaco-code-editor-status-title">
      {variant === 'loading' ? 'Loading code editor…' : 'Code editor could not load'}
    </p>
    {message && <p className="monaco-code-editor-status-detail">{message}</p>}
    {variant === 'error' && onRetry && (
      <button
        type="button"
        className="monaco-code-editor-retry-btn"
        onClick={onRetry}
        disabled={retrying}
      >
        {retrying ? 'Retrying…' : 'Retry'}
      </button>
    )}
    {variant === 'loading' && (
      <p className="monaco-code-editor-status-hint">
        First load may take a moment on slow networks. Please stay on this tab.
      </p>
    )}
  </div>
);

/**
 * Monaco wrapper — self-hosted assets, loading/error UI, exam-friendly defaults.
 */
const MonacoCodeEditor = ({
  height = '100%',
  language = 'python',
  value,
  onChange,
  readOnly = false,
  editorKey,
  className = '',
  options = {},
  examMode = false,
}) => {
  const { isDark } = useTheme();
  const editorRef = useRef(null);
  const monacoRef = useRef(null);
  const themeName = monacoThemeForApp(isDark);

  const [loadState, setLoadState] = useState('loading');
  const [loadError, setLoadError] = useState('');
  const [retrying, setRetrying] = useState(false);

  const runPreload = useCallback((isRetry = false) => {
    setLoadState('loading');
    setLoadError('');
    const promise = isRetry ? retryMonacoEditor() : preloadMonacoEditor();
    return promise
      .then((monaco) => {
        monacoRef.current = monaco;
        ensureThemes(monaco);
        monaco.editor.setTheme(themeName);
        setLoadState('ready');
      })
      .catch((err) => {
        setLoadState('error');
        setLoadError(err?.message || 'Failed to load the code editor.');
      });
  }, [themeName]);

  useEffect(() => {
    let cancelled = false;
    preloadMonacoEditor()
      .then((monaco) => {
        if (cancelled) return;
        monacoRef.current = monaco;
        ensureThemes(monaco);
        monaco.editor.setTheme(themeName);
        setLoadState('ready');
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadState('error');
        setLoadError(err?.message || 'Failed to load the code editor.');
      });
    return () => {
      cancelled = true;
    };
  }, [themeName]);

  const handleRetry = () => {
    setRetrying(true);
    runPreload(true).finally(() => setRetrying(false));
  };

  const handleBeforeMount = useCallback(
    (monaco) => {
      monacoRef.current = monaco;
      ensureThemes(monaco);
      monaco.editor.setTheme(themeName);
    },
    [themeName]
  );

  const handleMount = useCallback(
    (editor, monaco) => {
      editorRef.current = editor;
      monacoRef.current = monaco;
      ensureThemes(monaco);
      monaco.editor.setTheme(themeName);
      requestAnimationFrame(() => {
        editor.layout();
        if (examMode && !readOnly) {
          editor.focus();
        }
      });
    },
    [themeName, examMode, readOnly]
  );

  useEffect(() => {
    const monaco = monacoRef.current;
    if (!monaco || loadState !== 'ready') return;
    ensureThemes(monaco);
    monaco.editor.setTheme(themeName);
  }, [themeName, loadState]);

  const containerHeight = typeof height === 'number' ? `${height}px` : height;
  const mergedOptions = {
    ...(examMode ? EXAM_MONACO_OPTIONS : {}),
    ...options,
    readOnly,
  };

  return (
    <div
      className={`monaco-code-editor-root ${isDark ? 'monaco-code-editor-root--dark' : 'monaco-code-editor-root--light'} ${className}`.trim()}
      style={{ height: containerHeight, minHeight: containerHeight === '100%' ? 200 : undefined }}
    >
      {loadState === 'loading' && (
        <MonacoEditorStatus variant="loading" />
      )}
      {loadState === 'error' && (
        <MonacoEditorStatus
          variant="error"
          message={loadError}
          onRetry={handleRetry}
          retrying={retrying}
        />
      )}
      {loadState === 'ready' && (
        <Editor
          key={editorKey}
          height={height}
          language={language}
          value={value ?? ''}
          onChange={onChange}
          theme={themeName}
          beforeMount={handleBeforeMount}
          onMount={handleMount}
          loading={<MonacoEditorStatus variant="loading" />}
          options={mergedOptions}
        />
      )}
    </div>
  );
};

export default MonacoCodeEditor;
