import { sanitizeInlineStyle, isThemeNeutralColor } from './richTextSanitize';

describe('sanitizeInlineStyle', () => {
  test('keeps highlight and alignment, drops scripts', () => {
    const out = sanitizeInlineStyle(
      'color: #2563eb; background-color: #fef3c7; text-align: center; background: url(javascript:alert(1))'
    );
    expect(out).toContain('color: #2563eb');
    expect(out).toContain('background-color: #fef3c7');
    expect(out).toContain('text-align: center');
    expect(out).not.toContain('url');
  });

  test('drops near-black text color so theme can inherit', () => {
    expect(sanitizeInlineStyle('color: #000000; font-weight: 700')).toBe('font-weight: 700');
    expect(sanitizeInlineStyle('color: rgb(0, 0, 0)')).toBe('');
  });

  test('drops white paper backgrounds', () => {
    expect(sanitizeInlineStyle('background-color: #ffffff')).toBe('');
  });
});

describe('isThemeNeutralColor', () => {
  test('detects black and white', () => {
    expect(isThemeNeutralColor('#000')).toBe(true);
    expect(isThemeNeutralColor('#fff')).toBe(true);
    expect(isThemeNeutralColor('#2563eb')).toBe(false);
  });
});
