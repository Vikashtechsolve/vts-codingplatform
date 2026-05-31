export const tagSlug = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');

export const normalizeTags = (tags) => {
  if (!Array.isArray(tags)) return [];
  const seen = new Set();
  const result = [];
  tags.forEach((raw) => {
    const label = String(raw || '').trim().replace(/\s+/g, ' ');
    if (!label) return;
    const slug = tagSlug(label);
    if (seen.has(slug)) return;
    seen.add(slug);
    result.push(label);
  });
  return result;
};

/** @deprecated Use TagInput instead of comma-separated text */
export const parseTagsInput = (value) => {
  if (!value) return [];
  return normalizeTags(value.split(','));
};

/** @deprecated Use TagInput instead of comma-separated text */
export const tagsToInputValue = (tags) => normalizeTags(tags).join(', ');

export const questionHasTag = (question, selectedSlug) => {
  if (!selectedSlug) return true;
  const needle = tagSlug(selectedSlug);
  return (question?.tags || []).some((tag) => tagSlug(tag) === needle);
};

export const questionMatchesSearch = (question, term, textFields = []) => {
  const q = String(term || '').trim().toLowerCase();
  if (!q) return true;

  const textMatch = textFields
    .filter(Boolean)
    .some((field) => String(field).toLowerCase().includes(q));

  const tagMatch = (question?.tags || []).some(
    (tag) =>
      String(tag).toLowerCase().includes(q) || tagSlug(tag).includes(q)
  );

  return textMatch || tagMatch;
};

export const filterQuestionsBySearchAndTag = (
  questions,
  { term = '', selectedTag = '', textFieldsFor = () => [] } = {}
) =>
  (questions || []).filter((item) => {
    if (!questionHasTag(item, selectedTag)) return false;
    return questionMatchesSearch(item, term, textFieldsFor(item));
  });

/** Merge registry entries with labels seen on questions; dedupe by slug. */
export const buildTagFilterOptions = (registryTags = [], questionLabels = []) => {
  const bySlug = new Map();

  registryTags.forEach((entry) => {
    const slug = entry?.slug || tagSlug(entry?.label);
    const label = entry?.label || entry;
    if (!slug) return;
    bySlug.set(slug, { slug, label: String(label).trim() });
  });

  questionLabels.forEach((raw) => {
    const label = String(raw || '').trim();
    const slug = tagSlug(label);
    if (!slug) return;
    if (!bySlug.has(slug)) {
      bySlug.set(slug, { slug, label });
    }
  });

  return [...bySlug.values()].sort((a, b) =>
    a.label.localeCompare(b.label, undefined, { sensitivity: 'base' })
  );
};
