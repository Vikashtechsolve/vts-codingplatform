const ExcelJS = require('exceljs');
const { resolveColumns } = require('./reportOptions');

const HEADER_FILL = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FF1E293B' },
};
const HEADER_FONT = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };

function pickRowFields(row, columns) {
  const out = {};
  columns.forEach((col) => {
    out[col.key] = row[col.key] ?? '';
  });
  return out;
}

function sheetHasColumns(columns, sheetId) {
  return columns.some((c) => c.sheet === sheetId);
}

async function addSheet(workbook, name, columns, rows) {
  if (!columns.length) return;
  const ws = workbook.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = columns.map((c) => ({
    header: c.label,
    key: c.key,
    width: c.width || 18,
  }));

  const headerRow = ws.getRow(1);
  headerRow.eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.alignment = { vertical: 'middle', wrapText: true };
  });
  headerRow.height = 22;

  rows.forEach((row) => {
    ws.addRow(pickRowFields(row, columns));
  });

  ws.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    row.eachCell((cell) => {
      cell.alignment = { vertical: 'top', wrapText: true };
    });
  });

  return ws;
}

async function addInfoSheet(workbook, meta, assessmentLabel) {
  const ws = workbook.addWorksheet('Report Info');
  const lines = [
    ['Assessment', assessmentLabel],
    ['Title', meta.title || ''],
    ['Type', meta.type || meta.testType || ''],
    ['Total Enrolled', meta.totalEnrolled ?? ''],
    ['Total Attempts / Submissions', meta.totalAttempts ?? meta.totalSessions ?? meta.totalSubmissions ?? ''],
    ['Generated At', meta.generatedAt ? new Date(meta.generatedAt).toISOString() : ''],
  ];
  if (meta.duration) lines.push(['Duration (minutes)', meta.duration]);
  if (meta.topic) lines.push(['Topic', meta.topic]);
  if (meta.difficulty) lines.push(['Difficulty', meta.difficulty]);
  if (meta.contestTitle) lines.push(['Contest', meta.contestTitle]);
  if (meta.contestSlug) lines.push(['Contest Link Slug', meta.contestSlug]);
  if (meta.totalRegistered != null) lines.push(['Contest Registrations', meta.totalRegistered]);
  if (meta.attemptWindowStart) {
    lines.push(['Attempt Window Start', new Date(meta.attemptWindowStart).toISOString()]);
  }
  if (meta.attemptWindowEnd) {
    lines.push(['Attempt Window End', new Date(meta.attemptWindowEnd).toISOString()]);
  }

  lines.forEach(([a, b], i) => {
    const row = ws.getRow(i + 1);
    row.getCell(1).value = a;
    row.getCell(1).font = { bold: true };
    row.getCell(2).value = b;
  });
  ws.getColumn(1).width = 28;
  ws.getColumn(2).width = 48;
}

/**
 * @param {object} params
 * @param {'test'|'interview'|'assignment'|'system_design'} params.category
 * @param {object} params.test - Test doc when category is test
 * @param {string[]} params.selectedKeys
 * @param {object} params.reportData - from *ReportBuilder
 */
async function generateExcelBuffer({ category, test, selectedKeys, reportData, isContest }) {
  const allColumns = resolveColumns(category, test, selectedKeys, isContest);

  const summaryCols = allColumns.filter((c) => c.sheet === 'summary');
  const detailCols = allColumns.filter((c) => c.sheet === 'detail');
  const sectionCols = allColumns.filter((c) => c.sheet === 'sections');

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Coding Platform';
  workbook.created = new Date();

  const labels = {
    test: 'Timed Test',
    interview: 'Mock Interview',
    assignment: 'Project Assignment',
    system_design: 'System Design',
  };

  await addInfoSheet(workbook, reportData.meta, labels[category] || 'Assessment');

  if (sheetHasColumns(allColumns, 'summary')) {
    await addSheet(workbook, 'Student Summary', summaryCols, reportData.summaryRows);
  }
  if (sheetHasColumns(allColumns, 'detail') && reportData.detailRows?.length) {
    await addSheet(workbook, 'Question Breakdown', detailCols, reportData.detailRows);
  }
  if (sheetHasColumns(allColumns, 'sections') && reportData.sectionRows?.length) {
    await addSheet(workbook, 'Section Scores', sectionCols, reportData.sectionRows);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
}

function sanitizeFilename(name) {
  return (name || 'report')
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 80);
}

module.exports = {
  generateExcelBuffer,
  sanitizeFilename,
};
