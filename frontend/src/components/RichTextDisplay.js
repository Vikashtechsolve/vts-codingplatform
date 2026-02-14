import React from 'react';
import DOMPurify from 'dompurify';
import './RichTextDisplay.css';

const ALLOWED_TAGS = [
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'p', 'br', 'span', 'div',
  'strong', 'b', 'em', 'i', 'u', 's', 'strike',
  'ul', 'ol', 'li',
  'a', 'blockquote', 'pre', 'code'
];

const ALLOWED_ATTR = ['href', 'target', 'rel'];

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

const RichTextDisplay = ({
  content = '',
  className = '',
  asPlainText = false,
  truncate = 0
}) => {
  if (!content || typeof content !== 'string') {
    return null;
  }

  if (asPlainText || truncate > 0) {
    const text = truncate > 0 ? truncateForPreview(content, truncate) : stripHtml(content);
    return <span className={`rich-text-display plain ${className}`}>{text}</span>;
  }

  const sanitized = DOMPurify.sanitize(content, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ADD_ATTR: ['target']
  });

  return (
    <div
      className={`rich-text-display ${className}`}
      dangerouslySetInnerHTML={{ __html: sanitized }}
    />
  );
};

export default RichTextDisplay;
