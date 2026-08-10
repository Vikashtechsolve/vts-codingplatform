/** Default product name in navbar and browser title */
export const APP_NAME = 'Test Platform';

/**
 * Navbar logo sizing — derived from Navbar.css:
 * - .navbar padding: 12px vertical
 * - .navbar-brand font-size: 1.35rem (~22px)
 * - .navbar-link padding: 10px vertical, font-size: 1.05rem
 * Usable brand row height ≈ 44–48px; width budget ≈ 180px before nav links.
 */
export const NAVBAR_LOGO_DISPLAY = {
  height: 44,
  maxWidth: 180,
};

/** Upload at 2× display size for retina screens */
export const NAVBAR_LOGO_UPLOAD = {
  recommendedHeight: 88,
  recommendedMaxWidth: 360,
  squareSize: 88,
  maxFileSizeMB: 5,
  acceptedFormats: ['PNG', 'JPG', 'JPEG', 'GIF', 'WebP'],
  acceptMime: 'image/png,image/jpeg,image/jpg,image/gif,image/webp',
};

export const DEFAULT_BRANDING = {
  primaryColor: '#ED0331',
  secondaryColor: '#87021C',
  theme: 'light',
  leetcodeAnalyticsUrl: '',
};

/** Ensure settings always has complete color fields for API + CSS */
export function normalizeBrandSettings(settings) {
  return {
    primaryColor: settings?.primaryColor || DEFAULT_BRANDING.primaryColor,
    secondaryColor: settings?.secondaryColor || DEFAULT_BRANDING.secondaryColor,
    theme: settings?.theme || DEFAULT_BRANDING.theme,
    leetcodeAnalyticsUrl: (settings?.leetcodeAnalyticsUrl || '').trim(),
  };
}
