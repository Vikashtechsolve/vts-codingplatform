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
