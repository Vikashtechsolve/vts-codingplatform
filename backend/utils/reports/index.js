const { buildTestReport } = require('./testReportBuilder');
const { buildInterviewReport } = require('./interviewReportBuilder');
const { buildAssignmentReport } = require('./assignmentReportBuilder');
const { buildSystemDesignReport } = require('./systemDesignReportBuilder');
const { generateExcelBuffer, sanitizeFilename } = require('./generateExcel');
const {
  getColumnDefs,
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
  generateExcelBuffer,
  sanitizeFilename,
  getColumnDefs,
  getTestReportOptions,
  getInterviewReportOptions,
  getAssignmentReportOptions,
  getSystemDesignReportOptions,
};
