import React from 'react';
import DOMPurify from 'dompurify';
import './RichTextDisplay.css';

const ALLOWED_TAGS = [
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'p', 'br', 'span', 'div',
  'strong', 'b', 'em', 'i', 'u', 's', 'strike',
  'ul', 'ol', 'li',
  'a', 'blockquote', 'pre', 'code',
  'img',
  'iframe',
];

const ALLOWED_ATTR = ['href', 'target', 'rel', 'class', 'src', 'alt', 'title', 'width', 'height', 'style', 'frameborder', 'allowfullscreen'];

/**
 * Strip HTML tags and return plain text.
 * Use for truncated previews.
 */
export const stripHtml = (html) => {
  if (!html || typeof html !== 'string') return '';
  if (typeof document === 'undefined') {
    return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  }
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || '';
};

/**
 * Truncate content (HTML or plain) to maxLength chars for previews.
 */
export const truncateForPreview = (content, maxLength = 150) => {
  const text = content && content.includes('<') ? stripHtml(content) : (content || '');
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength).trim() + '...';
};

/** Single-line friendly preview for list rows (strips tags, collapses whitespace). */
export const htmlToListPreview = (content) => {
  if (!content || typeof content !== 'string') return '';
  const text = content.includes('<') ? stripHtml(content) : content;
  return text.replace(/\s+/g, ' ').trim();
};

/** Decode entity-encoded HTML (e.g. &lt;p&gt;) saved or transported as plain text. */
const normalizeHtmlContent = (html) => {
  if (!html || typeof html !== 'string') return '';
  const trimmed = html.trim();
  if (
    trimmed.includes('&lt;') &&
    trimmed.includes('&gt;') &&
    !/<[a-z][\s\S]*>/i.test(trimmed)
  ) {
    if (typeof document === 'undefined') {
      return trimmed
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
    }
    const textarea = document.createElement('textarea');
    textarea.innerHTML = trimmed;
    return textarea.value;
  }
  return html;
};

const RichTextDisplay = ({
  content = '',
  className = '',
  asPlainText = false,
  truncate = 0
}) => {
  const normalized = normalizeHtmlContent(content);
  if (!normalized || typeof normalized !== 'string') {
    return null;
  }

  if (asPlainText || truncate > 0) {
    const text = truncate > 0 ? truncateForPreview(normalized, truncate) : stripHtml(normalized);
    return <span className={`rich-text-display plain ${className}`}>{text}</span>;
  }

  const sanitized = DOMPurify.sanitize(normalized, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ADD_ATTR: ['target'],
    FORBID_ATTR: ['style']
  });

  return (
    <div
      className={`rich-text-display ${className}`}
      dangerouslySetInnerHTML={{ __html: sanitized }}
    />
  );
};

export default RichTextDisplay;
