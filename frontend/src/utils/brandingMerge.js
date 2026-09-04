import { normalizeBrandSettings } from '../constants/branding';

export function normalizeBrandingPayload(data) {
  if (!data) return null;
  const payload = {
    companyName: data.companyName ?? null,
    settings: data.settings ? normalizeBrandSettings(data.settings) : null,
  };
  // Only carry the logo key when the caller explicitly provided it, so
  // partial updates (e.g. settings only) never wipe an existing logo.
  if ('logo' in data) payload.logo = data.logo || null;
  return payload;
}

/** Merge branding — never drop an existing logo unless explicitly cleared */
export function mergeBranding(prev, next) {
  if (!next) return prev || null;
  const base = prev || {};
  const merged = {
    logo: Object.prototype.hasOwnProperty.call(next, 'logo')
      ? next.logo || null
      : base.logo || null,
    companyName:
      next.companyName != null && next.companyName !== ''
        ? next.companyName
        : base.companyName || null,
    settings: next.settings
      ? normalizeBrandSettings({ ...(base.settings || {}), ...next.settings })
      : base.settings || null,
  };
  if (!merged.logo && !merged.companyName && !merged.settings) return prev || null;
  return merged;
}

export function hasVisibleBranding(b) {
  return Boolean(b && (b.logo || b.companyName));
}
