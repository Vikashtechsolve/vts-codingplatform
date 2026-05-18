/** Resolve vendorId from user objects (login payload, /auth/me, mongoose JSON). */
export function getUserVendorId(user) {
  if (!user?.vendorId) return null;
  const v = user.vendorId;
  if (typeof v === 'object' && v !== null) {
    if (v._id) return String(v._id);
    if (v.id) return String(v.id);
  }
  const id = String(v);
  if (id === '[object Object]' || id === 'undefined' || id === 'null') return null;
  return id;
}

/** Pull branding from user.branding or a populated vendorId object */
export function getBrandingFromUser(user) {
  if (!user) return null;
  if (user.branding && (user.branding.logo || user.branding.companyName || user.branding.settings)) {
    return user.branding;
  }
  const v = user.vendorId;
  if (v && typeof v === 'object' && (v.logo || v.companyName)) {
    return {
      logo: v.logo || null,
      companyName: v.companyName || null,
      settings: v.settings || null,
    };
  }
  return null;
}

export function normalizeAuthUser(raw) {
  if (!raw) return null;
  const vendorId = getUserVendorId(raw);
  const branding = getBrandingFromUser(raw) || raw.branding || null;
  return {
    ...raw,
    id: raw.id || raw._id,
    vendorId,
    branding,
  };
}

export function isVendorScopedUser(user) {
  if (!user?.role) return false;
  return user.role === 'vendor_admin' || user.role === 'student';
}
