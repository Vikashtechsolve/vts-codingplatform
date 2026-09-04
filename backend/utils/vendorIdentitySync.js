const Vendor = require('../models/Vendor');
const User = require('../models/User');

function normalizeName(value) {
  if (value == null) return null;
  const trimmed = String(value).trim();
  return trimmed || null;
}

function normalizeEmail(value) {
  if (value == null) return null;
  const trimmed = String(value).toLowerCase().trim();
  return trimmed || null;
}

/** Prefer profile fields when super admin sends both profile + admin values. */
function resolveContactName(name, adminName) {
  return normalizeName(name) || normalizeName(adminName);
}

function resolveContactEmail(email, adminEmail) {
  return normalizeEmail(email) || normalizeEmail(adminEmail);
}

async function assertEmailAvailable(email, { vendorId, userId }) {
  if (!email) return;

  const vendorTaken = await Vendor.findOne({
    email,
    _id: { $ne: vendorId },
  }).select('_id');
  if (vendorTaken) {
    const err = new Error('Another vendor already uses this email');
    err.status = 400;
    throw err;
  }

  if (userId) {
    const userTaken = await User.findOne({
      email,
      _id: { $ne: userId },
    }).select('_id');
    if (userTaken) {
      const err = new Error('Another user already uses this email');
      err.status = 400;
      throw err;
    }
  }
}

/**
 * Keep vendor profile + vendor_admin user identity aligned (name + email).
 */
function applyContactIdentity(vendor, adminUser, { name, adminName, email, adminEmail }) {
  const contactName = resolveContactName(name, adminName);
  const contactEmail = resolveContactEmail(email, adminEmail);

  if (contactName) {
    vendor.name = contactName;
    if (adminUser) adminUser.name = contactName;
  }

  if (contactEmail) {
    vendor.email = contactEmail;
    if (adminUser) adminUser.email = contactEmail;
  }

  return { contactName, contactEmail };
}

module.exports = {
  normalizeName,
  normalizeEmail,
  resolveContactName,
  resolveContactEmail,
  assertEmailAvailable,
  applyContactIdentity,
};
