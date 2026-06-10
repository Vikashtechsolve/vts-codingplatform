const express = require('express');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const Contest = require('../models/Contest');
const ContestParticipant = require('../models/ContestParticipant');
const User = require('../models/User');
const Test = require('../models/Test');
const Interview = require('../models/Interview');
const Assignment = require('../models/Assignment');
const SystemDesignProblem = require('../models/SystemDesignProblem');
const { auth, authorize } = require('../middleware/auth');
const tenantMiddleware = require('../middleware/tenant');
const generateToken = require('../utils/generateToken');
const { rateLimit } = require('../middleware/rateLimit');
const { attachBrandingToUser } = require('../utils/vendorBranding');
const {
  isRegistrationOpen,
  isAttemptWindowOpen,
  getContestPhase,
  loadAssessmentSummary,
  validateAssessmentOwnership,
  ensureAssessmentEnrollment,
  getParticipant,
  assertContestAttemptAllowed,
  findContestBySlug,
  getContestStartRedirect,
  buildPublicContestPayload,
  getRegistrationOpensAt,
  getRegistrationClosesAt,
  finalizeAllInProgressContestAttempts,
  parseContestDateTime,
  validateContestSchedule,
} = require('../utils/contestService');
const { loadBrandingForVendorId } = require('../utils/vendorBranding');
const { getContestResultsBundle, buildContestLeaderboard } = require('../utils/contestResults');
const {
  buildContestReport,
  generateExcelBuffer,
  sanitizeFilename,
  getContestReportOptions,
} = require('../utils/reports');

const router = express.Router();

const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) return next();
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');
    if (user?.isActive) req.user = user;
  } catch {
    /* ignore invalid token */
  }
  next();
};

const contestRegisterLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyPrefix: 'contest-register',
});

const buildValidationErrors = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return true;
  }
  return false;
};

// ─── Public routes ───────────────────────────────────────────────────────────

