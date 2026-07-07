import {
  isInternalEditableZone,
  shouldAllowTypingInExamContext,
  shouldSilentlyBlockClipboardShortcut,
} from './examSecurityDom';

function mockMonacoTarget() {
  return {
    classList: { contains: () => false },
    closest(sel) {
      if (
        sel === '.monaco-editor' ||
        sel === '.monaco-code-editor-root .monaco-editor' ||
        sel === '.test-taking-container textarea'
      ) {
        return {};
      }
      return null;
    },
  };
}

function keyEvent(overrides = {}) {
  return {
    key: 'a',
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    isComposing: false,
    keyCode: 0,
    target: mockMonacoTarget(),
    ...overrides,
  };
}

describe('shouldAllowTypingInExamContext', () => {
  it('allows plain a, s, d in the code editor', () => {
    expect(shouldAllowTypingInExamContext(keyEvent({ key: 'a' }))).toBe(true);
    expect(shouldAllowTypingInExamContext(keyEvent({ key: 's' }))).toBe(true);
    expect(shouldAllowTypingInExamContext(keyEvent({ key: 'd' }))).toBe(true);
  });

  it('allows sticky Alt + letter in the code editor', () => {
    expect(shouldAllowTypingInExamContext(keyEvent({ key: 'a', altKey: true }))).toBe(true);
    expect(shouldAllowTypingInExamContext(keyEvent({ key: 's', altKey: true }))).toBe(true);
    expect(shouldAllowTypingInExamContext(keyEvent({ key: 'd', altKey: true }))).toBe(true);
  });

  it('allows IME composition events in the code editor', () => {
    expect(shouldAllowTypingInExamContext(keyEvent({ isComposing: true, key: 'Process' }))).toBe(
      true
    );
  });

  it('allows Ctrl+Z inside the editor', () => {
    expect(
      shouldAllowTypingInExamContext(keyEvent({ key: 'z', ctrlKey: true }))
    ).toBe(true);
  });

  it('blocks Ctrl+S inside the editor without treating as typing', () => {
    expect(
      shouldAllowTypingInExamContext(keyEvent({ key: 's', ctrlKey: true }))
    ).toBe(false);
  });

  it('blocks Ctrl+T inside the editor', () => {
    expect(
      shouldAllowTypingInExamContext(keyEvent({ key: 't', ctrlKey: true }))
    ).toBe(false);
  });

  it('blocks Alt+Tab even inside the editor', () => {
    expect(
      shouldAllowTypingInExamContext(keyEvent({ key: 'Tab', altKey: true }))
    ).toBe(false);
  });

  it('does not allow plain letters outside the editor', () => {
    const outside = { closest: () => null, classList: { contains: () => false } };
    expect(
      shouldAllowTypingInExamContext(keyEvent({ key: 'a', target: outside }))
    ).toBe(false);
  });
});

describe('shouldSilentlyBlockClipboardShortcut', () => {
  it('blocks Ctrl+C outside the editor without needing a violation path', () => {
    const outside = { closest: () => null, classList: { contains: () => false } };
    expect(
      shouldSilentlyBlockClipboardShortcut(
        keyEvent({ key: 'c', ctrlKey: true, target: outside })
      )
    ).toBe(true);
  });

  it('allows Ctrl+C inside the code editor', () => {
    expect(
      shouldSilentlyBlockClipboardShortcut(keyEvent({ key: 'c', ctrlKey: true }))
    ).toBe(false);
  });
});

describe('isInternalEditableZone', () => {
  it('does not treat Monaco loading shell as an editable zone', () => {
    const loadingShell = {
      classList: { contains: () => false },
      closest(sel) {
        if (sel === '.monaco-code-editor-root') return {};
        return null;
      },
    };
    expect(isInternalEditableZone(loadingShell)).toBe(false);
  });
});
