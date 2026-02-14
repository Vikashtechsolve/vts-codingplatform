/**
 * Parse SQLite-style CREATE TABLE schema SQL for visual ER diagram.
 * Returns { tables: [{ tableName, columns }], relationships: [{ fromTable, fromColumn, toTable, toColumn }] }.
 * Relationships are deduplicated (same FK from inline REFERENCES and FOREIGN KEY only appears once).
 */
export function parseSchemaSql(schemaSql) {
  if (!schemaSql || typeof schemaSql !== 'string') {
    return { tables: [], relationships: [] };
  }
  const tables = [];
  const relationships = [];
  const seenKeys = new Set();
  const normalized = schemaSql.replace(/\r\n/g, '\n').trim();
  const createTableRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["']?(\w+)["']?\s*\(/gi;
  let match;
  while ((match = createTableRegex.exec(normalized)) !== null) {
    const tableName = match[1];
    const startParen = match.index + match[0].length;
    const endParen = findMatchingParen(normalized, startParen - 1);
    if (endParen === -1) continue;
    const body = normalized.slice(startParen, endParen);
    const columns = parseColumnDefs(body, tableName, relationships, seenKeys);
    const fks = parseForeignKeys(body, tableName, seenKeys);
    tables.push({ tableName, columns });
    relationships.push(...fks);
  }
  return { tables, relationships };
}

/** Parse FOREIGN KEY (col) REFERENCES other_table(ref_col) from table body */
function parseForeignKeys(body, fromTable, seenKeys) {
  const rels = [];
  const fkRegex = /FOREIGN\s+KEY\s*\(\s*["']?(\w+)["']?\s*\)\s+REFERENCES\s+["']?(\w+)["']?\s*\(\s*["']?(\w+)["']?\s*\)/gi;
  let m;
  while ((m = fkRegex.exec(body)) !== null) {
    const key = `${fromTable.toLowerCase()}:${m[1].toLowerCase()}:${m[2].toLowerCase()}:${m[3].toLowerCase()}`;
    if (seenKeys && seenKeys.has(key)) continue;
    if (seenKeys) seenKeys.add(key);
    rels.push({
      fromTable,
      fromColumn: m[1],
      toTable: m[2],
      toColumn: m[3]
    });
  }
  return rels;
}

function findMatchingParen(str, openIndex) {
  let depth = 1;
  for (let i = openIndex + 1; i < str.length; i++) {
    const c = str[i];
    if (c === '(') depth++;
    else if (c === ')') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function parseColumnDefs(body, tableName, relationships, seenKeys) {
  const columns = [];
  const parts = splitTopLevel(body, ',');
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    if (/^\s*PRIMARY\s+KEY\s*\(/i.test(trimmed) || /^\s*FOREIGN\s+KEY/i.test(trimmed) || /^\s*UNIQUE\s*\(/i.test(trimmed) || /^\s*CHECK\s*\(/i.test(trimmed)) {
      continue;
    }
    const refMatch = trimmed.match(/^["']?(\w+)["']?\s+(\S+)(?:\s+.*?)?\s+REFERENCES\s+["']?(\w+)["']?\s*\(\s*["']?(\w+)["']?\s*\)/i);
    if (refMatch) {
      columns.push({ name: refMatch[1], type: refMatch[2] });
      if (relationships) {
        const key = `${tableName.toLowerCase()}:${refMatch[1].toLowerCase()}:${refMatch[3].toLowerCase()}:${refMatch[4].toLowerCase()}`;
        if (!seenKeys || !seenKeys.has(key)) {
          if (seenKeys) seenKeys.add(key);
          relationships.push({ fromTable: tableName, fromColumn: refMatch[1], toTable: refMatch[3], toColumn: refMatch[4] });
        }
      }
      continue;
    }
    const tokens = trimmed.split(/\s+/);
    if (tokens.length >= 2) {
      const name = tokens[0].replace(/^["']|["']$/g, '');
      const type = tokens[1];
      columns.push({ name, type });
    } else if (tokens.length === 1 && tokens[0]) {
      columns.push({ name: tokens[0].replace(/^["']|["']$/g, ''), type: '' });
    }
  }
  return columns;
}

function splitTopLevel(str, char) {
  const result = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < str.length; i++) {
    const c = str[i];
    if (c === '(') depth++;
    else if (c === ')') depth--;
    else if (depth === 0 && c === char) {
      result.push(str.slice(start, i));
      start = i + 1;
    }
  }
  result.push(str.slice(start));
  return result;
}
