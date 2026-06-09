const { buildTestReport } = require('./testReportBuilder');
const { buildInterviewReport } = require('./interviewReportBuilder');
const { buildAssignmentReport } = require('./assignmentReportBuilder');
const { buildSystemDesignReport } = require('./systemDesignReportBuilder');
const { buildContestReport } = require('./contestReportBuilder');
const { generateExcelBuffer, sanitizeFilename } = require('./generateExcel');
const {
  getColumnDefs,
  getContestReportOptions,
  getTestReportOptions,
  getInterviewReportOptions,
  getAssignmentReportOptions,
  getSystemDesignReportOptions,
} = require('./reportOptions');

async function buildReportData(category, resource, vendorId) {
  switch (category) {
    case 'test':
      return buildTestReport(resource, vendorId);
    case 'interview':
      return buildInterviewReport(resource, vendorId);
    case 'assignment':
      return buildAssignmentReport(resource, vendorId);
    case 'system_design':
      return buildSystemDesignReport(resource, vendorId);
    default:
      throw new Error(`Unknown category: ${category}`);
  }
}

module.exports = {
  buildReportData,
  buildContestReport,
  generateExcelBuffer,
  sanitizeFilename,
  getColumnDefs,
  getContestReportOptions,
  getTestReportOptions,
  getInterviewReportOptions,
  getAssignmentReportOptions,
  getSystemDesignReportOptions,
};
