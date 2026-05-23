/** In-exam clipboard: copy/cut/paste only within code & answer editors. */

const MAX_INTERNAL_AGE_MS = 120000;

let internalClip = null;

export function resetExamClipboard() {
  internalClip = null;
}

export function recordInternalCopy(text) {
  const normalized = typeof text === 'string' ? text : '';
  if (!normalized) return;
  internalClip = { text: normalized, ts: Date.now() };
}

export function allowsInternalPaste(pasteText) {
  if (!internalClip) return false;
  if (Date.now() - internalClip.ts > MAX_INTERNAL_AGE_MS) {
    internalClip = null;
    return false;
  }
  const pasted = typeof pasteText === 'string' ? pasteText : '';
  return pasted === internalClip.text;
}
