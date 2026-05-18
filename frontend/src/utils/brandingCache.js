const STORAGE_KEY = 'platform_vendor_branding_v1';

function readAll() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeAll(map) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* ignore quota errors */
  }
}

export function getCachedBranding(vendorId) {
  if (!vendorId) return null;
  const map = readAll();
  return map[String(vendorId)] || null;
}

export function setCachedBranding(vendorId, branding) {
  if (!vendorId || !branding) return;
  const map = readAll();
  map[String(vendorId)] = {
    logo: branding.logo || null,
    companyName: branding.companyName || null,
    settings: branding.settings || null,
    updatedAt: Date.now(),
  };
  writeAll(map);
}

export function clearBrandingCache() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