router.get('/public/:slug', optionalAuth, async (req, res) => {
  try {
    const contest = await findContestBySlug(req.params.slug);
    if (!contest || contest.status === 'draft') {
      return res.status(404).json({ message: 'Contest not found' });
    }

    const assessment = await loadAssessmentSummary(contest);
    let participant = null;
    if (req.user) {
      participant = await getParticipant(contest._id, req.user._id);
    }

    const phase = getContestPhase(contest, participant);
    const branding = await loadBrandingForVendorId(contest.vendorId);
    const payload = buildPublicContestPayload(contest, assessment, participant, phase, branding);

    if (
      phase === 'ended'
      && contest.settings?.showLeaderboard
      && contest.assessmentType === 'test'
    ) {
      payload.leaderboard = await buildContestLeaderboard(contest);
      if (req.user && participant) {
        const mine = payload.leaderboard.find(
          (row) => row.studentEmail?.toLowerCase() === req.user.email?.toLowerCase()
        );
        if (mine) {
          payload.myResult = mine;
        }
      }
    }

    res.json(payload);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.post('/public/:slug/register', contestRegisterLimiter, [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
], async (req, res) => {
  try {
    if (buildValidationErrors(req, res)) return;

    const contest = await findContestBySlug(req.params.slug);
    if (!contest || contest.status !== 'published') {
      return res.status(404).json({ message: 'Contest not found or not open for registration' });
    }

    if (!isRegistrationOpen(contest)) {
      return res.status(400).json({ message: 'Registration is not open for this contest' });
    }

    const participantCount = await ContestParticipant.countDocuments({ contestId: contest._id });
    if (contest.settings?.maxParticipants && participantCount >= contest.settings.maxParticipants) {
      return res.status(400).json({ message: 'Contest has reached maximum participants' });
    }

    const { name, email, password, phone, college, rollNumber } = req.body;
    const normalizedEmail = email.toLowerCase().trim();

    if (contest.settings?.collectPhone && !phone?.trim()) {
      return res.status(400).json({ message: 'Phone number is required' });
    }
    if (contest.settings?.collectCollege && !college?.trim()) {
      return res.status(400).json({ message: 'College is required' });
    }
    if (contest.settings?.collectRollNumber && !rollNumber?.trim()) {
      return res.status(400).json({ message: 'Roll number is required' });
    }

    let user = await User.findOne({ email: normalizedEmail });

    if (user) {
      if (user.role !== 'student') {
        return res.status(400).json({ message: 'This email is associated with a non-student account' });
      }

      const existingParticipant = await ContestParticipant.findOne({
        contestId: contest._id,
        userId: user._id,
      });
      if (existingParticipant) {
        const token = generateToken(user._id);
        const userPayload = await attachBrandingToUser({
          id: user._id,
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          vendorId: user.vendorId,
          accountOrigin: user.accountOrigin,
        });
        const phase = getContestPhase(contest, existingParticipant);
        return res.json({
          token,
          user: userPayload,
          participant: existingParticipant,
          phase,
          message: 'Already registered for this contest',
        });
      }

      if (user.accountOrigin === 'contest' && !user.vendorId) {
        user.vendorId = contest.vendorId;
      }

      await ensureAssessmentEnrollment(user, contest);
    } else {
      user = new User({
        name: name.trim(),
        email: normalizedEmail,
        password,
        role: 'student',
        vendorId: contest.vendorId,
        accountOrigin: 'contest',
        isActive: true,
      });
      await user.save();
      await ensureAssessmentEnrollment(user, contest);
    }

    const participant = await ContestParticipant.create({
      contestId: contest._id,
      userId: user._id,
      email: normalizedEmail,
      registrationMeta: {
        phone: phone?.trim() || undefined,
        college: college?.trim() || undefined,
        rollNumber: rollNumber?.trim() || undefined,
      },
    });

    const token = generateToken(user._id);
    const userPayload = await attachBrandingToUser({
      id: user._id,
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      vendorId: user.vendorId,
      accountOrigin: user.accountOrigin,
    });

    const phase = getContestPhase(contest, participant);
    res.status(201).json({
      token,
      user: userPayload,
      participant,
      phase,
      message: 'Registered successfully',
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Already registered for this contest with this email' });
    }
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.post('/public/:slug/join', auth, authorize('student'), async (req, res) => {
  try {
    const contest = await findContestBySlug(req.params.slug);
    if (!contest || contest.status !== 'published') {
      return res.status(404).json({ message: 'Contest not found' });
    }

    if (!isRegistrationOpen(contest)) {
      return res.status(400).json({ message: 'Registration is not open for this contest' });
    }

    const existing = await getParticipant(contest._id, req.user._id);
    if (existing) {
      const phase = getContestPhase(contest, existing);
      return res.json({
        participant: existing,
        phase,
        message: 'Already registered for this contest',
      });
    }

    const participantCount = await ContestParticipant.countDocuments({ contestId: contest._id });
    if (contest.settings?.maxParticipants && participantCount >= contest.settings.maxParticipants) {
      return res.status(400).json({ message: 'Contest has reached maximum participants' });
    }

    const user = await User.findById(req.user._id);
    if (!user.vendorId) {
      user.vendorId = contest.vendorId;
    }
    await ensureAssessmentEnrollment(user, contest);

    const participant = await ContestParticipant.create({
      contestId: contest._id,
      userId: user._id,
      email: user.email,
      registrationMeta: req.body.registrationMeta || {},
    });

    const phase = getContestPhase(contest, participant);
    res.status(201).json({
      participant,
      phase,
      message: 'Joined contest successfully',
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Already registered for this contest' });
    }
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.post('/public/:slug/start', auth, authorize('student'), async (req, res) => {
  try {
    const contest = await findContestBySlug(req.params.slug);
    if (!contest) {
      return res.status(404).json({ message: 'Contest not found' });
    }

    await assertContestAttemptAllowed(contest, req.user._id);

    const user = await User.findById(req.user._id);
    await ensureAssessmentEnrollment(user, contest);

    const redirectPath = await getContestStartRedirect(contest);
    if (!redirectPath) {
      return res.status(400).json({ message: 'Unsupported assessment type' });
    }

    res.json({
      contestId: contest._id,
      assessmentType: contest.assessmentType,
      assessmentId: contest.assessmentId,
      redirectPath,
      attemptWindowEnd: contest.attemptWindowEnd,
    });
  } catch (error) {
    res.status(error.status || 500).json({
      message: error.message,
      code: error.code,
    });
  }
});

// ─── Vendor admin routes ───────────────────────────────────────────────────────

const vendorRouter = express.Router();
vendorRouter.use(auth);
vendorRouter.use(authorize('vendor_admin'));
vendorRouter.use(tenantMiddleware);

const TEST_TYPE_LABELS = {
  coding: 'Coding',
  mcq: 'MCQ',
  aptitude: 'Aptitude',
  theory: 'Theory',
  mixed: 'Mixed',
  sql: 'SQL',
  english: 'English',
};

function formatContestTestItem(test) {
  const typeLabel = TEST_TYPE_LABELS[test.type] || test.type || 'Test';
  const durationPart = test.duration ? ` · ${test.duration} min` : '';
  const inactivePart = test.isActive === false ? ' (inactive)' : '';
  return {
    _id: test._id,
    title: test.title,
    type: test.type,
    typeLabel,
    duration: test.duration,
    isActive: test.isActive !== false,
    label: `[${typeLabel}] ${test.title}${durationPart}${inactivePart}`,
    createdAt: test.createdAt,
  };
}

function formatContestInterviewItem(interview) {
  const topicPart = interview.topic ? ` · ${interview.topic}` : '';
  const inactivePart = interview.isActive === false ? ' (inactive)' : '';
  return {
    _id: interview._id,
    title: interview.title,
    type: 'interview',
    typeLabel: 'Interview',
    duration: interview.duration,
    isActive: interview.isActive !== false,
    label: `[Interview] ${interview.title}${topicPart} · ${interview.duration} min${inactivePart}`,
    createdAt: interview.createdAt,
  };
}

function formatContestAssignmentItem(assignment) {
  const draftPart = assignment.status === 'draft' ? ' (draft)' : '';
  return {
    _id: assignment._id,
    title: assignment.title,
    type: 'assignment',
    typeLabel: 'Project',
    duration: assignment.duration,
    status: assignment.status,
    label: `[Project] ${assignment.title} · ${assignment.category || 'assignment'}${draftPart}`,
    createdAt: assignment.createdAt,
  };
}

function formatContestSystemDesignItem(problem) {
  const inactivePart = problem.isActive === false ? ' (inactive)' : '';
  return {
    _id: problem._id,
    title: problem.title,
    type: 'system_design',
    typeLabel: 'System Design',
    duration: problem.duration,
    isActive: problem.isActive !== false,
    label: `[System Design] ${problem.title} · ${problem.duration} min${inactivePart}`,
    createdAt: problem.createdAt,
  };
}

vendorRouter.get('/assessments', async (req, res) => {
  try {
    const { type, testType } = req.query;
    const vendorId = req.vendorId;

    if (!type || type === 'test') {
      const query = { vendorId };
      if (testType && testType !== 'all') {
        query.type = testType;
      }
      const tests = await Test.find(query)
        .select('title type duration isActive createdAt')
        .sort({ createdAt: -1 })
        .lean();
      return res.json({
        assessmentType: 'test',
        items: tests.map(formatContestTestItem),
        testTypes: Object.keys(TEST_TYPE_LABELS),
      });
    }
    if (type === 'interview') {
      const interviews = await Interview.find({ vendorId })
        .select('title duration interviewType topic isActive createdAt')
        .sort({ createdAt: -1 })
        .lean();
      return res.json({
        assessmentType: 'interview',
        items: interviews.map(formatContestInterviewItem),
      });
    }
    if (type === 'assignment') {
      const assignments = await Assignment.find({
        vendorId,
        status: { $ne: 'archived' },
      })
        .select('title duration category difficulty status createdAt')
        .sort({ createdAt: -1 })
        .lean();
      return res.json({
        assessmentType: 'assignment',
        items: assignments.map(formatContestAssignmentItem),
      });
    }
    if (type === 'system_design') {
      const problems = await SystemDesignProblem.find({ vendorId })
        .select('title duration category difficulty isActive createdAt')
        .sort({ createdAt: -1 })
        .lean();
      return res.json({
        assessmentType: 'system_design',
        items: problems.map(formatContestSystemDesignItem),
      });
    }

    res.status(400).json({ message: 'Invalid assessment type' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

vendorRouter.get('/', async (req, res) => {
  try {
    const contests = await Contest.find({ vendorId: req.vendorId })
      .sort({ createdAt: -1 });

    const withCounts = await Promise.all(
      contests.map(async (contest) => {
        const participantCount = await ContestParticipant.countDocuments({ contestId: contest._id });
        const assessment = await loadAssessmentSummary(contest);
        return {
          ...contest.toObject(),
          participantCount,
          assessmentTitle: assessment?.title || 'Unknown',
        };
      })
    );

    res.json(withCounts);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

vendorRouter.post('/', [
  body('title').trim().notEmpty(),
  body('assessmentType').isIn(['test', 'interview', 'assignment', 'system_design']),
  body('assessmentId').notEmpty(),
  body('attemptWindowStart').notEmpty(),
  body('attemptWindowEnd').notEmpty(),
], async (req, res) => {
  try {
    if (buildValidationErrors(req, res)) return;

    const {
      title,
      description,
      assessmentType,
      assessmentId,
      registrationOpensAt,
      registrationClosesAt,
      attemptWindowStart,
      attemptWindowEnd,
      settings,
    } = req.body;

    const assessment = await validateAssessmentOwnership(req.vendorId, assessmentType, assessmentId);
    if (!assessment) {
      return res.status(404).json({ message: 'Assessment not found' });
    }

    const windowStart = parseContestDateTime(attemptWindowStart);
    const windowEnd = parseContestDateTime(attemptWindowEnd);
    const regOpens = registrationOpensAt ? parseContestDateTime(registrationOpensAt) : null;
    const regCloses = registrationClosesAt ? parseContestDateTime(registrationClosesAt) : null;

    const scheduleError = validateContestSchedule({
      registrationOpensAt: regOpens,
      registrationClosesAt: regCloses,
      attemptWindowStart: windowStart,
      attemptWindowEnd: windowEnd,
    });
    if (scheduleError) {
      return res.status(400).json({ message: scheduleError });
    }

    const contest = new Contest({
      vendorId: req.vendorId,
      createdBy: req.user._id,
      title: title.trim(),
      description: description?.trim() || '',
      slug: Contest.generateSlug(),
      assessmentType,
      assessmentId,
      registrationOpensAt: regOpens,
      registrationClosesAt: regCloses,
      attemptWindowStart: windowStart,
      attemptWindowEnd: windowEnd,
      settings: settings || {},
      status: 'draft',
    });

    await contest.save();
    res.status(201).json(contest);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

vendorRouter.get('/:id', async (req, res) => {
  try {
    const contest = await Contest.findOne({ _id: req.params.id, vendorId: req.vendorId });
    if (!contest) {
      return res.status(404).json({ message: 'Contest not found' });
    }

    const participantCount = await ContestParticipant.countDocuments({ contestId: contest._id });
    const assessment = await loadAssessmentSummary(contest);

    res.json({
      ...contest.toObject(),
      participantCount,
      assessment,
      shareUrl: `/contest/${contest.slug}`,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

vendorRouter.put('/:id', async (req, res) => {
  try {
    const contest = await Contest.findOne({ _id: req.params.id, vendorId: req.vendorId });
    if (!contest) {
      return res.status(404).json({ message: 'Contest not found' });
    }

    if (contest.status === 'ended') {
      return res.status(400).json({ message: 'Cannot edit an ended contest' });
    }

    const {
      title,
      description,
      registrationOpensAt,
      registrationClosesAt,
      attemptWindowStart,
      attemptWindowEnd,
      settings,
    } = req.body;

    if (title) contest.title = title.trim();
    if (description !== undefined) contest.description = description.trim();

    const nextRegOpens = registrationOpensAt !== undefined
      ? (registrationOpensAt ? parseContestDateTime(registrationOpensAt) : null)
      : contest.registrationOpensAt;
    const nextRegCloses = registrationClosesAt !== undefined
      ? (registrationClosesAt ? parseContestDateTime(registrationClosesAt) : null)
      : contest.registrationClosesAt;
    const nextAttemptStart = attemptWindowStart !== undefined
      ? parseContestDateTime(attemptWindowStart)
      : contest.attemptWindowStart;
    const nextAttemptEnd = attemptWindowEnd !== undefined
      ? parseContestDateTime(attemptWindowEnd)
      : contest.attemptWindowEnd;

    const scheduleError = validateContestSchedule({
      registrationOpensAt: nextRegOpens,
      registrationClosesAt: nextRegCloses,
      attemptWindowStart: nextAttemptStart,
      attemptWindowEnd: nextAttemptEnd,
    });
    if (scheduleError) {
      return res.status(400).json({ message: scheduleError });
    }

    contest.registrationOpensAt = nextRegOpens;
    contest.registrationClosesAt = nextRegCloses;
    contest.attemptWindowStart = nextAttemptStart;
    contest.attemptWindowEnd = nextAttemptEnd;

    if (settings) {
      const current = contest.settings?.toObject?.() || contest.settings || {};
      contest.settings = { ...current, ...settings };
      contest.markModified('settings');
    }

    await contest.save();
    res.json(contest);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

vendorRouter.post('/:id/publish', async (req, res) => {
  try {
    const contest = await Contest.findOne({ _id: req.params.id, vendorId: req.vendorId });
    if (!contest) {
      return res.status(404).json({ message: 'Contest not found' });
    }

    const assessment = await validateAssessmentOwnership(
      req.vendorId,
      contest.assessmentType,
      contest.assessmentId
    );
    if (!assessment) {
      return res.status(400).json({ message: 'Linked assessment not found or inactive' });
    }

    contest.status = 'published';
    await contest.save();

    res.json({
      contest,
      shareUrl: `/contest/${contest.slug}`,
      message: 'Contest published',
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

vendorRouter.post('/:id/end', async (req, res) => {
  try {
    const contest = await Contest.findOne({ _id: req.params.id, vendorId: req.vendorId });
    if (!contest) {
      return res.status(404).json({ message: 'Contest not found' });
    }

    contest.status = 'ended';
    await contest.save();
    const autoSubmittedCount = await finalizeAllInProgressContestAttempts(contest, { force: true });
    res.json({
      contest,
      message: 'Contest ended',
      autoSubmittedCount,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

vendorRouter.get('/:id/results', async (req, res) => {
  try {
    const bundle = await getContestResultsBundle(req.params.id, req.vendorId);
    if (!bundle) {
      return res.status(404).json({ message: 'Contest not found' });
    }
    res.json(bundle);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

vendorRouter.get('/:id/report-options', async (req, res) => {
  try {
    const contest = await Contest.findOne({ _id: req.params.id, vendorId: req.vendorId });
    if (!contest) {
      return res.status(404).json({ message: 'Contest not found' });
    }

    let resource = null;
    if (contest.assessmentType === 'test') {
      resource = await Test.findById(contest.assessmentId);
    } else if (contest.assessmentType === 'interview') {
      resource = await Interview.findById(contest.assessmentId);
    } else if (contest.assessmentType === 'assignment') {
      resource = await Assignment.findById(contest.assessmentId);
    } else if (contest.assessmentType === 'system_design') {
      resource = await SystemDesignProblem.findById(contest.assessmentId);
    }

    if (!resource) {
      return res.status(404).json({ message: 'Linked assessment not found' });
    }

    res.json(getContestReportOptions(contest, resource));
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

vendorRouter.post('/:id/export', async (req, res) => {
  try {
    const contest = await Contest.findOne({ _id: req.params.id, vendorId: req.vendorId });
    if (!contest) {
      return res.status(404).json({ message: 'Contest not found' });
    }

    const selectedKeys = Array.isArray(req.body?.columns) ? req.body.columns : [];
    if (!selectedKeys.length) {
      return res.status(400).json({ message: 'Select at least one column to export.' });
    }

    const { category, resource, reportData } = await buildContestReport(contest, req.vendorId);
    const buffer = await generateExcelBuffer({
      category,
      test: category === 'test' ? resource : undefined,
      selectedKeys,
      reportData,
      isContest: true,
    });

    const filename = `${sanitizeFilename(contest.title)}_contest_report.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(Buffer.from(buffer));
  } catch (error) {
    console.error('Contest export error:', error);
    res.status(500).json({ message: 'Export failed', error: error.message });
  }
});

vendorRouter.get('/:id/participants', async (req, res) => {
  try {
    const contest = await Contest.findOne({ _id: req.params.id, vendorId: req.vendorId });
    if (!contest) {
      return res.status(404).json({ message: 'Contest not found' });
    }

    const participants = await ContestParticipant.find({ contestId: contest._id })
      .populate('userId', 'name email accountOrigin')
      .sort({ registeredAt: -1 });

    let leaderboard = [];
    if (
      contest.assessmentType === 'test'
      && (contest.settings?.showLeaderboard || contest.status === 'ended')
    ) {
      leaderboard = await buildContestLeaderboard(contest);
    }

    res.json({
      participants: participants.map((p) => ({
        id: p._id,
        userId: p.userId?._id,
        name: p.userId?.name,
        email: p.email,
        accountOrigin: p.userId?.accountOrigin,
        status: p.status,
        registeredAt: p.registeredAt,
        registrationMeta: p.registrationMeta,
        attemptRef: p.attemptRef,
      })),
      leaderboard,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.use('/vendor', vendorRouter);

module.exports = router;
