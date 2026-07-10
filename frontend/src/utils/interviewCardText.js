/**
 * Compact text for interview cards (student + vendor portals).
 * Avoids showing long comma-separated topic lists in full.
 */

export function truncateCardPreview(text, maxLength = 72) {
  if (!text || typeof text !== 'string') return '';
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (!cleaned) return '';
  if (cleaned.length <= maxLength) return cleaned;
  return `${cleaned.slice(0, maxLength).trim()}…`;
}

/** Preview for topic fields that may list many items (comma/semicolon separated). */
export function formatTopicsCardPreview(text, { maxItems = 2, maxLength = 64 } = {}) {
  if (!text || typeof text !== 'string') return '';

  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (!cleaned) return '';

  const parts = cleaned
    .split(/[,;|]/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length <= 1) {
    return truncateCardPreview(cleaned, maxLength);
  }

  const shown = parts.slice(0, maxItems);
  const remaining = parts.length - shown.length;
  let preview = shown.join(', ');
  if (remaining > 0) {
    preview += ` +${remaining} more`;
  }
  return truncateCardPreview(preview, maxLength);
}

/** One-line subtitle for interview cards: type · topic · difficulty */
export function formatInterviewCardSubtitle(interview, { maxTopicLength = 56 } = {}) {
  if (!interview) return '';

  const type = truncateCardPreview(interview.interviewType, 28);
  const topic = formatTopicsCardPreview(interview.topic, { maxItems: 2, maxLength: maxTopicLength });
  const difficulty = truncateCardPreview(interview.difficulty, 20);

  return [type, topic, difficulty].filter(Boolean).join(' · ');
}
