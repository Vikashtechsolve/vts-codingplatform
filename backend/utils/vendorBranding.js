const mongoose = require('mongoose');
const Vendor = require('../models/Vendor');
const User = require('../models/User');
const Classroom = require('../models/Classroom');
const Test = require('../models/Test');

const getVendorIdFromUser = (user) => {
  if (!user?.vendorId) return null;
  const v = user.vendorId;
  if (v == null) return null;
  if (typeof v === 'object') {
    if (v._id) return String(v._id);
    if (typeof v.toHexString === 'function') return v.toHexString();
  }
  const s = String(v).trim();
  if (!s || s === '[object Object]' || s === 'null' || s === 'undefined') return null;
  return s;
};

const formatBrandingPayload = (vendor) => {
  if (!vendor) return null;
  const settings = vendor.settings?.toObject?.() || vendor.settings || {};
  return {
    logo: vendor.logo || null,
    companyName: vendor.companyName || null,
    settings: {
      primaryColor: settings.primaryColor || '#ED0331',
      secondaryColor: settings.secondaryColor || '#87021C',
      theme: settings.theme || 'light',
    },
  };
};

const loadBrandingForVendorId = async (vendorId) => {
  if (!vendorId) return null;
  try {
    const vendor = await Vendor.findById(vendorId).select('logo companyName settings');
    return formatBrandingPayload(vendor);
  } catch (err) {
    console.error('loadBrandingForVendorId error:', err.message);
    return null;
  }
};

/**
 * Find vendor for a student who may be missing vendorId on their User document.
 */
const resolveVendorIdFromStudentContext = async (userId) => {
  if (!userId) return null;

  const classroom = await Classroom.findOne({ students: userId })
    .sort({ updatedAt: -1 })
    .select('vendorId');
  if (classroom?.vendorId) {
    return getVendorIdFromUser({ vendorId: classroom.vendorId });
  }

  const student = await User.findById(userId).select('enrolledTests');
  const testIds = (student?.enrolledTests || [])
    .map((et) => et.testId)
    .filter(Boolean);
  if (testIds.length > 0) {
    const test = await Test.findOne({ _id: { $in: testIds }, vendorId: { $ne: null } })
      .select('vendorId')
      .sort({ updatedAt: -1 });
    if (test?.vendorId) {
      return getVendorIdFromUser({ vendorId: test.vendorId });
    }
  }

  return null;
};

const persistStudentVendorId = async (userId, vendorId) => {
  if (!userId || !vendorId) return;
  try {
    await User.findByIdAndUpdate(userId, {
      $set: { vendorId: new mongoose.Types.ObjectId(vendorId) },
    });
    console.log(`✅ Linked student ${userId} to vendor ${vendorId}`);
  } catch (err) {
    console.warn('persistStudentVendorId warning:', err.message);
  }
};

const resolveVendorIdForUser = async (user, { persistStudent = true } = {}) => {
  if (!user) return null;

  let vendorId = getVendorIdFromUser(user);
  const userId = user._id || user.id;
  let role = user.role;

  if (!vendorId && userId) {
    const fresh = await User.findById(userId).select('vendorId role');
    if (fresh) {
      role = fresh.role || role;
      vendorId = getVendorIdFromUser(fresh);
    }
  }

  if (!vendorId && userId && role === 'student') {
    vendorId = await resolveVendorIdFromStudentContext(userId);
    if (vendorId && persistStudent) {
      await persistStudentVendorId(userId, vendorId);
    }
  }

  return vendorId;
};

const loadBrandingForUser = async (user) => {
  if (!user || user.role === 'super_admin') return null;
  if (user.role !== 'student' && user.role !== 'vendor_admin') return null;

  const vendorId = await resolveVendorIdForUser(user);
  if (!vendorId) {
    console.warn(
      '[branding] No vendorId for user',
      user.email || user._id,
      'role=',
      user.role
    );
    return null;
  }
  return loadBrandingForVendorId(vendorId);
};

const attachBrandingToUser = async (userObj) => {
  if (!userObj) return userObj;

  const vendorId = await resolveVendorIdForUser(userObj);
  const branding = vendorId ? await loadBrandingForVendorId(vendorId) : null;

  return {
    ...userObj,
    id: userObj.id || userObj._id,
    vendorId: vendorId || null,
    branding,
  };
};

module.exports = {
  getVendorIdFromUser,
  formatBrandingPayload,
  loadBrandingForVendorId,
  resolveVendorIdFromStudentContext,
  resolveVendorIdForUser,
  loadBrandingForUser,
  attachBrandingToUser,
};
