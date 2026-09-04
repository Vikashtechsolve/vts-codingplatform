import ReactQuill from 'react-quill';

const Quill = ReactQuill.Quill;
const Delta = Quill.import('delta');

function rgbToHex(color) {
  if (!color) return '';
  const value = String(color).trim();
  if (value.startsWith('#')) return value;
  const m = value.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (!m) return value;
  return `#${[m[1], m[2], m[3]].map((n) => Number(n).toString(16).padStart(2, '0')).join('')}`;
}

function cellText(cell) {
  return String(cell.innerText || '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Quill drops a lot of pasted HTML (Google Docs fake <b>, tables, extra headings).
 * Register extra clipboard matchers so notes look closer to the source (Notion/Docs/web).
 */
export function registerClipboardMatchers(quill) {
  if (!quill || quill.__richPasteBound) return;
  quill.__richPasteBound = true;

  const clipboard = quill.getModule('clipboard');
  if (!clipboard) return;

  // Google Docs wraps everything in <b style="font-weight:normal">.
  clipboard.addMatcher('B', (node, delta) => {
    const weight = String(node.style?.fontWeight || '').toLowerCase();
    if (weight === 'normal' || weight === '400') {
      delta.ops.forEach((op) => {
        if (op.attributes) delete op.attributes.bold;
      });
    }
    return delta;
  });

  clipboard.addMatcher('SPAN', (node, delta) => {
    const style = node.style || {};
    const attrs = {};
    const weight = String(style.fontWeight || '');
    if (weight === 'bold' || weight === 'bolder' || Number(weight) >= 600) attrs.bold = true;
    if (style.fontStyle === 'italic') attrs.italic = true;
    const deco = String(style.textDecoration || '');
    if (deco.includes('underline')) attrs.underline = true;
    if (deco.includes('line-through')) attrs.strike = true;
    const color = rgbToHex(style.color);
    if (color) attrs.color = color;
    const bg = rgbToHex(style.backgroundColor);
    if (bg && !/transparent|rgba\(0,\s*0,\s*0,\s*0\)/i.test(style.backgroundColor || '')) {
      attrs.background = bg;
    }
    if (!Object.keys(attrs).length) return delta;
    return delta.compose(new Delta().retain(delta.length(), attrs));
  });

  clipboard.addMatcher('H5', (_node, delta) =>
    delta.compose(new Delta().retain(delta.length(), { header: 4 }))
  );
  clipboard.addMatcher('H6', (_node, delta) =>
    delta.compose(new Delta().retain(delta.length(), { header: 4 }))
  );

  clipboard.addMatcher('TABLE', (node) => {
    const rows = Array.from(node.querySelectorAll('tr'));
    const ops = [];
    rows.forEach((tr, idx) => {
      const isHeader = Boolean(tr.querySelector('th')) || tr.parentElement?.tagName === 'THEAD';
      const text = Array.from(tr.querySelectorAll('th, td'))
        .map(cellText)
        .filter(Boolean)
        .join('   ·   ');
      if (!text) return;
      ops.push({ insert: text, attributes: isHeader || idx === 0 ? { bold: true } : {} });
      ops.push({ insert: '\n' });
    });
    if (!ops.length) return new Delta();
    ops.push({ insert: '\n' });
    return new Delta(ops);
  });

  clipboard.addMatcher('HR', () => new Delta().insert(`${'—'.repeat(20)}\n`));
}
