/** True when Quill/HTML content has no meaningful text */
export function isRichTextEmpty(html) {
  if (!html || typeof html !== 'string') return true;
  const stripped = html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return stripped.length === 0;
}

/** True when content already contains HTML tags (not entity-encoded). */
export function looksLikeHtml(content) {
  if (!content || typeof content !== 'string') return false;
  return /<[a-z][\s\S]*>/i.test(content.trim());
}

export function escapeHtml(text) {
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const BULLET_LINE_RE = /^\s*(?:[-*•]|\d+[.)])\s+/;

/** True when plain text has newlines or list-like lines that need structure. */
export function plainTextNeedsStructure(text) {
  if (!text || typeof text !== 'string') return false;
  if (/\r?\n/.test(text)) return true;
  return text
    .split(/\r?\n/)
    .filter((l) => l.trim())
    .some((l) => BULLET_LINE_RE.test(l));
}

/**
 * Convert legacy plain-text (e.g. constraints) into safe HTML.
 * Multi-line bullet/number lists become <ul>/<ol>; other lines become <p>.
 */
export function plainTextToRichHtml(text) {
  if (!text || typeof text !== 'string') return '';
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const nonEmpty = lines.filter((l) => l.trim().length > 0);
  if (nonEmpty.length === 0) return '';

  const allBullets = nonEmpty.every((l) => BULLET_LINE_RE.test(l));
  if (allBullets) {
    const ordered = /^\s*\d+[.)]/.test(nonEmpty[0]);
    const items = nonEmpty
      .map((l) => `<li>${escapeHtml(l.replace(BULLET_LINE_RE, ''))}</li>`)
      .join('');
    return ordered ? `<ol>${items}</ol>` : `<ul>${items}</ul>`;
  }

  // Mixed / free-form: keep line breaks; turn obvious bullet lines into list items inline
  const parts = [];
  let listBuf = [];
  let listOrdered = null;

  const flushList = () => {
    if (!listBuf.length) return;
    const tag = listOrdered ? 'ol' : 'ul';
    parts.push(`<${tag}>${listBuf.join('')}</${tag}>`);
    listBuf = [];
    listOrdered = null;
  };

  lines.forEach((raw) => {
    const line = raw.trimEnd();
    if (!line.trim()) {
      flushList();
      return;
    }
    if (BULLET_LINE_RE.test(line)) {
      const ordered = /^\s*\d+[.)]/.test(line);
      if (listBuf.length && listOrdered !== ordered) flushList();
      listOrdered = ordered;
      listBuf.push(`<li>${escapeHtml(line.replace(BULLET_LINE_RE, ''))}</li>`);
      return;
    }
    flushList();
    parts.push(`<p>${escapeHtml(line)}</p>`);
  });
  flushList();
  return parts.join('') || `<p>${escapeHtml(text)}</p>`;
}

/**
 * For editors (Quill): leave HTML alone; convert any plain text to safe HTML.
 * Always wraps structure so the editor shows lists/newlines correctly.
 */
export function ensureRichHtml(content) {
  if (!content || typeof content !== 'string') return '';
  if (looksLikeHtml(content)) return content;
  return plainTextToRichHtml(content);
}

/**
 * For display only: structured plain → HTML; single-line plain → escape only
 * (no <p> wrapper — avoids spacing regressions in MCQ options etc.).
 */
export function normalizePlainForDisplay(content) {
  if (!content || typeof content !== 'string') return '';
  if (looksLikeHtml(content)) return content;
  if (plainTextNeedsStructure(content)) return plainTextToRichHtml(content);
  return escapeHtml(content);
}
