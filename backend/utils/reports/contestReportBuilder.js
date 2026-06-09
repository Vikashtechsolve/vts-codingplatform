const Contest = require('../../models/Contest');
const Test = require('../../models/Test');
const Interview = require('../../models/Interview');
const Assignment = require('../../models/Assignment');
const SystemDesignProblem = require('../../models/SystemDesignProblem');
const { loadParticipants, participantMap, getContestStudentIds } = require('../contestResults');
const { ensureContestAttemptsFinalized } = require('../contestService');
const { buildTestReport } = require('./testReportBuilder');
const { buildInterviewReport } = require('./interviewReportBuilder');
const { buildAssignmentReport } = require('./assignmentReportBuilder');
const { buildSystemDesignReport } = require('./systemDesignReportBuilder');
const { formatDate } = require('./formatters');

function enrichRowsWithContestMeta(rows, pMap) {
  const byEmail = new Map(
    [...pMap.values()].map((p) => [
      (p.email || p.userId?.email || '').toLowerCase(),
      p,
    ])
  );
  return (rows || []).map((row) => {
    const p = byEmail.get((row.studentEmail || '').toLowerCase());
    return {
      ...row,
      contestRegisteredAt: p ? formatDate(p.registeredAt) : '',
      contestStatus: p?.status || '',
      college: p?.registrationMeta?.college || '',
      rollNumber: p?.registrationMeta?.rollNumber || '',
      phone: p?.registrationMeta?.phone || '',
    };
  });
}

async function buildContestReport(contest, vendorId) {
  await ensureContestAttemptsFinalized(contest);
  const studentIds = await getContestStudentIds(contest._id);
  const participants = await loadParticipants(contest._id);
  const pMap = participantMap(participants);
  const reportOptions = { studentIds, participantMap: pMap };

  let category;
  let resource;
  let reportData;

  switch (contest.assessmentType) {
    case 'test': {
      resource = await Test.findById(contest.assessmentId);
      if (!resource) throw new Error('Test not found');
      category = 'test';
      reportData = await buildTestReport(resource, vendorId, reportOptions);
      break;
    }
    case 'interview': {
      resource = await Interview.findById(contest.assessmentId);
      if (!resource) throw new Error('Interview not found');
      category = 'interview';
      reportData = await buildInterviewReport(resource, vendorId, reportOptions);
      break;
    }
    case 'assignment': {
      resource = await Assignment.findById(contest.assessmentId);
      if (!resource) throw new Error('Assignment not found');
      category = 'assignment';
      reportData = await buildAssignmentReport(resource, vendorId, reportOptions);
      break;
    }
    case 'system_design': {
      resource = await SystemDesignProblem.findById(contest.assessmentId);
      if (!resource) throw new Error('System design problem not found');
      category = 'system_design';
      reportData = await buildSystemDesignReport(resource, vendorId, reportOptions);
      break;
    }
    default:
      throw new Error(`Unsupported contest assessment type: ${contest.assessmentType}`);
  }

  reportData.summaryRows = enrichRowsWithContestMeta(reportData.summaryRows, pMap);
  reportData.detailRows = enrichRowsWithContestMeta(reportData.detailRows, pMap);
  if (reportData.sectionRows?.length) {
    reportData.sectionRows = enrichRowsWithContestMeta(reportData.sectionRows, pMap);
  }

  reportData.meta = {
    ...reportData.meta,
    contestTitle: contest.title,
    contestSlug: contest.slug,
    contestStatus: contest.status,
    attemptWindowStart: contest.attemptWindowStart,
    attemptWindowEnd: contest.attemptWindowEnd,
    totalRegistered: participants.length,
    reportScope: 'contest',
  };

  return { category, resource, reportData };
}

module.exports = { buildContestReport };
