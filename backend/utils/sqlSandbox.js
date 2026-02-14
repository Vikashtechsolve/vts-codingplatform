/**
 * SQL sandbox for student query execution and evaluation.
 * Uses SQLite in-memory DB per execution. Blocks DROP/DELETE/UPDATE/INSERT/ALTER/TRUNCATE.
 */

const crypto = require('crypto');

const FORBIDDEN_KEYWORDS = [
  'DROP', 'DELETE', 'UPDATE', 'INSERT', 'ALTER', 'TRUNCATE',
  'CREATE', 'REPLACE', 'GRANT', 'REVOKE', 'COMMIT', 'ROLLBACK',
  'SAVEPOINT', 'PRAGMA', 'ATTACH', 'DETACH', 'VACUUM', 'ANALYZE'
];

/**
 * Check if query contains only allowed (SELECT, or DESCRIBE table_name).
 * Blocks forbidden keywords (case-insensitive, whole-word where reasonable).
 */
function isQueryAllowed(sql) {
  if (!sql || typeof sql !== 'string') return false;
  const trimmed = sql.trim();
  const upper = trimmed.toUpperCase();
  // Remove single-line and multi-line comments for check
  const withoutLineComments = upper.replace(/--[^\n]*/g, ' ');
  const withoutBlockComments = withoutLineComments.replace(/\/\*[\s\S]*?\*\//g, ' ').trim();

  for (const keyword of FORBIDDEN_KEYWORDS) {
    const idx = withoutBlockComments.indexOf(keyword);
    if (idx === -1) continue;
    const before = withoutBlockComments[idx - 1];
    const after = withoutBlockComments[idx + keyword.length];
    const wordBoundaryBefore = idx === 0 || /[\s;(]/.test(before);
    const wordBoundaryAfter = !after || /[\s;)]/.test(after);
    if (wordBoundaryBefore && wordBoundaryAfter) {
      return false;
    }
  }
  return withoutBlockComments.startsWith('SELECT') || withoutBlockComments.startsWith('DESCRIBE') || withoutBlockComments.startsWith('EXPLAIN');
}

/**
 * Normalize a single cell value for consistent comparison (numbers, nulls, trim).
 */
function normalizeCell(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value === Math.floor(value) ? String(Math.floor(value)) : String(value);
  }
  const s = String(value).trim();
  const num = parseFloat(s);
  if (s !== '' && !Number.isNaN(num)) {
    return num === Math.floor(num) ? String(Math.floor(num)) : String(num);
  }
  return s;
}

/**
 * Normalize query result for comparison.
 * - sortRows: false = order-sensitive (row order matters, strict); true = order-independent (set comparison).
 * - Column keys sorted case-insensitively so column order in SELECT does not change the hash.
 * - Cell values normalized (trim, numeric form) so 1, 1.0, "1" all match.
 */
function normalizeOutput(rows, sortRows = false) {
  if (!Array.isArray(rows)) return '';
  const normalized = rows.map(row => {
    const keys = Object.keys(row).sort((a, b) =>
      a.toLowerCase().localeCompare(b.toLowerCase(), 'en')
    );
    const values = keys.map(k => normalizeCell(row[k]));
    return values.join('\t');
  });
  if (sortRows) normalized.sort();
  return normalized.join('\n');
}

/**
 * Hash normalized output for storage and comparison.
 */
function hashOutput(normalizedStr) {
  return crypto.createHash('sha256').update(normalizedStr || '').digest('hex');
}

/**
 * Run schema + data SQL and then execute a single SELECT query in an in-memory SQLite DB.
 * Returns { success, rows, error, normalizedOutput, outputHash }.
 * Uses dynamic require so server starts even if better-sqlite3 is not installed.
 */
function runInSandbox(schemaSql, dataSql, query) {
  let Database;
  try {
    Database = require('better-sqlite3');
  } catch (e) {
    return {
      success: false,
      rows: [],
      error: 'SQL execution not available. Install better-sqlite3: npm install better-sqlite3',
      normalizedOutput: '',
      outputHash: '',
      outputHashSet: ''
    };
  }

  if (!isQueryAllowed(query)) {
    return {
      success: false,
      rows: [],
      error: 'Only SELECT (and DESCRIBE/EXPLAIN) queries are allowed. DROP, DELETE, UPDATE, INSERT, ALTER, TRUNCATE are blocked.',
      normalizedOutput: '',
      outputHash: '',
      outputHashSet: ''
    };
  }

  const db = new Database(':memory:');
  try {
    if (schemaSql && schemaSql.trim()) {
      db.exec(schemaSql);
    }
    if (dataSql && dataSql.trim()) {
      db.exec(dataSql);
    }

    let runQuery = query.trim();
    const upperQuery = runQuery.toUpperCase().trim();
    if (upperQuery.startsWith('DESCRIBE ')) {
      const tableName = runQuery.slice(9).trim().replace(/;$/,'').trim();
      runQuery = `SELECT * FROM pragma_table_info('${tableName.replace(/'/g, "''")}')`;
    }

    const stmt = db.prepare(runQuery);
    const rows = stmt.all();
    const normalizedOutput = normalizeOutput(rows, false);
    const outputHash = hashOutput(normalizedOutput);
    const normalizedOutputSet = normalizeOutput(rows, true);
    const outputHashSet = hashOutput(normalizedOutputSet);

    return {
      success: true,
      rows,
      error: null,
      normalizedOutput,
      outputHash,
      outputHashSet
    };
  } catch (err) {
    return {
      success: false,
      rows: [],
      error: err.message || String(err),
      normalizedOutput: '',
      outputHash: '',
      outputHashSet: ''
    };
  } finally {
    db.close();
  }
}

/**
 * Run only schema + data and optional admin query (for dry-run / expected output).
 * Used when building expectedOutputHash for a question.
 */
function getExpectedOutputHash(schemaSql, dataSql, correctSql) {
  const result = runInSandbox(schemaSql, dataSql, correctSql);
  return result.success ? result.outputHash : null;
}

module.exports = {
  isQueryAllowed,
  normalizeOutput,
  hashOutput,
  runInSandbox,
  getExpectedOutputHash
};
