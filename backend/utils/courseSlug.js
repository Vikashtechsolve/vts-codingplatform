function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'course';
}

async function uniqueCourseSlug(Course, baseTitle, excludeId = null) {
  const base = slugify(baseTitle);
  let slug = base;
  let n = 2;
  for (;;) {
    const query = { slug };
    if (excludeId) query._id = { $ne: excludeId };
    const exists = await Course.exists(query);
    if (!exists) return slug;
    slug = `${base}-${n}`;
    n += 1;
  }
}

module.exports = { slugify, uniqueCourseSlug };
