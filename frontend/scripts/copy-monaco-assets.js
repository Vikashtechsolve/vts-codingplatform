/**
 * Copy Monaco min/vs assets into public/ so the editor loads from the same
 * origin as the app (Vercel CDN) instead of jsdelivr — critical for exams on
 * slow or restricted networks.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'node_modules/monaco-editor/min/vs');
const DEST = path.join(ROOT, 'public/monaco/vs');

function copyRecursive(srcDir, destDir) {
  fs.mkdirSync(destDir, { recursive: true });
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      copyRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

if (!fs.existsSync(SRC)) {
  console.error(
    '[copy-monaco-assets] monaco-editor min/vs not found. Run npm install in frontend/.'
  );
  process.exit(1);
}

console.log('[copy-monaco-assets] Copying Monaco assets to public/monaco/vs …');
fs.rmSync(path.join(ROOT, 'public/monaco'), { recursive: true, force: true });
copyRecursive(SRC, DEST);
console.log('[copy-monaco-assets] Done.');
