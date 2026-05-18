import { normalizeBrandSettings } from '../constants/branding';

export function normalizeBrandingPayload(data) {
  if (!data) return null;
  return {
    logo: data.logo || null,
    companyName: data.companyName || null,
    settings: data.settings ? normalizeBrandSettings(data.settings) : null,
  };
}

/** Merge branding — never drop an existing logo unless explicitly cleared */
export function mergeBranding(prev, next) {
  if (!next) return prev || null;
  const base = prev || {};
  const merged = {
    logo: next.logo != null && next.logo !== '' ? next.logo : base.logo || null,
    companyName: next.companyName || base.companyName || null,
    settings: next.settings || base.settings || null,
  };
  if (!merged.logo && !merged.companyName && !merged.settings) return prev || null;
  return merged;
}

export function hasVisibleBranding(b) {
  return Boolean(b && (b.logo || b.companyName));
}
