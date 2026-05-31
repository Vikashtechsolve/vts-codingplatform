const QuestionTag = require('../models/QuestionTag');

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const normalizeTagList = (tags) => {
  if (!Array.isArray(tags)) return [];
  const seen = new Set();
  const result = [];
  tags.forEach((raw) => {
    const label = String(raw || '').trim().replace(/\s+/g, ' ');
    if (!label) return;
    const slug = label.toLowerCase();
    if (seen.has(slug)) return;
    seen.add(slug);
    result.push({ slug, label });
  });
  return result;
};

const upsertQuestionTag = async (vendorId, { slug, label }, userId, { bumpUsage = false } = {}) => {
  const filter = { vendorId: vendorId ?? null, slug };
  const setFields = {
    label,
    lastUsedAt: new Date(),
    ...(userId ? { createdBy: userId } : {})
  };

  const existing = await QuestionTag.findOne(filter).select('_id');
  if (existing) {
    const update = { $set: setFields };
    if (bumpUsage) update.$inc = { usageCount: 1 };
    await QuestionTag.updateOne(filter, update);
    return;
  }

  try {
    await QuestionTag.create({
      vendorId: vendorId ?? null,
      slug,
      label,
      usageCount: 1,
      lastUsedAt: new Date(),
      ...(userId ? { createdBy: userId } : {})
    });
  } catch (err) {
    if (err.code !== 11000) throw err;
    const update = { $set: setFields };
    if (bumpUsage) update.$inc = { usageCount: 1 };
    await QuestionTag.updateOne(filter, update);
  }
};

/** Ensure tags exist in registry without inflating usage on every question edit. */
const ensureQuestionTags = async (vendorId, tags, userId) => {
  const normalized = normalizeTagList(tags);
  if (normalized.length === 0) return;

  await Promise.all(
    normalized.map((entry) => upsertQuestionTag(vendorId, entry, userId, { bumpUsage: false }))
  );
};

/** Register tags and bump usage (e.g. when user explicitly adds a tag chip). */
const registerQuestionTags = async (vendorId, tags, userId) => {
  const normalized = normalizeTagList(tags);
  if (normalized.length === 0) return;

  await Promise.all(
    normalized.map((entry) => upsertQuestionTag(vendorId, entry, userId, { bumpUsage: true }))
  );
};

/** Normalize tag strings and return canonical labels from the vendor registry. */
const resolveTagsForSave = async (vendorId, tags, userId) => {
  const normalized = normalizeTagList(tags);
  if (normalized.length === 0) return [];

  await ensureQuestionTags(
    vendorId,
    normalized.map((t) => t.label),
    userId
  );

  const slugs = normalized.map((t) => t.slug);
  const docs = await QuestionTag.find({
    vendorId: vendorId ?? null,
    slug: { $in: slugs }
  }).select('label slug');

  const bySlug = Object.fromEntries(docs.map((d) => [d.slug, d.label]));
  return normalized.map((t) => bySlug[t.slug] || t.label);
};

const searchQuestionTags = async (vendorId, query = '', limit = 12) => {
  const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 12, 1), 50);
  const trimmed = String(query || '').trim();
  const filter = { vendorId: vendorId ?? null };

  if (trimmed) {
    const pattern = escapeRegex(trimmed);
    filter.$or = [
      { slug: new RegExp(pattern, 'i') },
      { label: new RegExp(pattern, 'i') }
    ];
  }

  const tags = await QuestionTag.find(filter)
    .sort({ usageCount: -1, lastUsedAt: -1, label: 1 })
    .limit(safeLimit)
    .select('label slug usageCount');

  return tags.map((t) => ({
    label: t.label,
    slug: t.slug,
    usageCount: t.usageCount
  }));
};

const attachTagRegistration = (schema) => {
  schema.post('save', async function postSaveTags() {
    if (!Array.isArray(this.tags) || this.tags.length === 0) return;
    try {
      await ensureQuestionTags(this.vendorId ?? null, this.tags, this.createdBy);
    } catch (error) {
      console.error('Failed to register question tags:', error.message);
    }
  });
};

const tagSlug = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');

module.exports = {
  normalizeTagList,
  ensureQuestionTags,
  registerQuestionTags,
  resolveTagsForSave,
  searchQuestionTags,
  attachTagRegistration,
  tagSlug
};
