const express = require('express');
const router = express.Router();
const { auth, authorize } = require('../middleware/auth');
const tenantMiddleware = require('../middleware/tenant');
const {
  registerQuestionTags,
  searchQuestionTags,
  normalizeTagList,
  tagSlug
} = require('../utils/questionTags');

router.use(auth);
router.use(authorize('vendor_admin', 'super_admin'));
router.use(tenantMiddleware);

/** Autocomplete / list tags for this vendor (shared across all question types). */
router.get('/', async (req, res) => {
  try {
    const tags = await searchQuestionTags(req.vendorId, req.query.q, req.query.limit);
    res.json(tags);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/** Register one or more tags immediately (e.g. when user adds a chip before save). */
router.post('/', async (req, res) => {
  try {
    const raw = req.body.tags ?? req.body.label ?? req.body.tag;
    const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
    const normalized = normalizeTagList(list);
    if (normalized.length === 0) {
      return res.status(400).json({ message: 'At least one tag is required' });
    }

    await registerQuestionTags(req.vendorId, normalized.map((t) => t.label), req.user._id);

    const slugs = normalized.map((t) => t.slug);
    const QuestionTag = require('../models/QuestionTag');
    const docs = await QuestionTag.find({
      vendorId: req.vendorId ?? null,
      slug: { $in: slugs }
    }).select('label slug usageCount');

    const bySlug = Object.fromEntries(docs.map((d) => [d.slug, d]));
    const result = normalized.map((t) => ({
      label: bySlug[t.slug]?.label || t.label,
      slug: t.slug,
      usageCount: bySlug[t.slug]?.usageCount || 1
    }));

    res.status(201).json(result);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
module.exports.tagSlug = tagSlug;
