import React, { useCallback, useEffect, useRef } from 'react';
import Editor, { loader } from '@monaco-editor/react';
import { useTheme } from '../context/ThemeContext';
import { monacoThemeForApp, setupMonacoThemes } from '../utils/monacoThemes';
import './MonacoCodeEditor.css';

const DEFAULT_OPTIONS = {
  minimap: { enabled: false },
  fontSize: 14,
  wordWrap: 'on',
  lineNumbers: 'on',
  scrollBeyondLastLine: false,
  automaticLayout: true,
  tabSize: 2,
  'bracketPairColorization.enabled': true,
};

let themesRegistered = false;

const ensureThemes = (monaco) => {
  if (themesRegistered) return;
  setupMonacoThemes(monaco);
  themesRegistered = true;
};

/**
 * Monaco wrapper — custom themes + no CSS overrides on token spans (mtk*).
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
}) => {
  const { isDark } = useTheme();
  const editorRef = useRef(null);
  const monacoRef = useRef(null);
  const themeName = monacoThemeForApp(isDark);

  const handleBeforeMount = useCallback((monaco) => {
    monacoRef.current = monaco;
    ensureThemes(monaco);
    monaco.editor.setTheme(themeName);
  }, [themeName]);

  const handleMount = useCallback((editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    ensureThemes(monaco);
    monaco.editor.setTheme(themeName);
  }, [themeName]);

  useEffect(() => {
    const monaco = monacoRef.current;
    if (!monaco) {
      loader.init().then((m) => {
        monacoRef.current = m;
        ensureThemes(m);
        m.editor.setTheme(themeName);
      });
      return;
    }
    ensureThemes(monaco);
    monaco.editor.setTheme(themeName);
  }, [themeName]);

  const containerHeight = typeof height === 'number' ? `${height}px` : height;

  return (
    <div
      className={`monaco-code-editor-root ${isDark ? 'monaco-code-editor-root--dark' : 'monaco-code-editor-root--light'} ${className}`.trim()}
      style={{ height: containerHeight }}
    >
      <Editor
        key={editorKey}
        height={height}
        language={language}
        value={value ?? ''}
        onChange={onChange}
        theme={themeName}
        beforeMount={handleBeforeMount}
        onMount={handleMount}
        options={{
          ...DEFAULT_OPTIONS,
          readOnly,
          ...options,
        }}
      />
    </div>
  );
};

export default MonacoCodeEditor;
