const SAFE_STYLE_PROPS = new Set([
  'color',
  'background-color',
  'background',
  'text-align',
  'font-weight',
  'font-style',
  'text-decoration',
  'font-size',
  'padding-left',
  'padding-right',
  'margin-left',
  'white-space',
  'border-left',
  'border-left-color',
  'border-left-width',
  'border-left-style',
  'border-radius',
]);

function parseRgb(value) {
  const hex = String(value || '').trim();
  if (/^#([0-9a-f]{3})$/i.test(hex)) {
    const [, h] = hex.match(/^#([0-9a-f]{3})$/i);
    return {
      r: parseInt(h[0] + h[0], 16),
      g: parseInt(h[1] + h[1], 16),
      b: parseInt(h[2] + h[2], 16),
    };
  }
  if (/^#([0-9a-f]{6})$/i.test(hex)) {
    const [, h] = hex.match(/^#([0-9a-f]{6})$/i);
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
    };
  }
  const m = String(value || '').match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (!m) return null;
  return { r: Number(m[1]), g: Number(m[2]), b: Number(m[3]) };
}

function luminance({ r, g, b }) {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

function isPaperBackground(rgb) {
  const l = luminance(rgb);
  if (l < 0.88) return false;
  const max = Math.max(rgb.r, rgb.g, rgb.b);
  const min = Math.min(rgb.r, rgb.g, rgb.b);
  const sat = max === 0 ? 0 : (max - min) / max;
  return sat < 0.12;
}

/** Drop near-black / near-white text so light/dark theme text still inherits. */
export function isThemeNeutralColor(value) {
  const rgb = parseRgb(value);
  if (!rgb) return false;
  const l = luminance(rgb);
  return l < 0.12 || l > 0.92;
}

export function sanitizeInlineStyle(css) {
  if (!css || typeof css !== 'string') return '';
  return css
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const idx = part.indexOf(':');
      if (idx < 0) return '';
      const prop = part.slice(0, idx).trim().toLowerCase();
      const val = part.slice(idx + 1).trim();
      if (!SAFE_STYLE_PROPS.has(prop)) return '';
      if (!val || /expression|javascript|url\s*\(/i.test(val)) return '';
      if (prop === 'color' && isThemeNeutralColor(val)) return '';
      if (prop === 'background' || prop === 'background-color') {
        const rgb = parseRgb(val);
        if (rgb && isPaperBackground(rgb)) return '';
      }
      return `${prop}: ${val}`;
    })
    .filter(Boolean)
    .join('; ');
}
