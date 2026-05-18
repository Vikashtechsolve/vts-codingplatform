import { normalizeBrandSettings } from '../constants/branding';

export function applyBrandingToDocument(settings) {
  const { primaryColor, secondaryColor } = normalizeBrandSettings(settings);
  const root = document.documentElement;
  root.style.setProperty('--primary-color', primaryColor);
  root.style.setProperty('--secondary-color', secondaryColor);
  root.style.setProperty(
    '--primary-gradient',
    `linear-gradient(to right, ${primaryColor}, ${secondaryColor})`
  );
}

export function clearBrandingFromDocument() {
  const root = document.documentElement;
  root.style.removeProperty('--primary-color');
  root.style.removeProperty('--secondary-color');
  root.style.removeProperty('--primary-gradient');
}
