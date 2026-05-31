import React from 'react';
import { FiCode, FiPlay, FiLayers } from 'react-icons/fi';
import MonacoCodeEditor from '../MonacoCodeEditor';

const LANG_META = {
  python: { label: 'Python', monaco: 'python' },
  java: { label: 'Java', monaco: 'java' },
  cpp: { label: 'C++', monaco: 'cpp' },
  c: { label: 'C', monaco: 'c' },
  javascript: { label: 'JavaScript', monaco: 'javascript' },
  js: { label: 'JavaScript', monaco: 'javascript' },
  node: { label: 'JavaScript', monaco: 'javascript' },
  nodejs: { label: 'JavaScript', monaco: 'javascript' },
};

const CodingQuestionCodeWorkspace = ({
  allowedLanguages = [],
  activeLang,
  onActiveLangChange,
  starterCode = {},
  testCode = {},
  onStarterChange,
  onTestCodeChange,
  onCopyStarterToSolution,
  onRunAllTests,
  isTestingAll,
  canRunTests,
}) => {
  const langs = Array.from(
    new Set([
      ...(allowedLanguages || []),
      ...Object.keys(starterCode || {}).filter((k) => String(starterCode[k] || '').trim()),
      ...Object.keys(testCode || {}).filter((k) => String(testCode[k] || '').trim()),
    ])
  );
  const meta = LANG_META[activeLang] || {
    label: String(activeLang || 'Language').toUpperCase(),
    monaco: activeLang || 'plaintext',
  };

  if (langs.length === 0) {
    return (
      <div className="cq-code-empty">
        <FiLayers size={28} />
        <p>Select at least one allowed language above to write starter and solution code.</p>
      </div>
    );
  }

  return (
    <div className="cq-code-workspace">
      <div className="cq-code-toolbar">
        <div className="cq-lang-tabs" role="tablist" aria-label="Programming language">
          {langs.map((lang) => (
            <button
              key={lang}
              type="button"
              role="tab"
              aria-selected={activeLang === lang}
              className={`cq-lang-tab ${activeLang === lang ? 'active' : ''}`}
              onClick={() => onActiveLangChange(lang)}
            >
              {(LANG_META[lang]?.label) || String(lang).toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="cq-editor-stack">
        <section className="cq-editor-card">
          <header className="cq-editor-card-head">
            <span className="cq-editor-badge is-starter">
              <FiCode aria-hidden /> Starter template
            </span>
            <span className="cq-editor-head-note">Visible to students when they start the problem.</span>
          </header>
          <div className="cq-editor-card-body">
            <MonacoCodeEditor
              height="320px"
              editorKey={`cq-starter-${activeLang}`}
              language={meta.monaco}
              value={starterCode[activeLang] || ''}
              onChange={(value) => onStarterChange(activeLang, value || '')}
              className="cq-monaco"
            />
          </div>
        </section>

        <section className="cq-editor-card">
          <header className="cq-editor-card-head">
            <span className="cq-editor-badge is-solution">
              <FiPlay aria-hidden /> Solution code
            </span>
            <span className="cq-editor-head-note">Private evaluator code used to validate test cases.</span>
          </header>
          <div className="cq-editor-card-body">
            <MonacoCodeEditor
              height="320px"
              editorKey={`cq-solution-${activeLang}`}
              language={meta.monaco}
              value={testCode[activeLang] || ''}
              onChange={(value) => onTestCodeChange(activeLang, value || '')}
              className="cq-monaco"
            />
          </div>
          <footer className="cq-editor-card-foot">
            {!String(testCode[activeLang] || '').trim() && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => onCopyStarterToSolution(activeLang)}
              >
                Copy starter to solution
              </button>
            )}
            <button
              type="button"
              className="btn btn-primary cq-run-btn"
              onClick={onRunAllTests}
              disabled={isTestingAll || !canRunTests}
            >
              <FiPlay aria-hidden />
              {isTestingAll ? 'Running all test cases…' : 'Run all test cases'}
            </button>
          </footer>
        </section>
      </div>
    </div>
  );
};

export default CodingQuestionCodeWorkspace;
