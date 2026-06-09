const express = require('express');
const mongoose = require('mongoose');
const Announcement = require('../models/Announcement');
const AnnouncementRead = require('../models/AnnouncementRead');
const Classroom = require('../models/Classroom');
const User = require('../models/User');
const Contest = require('../models/Contest');
const ContestParticipant = require('../models/ContestParticipant');
const { auth: authenticateToken, authorize: authorizeRoles } = require('../middleware/auth');
const tenantMiddleware = require('../middleware/tenant');

const router = express.Router();

async function getStudentClassroomIds(studentId, vendorId) {
  const classrooms = await Classroom.find({
    vendorId,
    isActive: true,
    students: studentId
  }).select('_id name');
  return classrooms;
}

/**
 * Students should only see announcements published on or after they joined the vendor.
 * Contest-only accounts use their contest registration time (not an older reused account date).
 */
async function getStudentAnnouncementEligibleSince(studentId, vendorId) {
  const user = await User.findById(studentId).select('createdAt accountOrigin vendorId');
  if (!user) return new Date();

  let eligibleSince = user.createdAt ? new Date(user.createdAt) : new Date();

  if (user.accountOrigin === 'contest' && vendorId) {
    const participants = await ContestParticipant.find({ userId: studentId })
      .select('registeredAt contestId')
      .lean();

    if (participants.length > 0) {
      const contestIds = participants.map((p) => p.contestId);
      const vendorContests = await Contest.find({
        _id: { $in: contestIds },
        vendorId,
      })
        .select('_id')
        .lean();

      const vendorContestIds = new Set(vendorContests.map((c) => c._id.toString()));

      for (const participant of participants) {
        if (!vendorContestIds.has(String(participant.contestId)) || !participant.registeredAt) {
          continue;
        }
        const registeredAt = new Date(participant.registeredAt);
        if (registeredAt > eligibleSince) {
          eligibleSince = registeredAt;
        }
      }
    }
  }

  return eligibleSince;
}

function buildStudentVisibilityFilter(vendorId, classroomObjectIds, eligibleSince) {
  const orConditions = [{ targetType: 'all' }];
  if (classroomObjectIds.length > 0) {
    orConditions.push({
      targetType: 'classrooms',
      targetClassroomIds: { $in: classroomObjectIds }
    });
  }

  const filter = {
    vendorId,
    status: 'published',
    $or: orConditions,
  };

  if (eligibleSince) {
    filter.publishedAt = { $gte: eligibleSince };
  }

  return filter;
}

async function getStudentAnnouncementContext(studentId, vendorId) {
  const [classrooms, eligibleSince] = await Promise.all([
    getStudentClassroomIds(studentId, vendorId),
    getStudentAnnouncementEligibleSince(studentId, vendorId),
  ]);
  return {
    classroomIds: classrooms.map((c) => c._id),
    classrooms,
    eligibleSince,
  };
}

async function resolveAudienceStudentIds(vendorId, targetType, targetClassroomIds, publishedAt = null) {
  const publishedBefore = publishedAt ? new Date(publishedAt) : null;

  if (targetType === 'all') {
    const query = {
      vendorId,
      role: 'student',
      isActive: { $ne: false },
    };
    if (publishedBefore) {
      query.createdAt = { $lte: publishedBefore };
    }
    const students = await User.find(query).select('_id accountOrigin createdAt');
    if (!publishedBefore) {
      return students.map((s) => s._id);
    }

    const eligible = [];
    for (const student of students) {
      const eligibleSince = await getStudentAnnouncementEligibleSince(student._id, vendorId);
      if (eligibleSince <= publishedBefore) {
        eligible.push(student._id);
      }
    }
    return eligible;
  }
  if (!targetClassroomIds?.length) return [];
  const classrooms = await Classroom.find({
    _id: { $in: targetClassroomIds },
    vendorId,
    isActive: true
  }).select('students');
  const idSet = new Set();
  classrooms.forEach((c) => {
    (c.students || []).forEach((sid) => idSet.add(sid.toString()));
  });
  return [...idSet].map((id) => new mongoose.Types.ObjectId(id));
}

function enrichWithReadStatus(announcements, readAnnouncementIds) {
  const readSet = new Set(readAnnouncementIds.map((id) => id.toString()));
  return announcements.map((doc) => {
    const a = doc.toObject ? doc.toObject() : doc;
    return {
      ...a,
      isRead: readSet.has(a._id.toString())
    };
  });
}

// ==========================================
// STUDENT ROUTES (must be before /:id)
// ==========================================

router.get(
  '/student/unread-count',
  authenticateToken,
  authorizeRoles('student'),
  tenantMiddleware,
  async (req, res) => {
    try {
      const vendorId = req.vendorId;
      const studentId = req.user._id;
      const { classroomIds, eligibleSince } = await getStudentAnnouncementContext(studentId, vendorId);

      const visible = await Announcement.find(
        buildStudentVisibilityFilter(vendorId, classroomIds, eligibleSince)
      ).select('_id');

      if (visible.length === 0) {
        return res.json({ success: true, count: 0 });
      }

      const visibleIds = visible.map((a) => a._id);
      const readCount = await AnnouncementRead.countDocuments({
        studentId,
        announcementId: { $in: visibleIds }
      });

      res.json({
        success: true,
        count: Math.max(0, visible.length - readCount)
      });
    } catch (error) {
      console.error('Unread count error:', error);
      res.status(500).json({ success: false, message: 'Failed to get unread count', error: error.message });
    }
  }
);

router.get(
  '/student/inbox',
  authenticateToken,
  authorizeRoles('student'),
  tenantMiddleware,
  async (req, res) => {
    try {
      const vendorId = req.vendorId;
      const studentId = req.user._id;
      const { classroomIds, classrooms, eligibleSince } = await getStudentAnnouncementContext(
        studentId,
        vendorId
      );

      const announcements = await Announcement.find(
        buildStudentVisibilityFilter(vendorId, classroomIds, eligibleSince)
      )
        .populate('createdBy', 'name')
        .populate('targetClassroomIds', 'name')
        .sort({ publishedAt: -1, createdAt: -1 })
        .limit(100);

      const reads = await AnnouncementRead.find({
        studentId,
        announcementId: { $in: announcements.map((a) => a._id) }
      }).select('announcementId readAt');

      const readMap = {};
      reads.forEach((r) => {
        readMap[r.announcementId.toString()] = r.readAt;
      });

      const inbox = announcements.map((a) => {
        const obj = a.toObject();
        const readAt = readMap[a._id.toString()];
        return {
          ...obj,
          isRead: Boolean(readAt),
          readAt: readAt || null
        };
      });

      const unreadCount = inbox.filter((a) => !a.isRead).length;

      res.json({
        success: true,
        announcements: inbox,
        unreadCount,
        studentClassrooms: classrooms.map((c) => ({ _id: c._id, name: c.name }))
      });
    } catch (error) {
      console.error('Student inbox error:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch announcements', error: error.message });
    }
  }
);

router.post(
  '/student/read-all',
  authenticateToken,
  authorizeRoles('student'),
  tenantMiddleware,
  async (req, res) => {
    try {
      const vendorId = req.vendorId;
      const studentId = req.user._id;
      const { classroomIds, eligibleSince } = await getStudentAnnouncementContext(studentId, vendorId);

      const visible = await Announcement.find(
        buildStudentVisibilityFilter(vendorId, classroomIds, eligibleSince)
      ).select('_id');

      const ops = visible.map((a) => ({
        updateOne: {
          filter: { announcementId: a._id, studentId },
          update: { $set: { vendorId, readAt: new Date() } },
          upsert: true
        }
      }));

      if (ops.length > 0) {
        await AnnouncementRead.bulkWrite(ops);
      }

      res.json({ success: true, message: 'All announcements marked as read', marked: ops.length });
    } catch (error) {
      console.error('Read all error:', error);
      res.status(500).json({ success: false, message: 'Failed to mark all as read', error: error.message });
    }
  }
);

router.get(
  '/student/:id',
  authenticateToken,
  authorizeRoles('student'),
  tenantMiddleware,
  async (req, res) => {
    try {
      const vendorId = req.vendorId;
      const studentId = req.user._id;
      const { classroomIds, eligibleSince } = await getStudentAnnouncementContext(studentId, vendorId);

      const announcement = await Announcement.findOne({
        _id: req.params.id,
        ...buildStudentVisibilityFilter(vendorId, classroomIds, eligibleSince)
      })
        .populate('createdBy', 'name')
        .populate('targetClassroomIds', 'name');

      if (!announcement) {
        return res.status(404).json({ success: false, message: 'Announcement not found' });
      }

      const read = await AnnouncementRead.findOne({
        announcementId: announcement._id,
        studentId
      });

      res.json({
        success: true,
        announcement: {
          ...announcement.toObject(),
          isRead: Boolean(read),
          readAt: read?.readAt || null
        }
      });
    } catch (error) {
      console.error('Student announcement detail error:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch announcement', error: error.message });
    }
  }
);

router.post(
  '/student/:id/read',
  authenticateToken,
  authorizeRoles('student'),
  tenantMiddleware,
  async (req, res) => {
    try {
      const vendorId = req.vendorId;
      const studentId = req.user._id;
      const { classroomIds, eligibleSince } = await getStudentAnnouncementContext(studentId, vendorId);

      const announcement = await Announcement.findOne({
        _id: req.params.id,
        ...buildStudentVisibilityFilter(vendorId, classroomIds, eligibleSince)
      });

      if (!announcement) {
        return res.status(404).json({ success: false, message: 'Announcement not found' });
      }

      const read = await AnnouncementRead.findOneAndUpdate(
        { announcementId: announcement._id, studentId },
        { $set: { vendorId, readAt: new Date() } },
        { upsert: true, new: true }
      );

      res.json({ success: true, readAt: read.readAt });
    } catch (error) {
      console.error('Mark read error:', error);
      res.status(500).json({ success: false, message: 'Failed to mark as read', error: error.message });
    }
  }
);

// ==========================================
// VENDOR ADMIN ROUTES
// ==========================================

router.use(authenticateToken, authorizeRoles('vendor_admin'), tenantMiddleware);

router.get('/', async (req, res) => {
  try {
    const { status } = req.query;
    const query = { vendorId: req.vendorId };
    if (status) query.status = status;

    const announcements = await Announcement.find(query)
      .populate('createdBy', 'name email')
      .populate('targetClassroomIds', 'name')
      .sort({ createdAt: -1 });

    const publishedIds = announcements
      .filter((a) => a.status === 'published')
      .map((a) => a._id);

    let readStats = {};
    if (publishedIds.length > 0) {
      const agg = await AnnouncementRead.aggregate([
        { $match: { announcementId: { $in: publishedIds } } },
        { $group: { _id: '$announcementId', readCount: { $sum: 1 } } }
      ]);
      readStats = Object.fromEntries(agg.map((r) => [r._id.toString(), r.readCount]));
    }

    const enriched = await Promise.all(
      announcements.map(async (a) => {
        const audienceSize = a.status === 'published'
          ? (await resolveAudienceStudentIds(
            a.vendorId,
            a.targetType,
            a.targetClassroomIds,
            a.publishedAt
          )).length
          : null;
        return {
          ...a.toObject(),
          readCount: readStats[a._id.toString()] || 0,
          audienceSize
        };
      })
    );

    res.json({ success: true, announcements: enriched });
  } catch (error) {
    console.error('Vendor list announcements error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch announcements', error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { title, body, targetType, targetClassroomIds, priority, publish } = req.body;

    if (!title?.trim()) {
      return res.status(400).json({ success: false, message: 'Title is required' });
    }
    if (!body?.trim() || body === '<p><br></p>') {
      return res.status(400).json({ success: false, message: 'Announcement body is required' });
    }

    const resolvedTarget = targetType === 'classrooms' ? 'classrooms' : 'all';
    let classroomIds = [];

    if (resolvedTarget === 'classrooms') {
      classroomIds = (targetClassroomIds || []).filter(Boolean);
      if (classroomIds.length === 0) {
        return res.status(400).json({ success: false, message: 'Select at least one classroom' });
      }
      const valid = await Classroom.countDocuments({
        _id: { $in: classroomIds },
        vendorId: req.vendorId,
        isActive: true
      });
      if (valid !== classroomIds.length) {
        return res.status(400).json({ success: false, message: 'Invalid classroom selection' });
      }
    }

    const shouldPublish = Boolean(publish);
    const announcement = new Announcement({
      vendorId: req.vendorId,
      title: title.trim(),
      body,
      createdBy: req.user._id,
      targetType: resolvedTarget,
      targetClassroomIds: classroomIds,
      priority: priority === 'important' ? 'important' : 'normal',
      status: shouldPublish ? 'published' : 'draft',
      publishedAt: shouldPublish ? new Date() : null
    });

    await announcement.save();
    await announcement.populate([
      { path: 'createdBy', select: 'name email' },
      { path: 'targetClassroomIds', select: 'name' }
    ]);

    const audienceSize = shouldPublish
      ? (await resolveAudienceStudentIds(
        req.vendorId,
        resolvedTarget,
        classroomIds,
        announcement.publishedAt
      )).length
      : 0;

    res.status(201).json({
      success: true,
      message: shouldPublish ? 'Announcement published' : 'Draft saved',
      announcement: { ...announcement.toObject(), audienceSize, readCount: 0 }
    });
  } catch (error) {
    console.error('Create announcement error:', error);
    res.status(500).json({ success: false, message: 'Failed to create announcement', error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const announcement = await Announcement.findOne({
      _id: req.params.id,
      vendorId: req.vendorId
    })
      .populate('createdBy', 'name email')
      .populate('targetClassroomIds', 'name');

    if (!announcement) {
      return res.status(404).json({ success: false, message: 'Announcement not found' });
    }

    const readCount = await AnnouncementRead.countDocuments({ announcementId: announcement._id });
    const audienceSize = announcement.status === 'published'
      ? (await resolveAudienceStudentIds(
        announcement.vendorId,
        announcement.targetType,
        announcement.targetClassroomIds,
        announcement.publishedAt
      )).length
      : null;

    res.json({
      success: true,
      announcement: {
        ...announcement.toObject(),
        readCount,
        audienceSize
      }
    });
  } catch (error) {
    console.error('Get announcement error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch announcement', error: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const announcement = await Announcement.findOne({
      _id: req.params.id,
      vendorId: req.vendorId
    });

    if (!announcement) {
      return res.status(404).json({ success: false, message: 'Announcement not found' });
    }

    const { title, body, targetType, targetClassroomIds, priority, status } = req.body;

    if (title !== undefined) announcement.title = title.trim();
    if (body !== undefined) announcement.body = body;
    if (priority !== undefined) {
      announcement.priority = priority === 'important' ? 'important' : 'normal';
    }

    if (targetType !== undefined) {
      const resolvedTarget = targetType === 'classrooms' ? 'classrooms' : 'all';
      announcement.targetType = resolvedTarget;
      if (resolvedTarget === 'all') {
        announcement.targetClassroomIds = [];
      } else {
        const classroomIds = (targetClassroomIds || []).filter(Boolean);
        if (classroomIds.length === 0) {
          return res.status(400).json({ success: false, message: 'Select at least one classroom' });
        }
        const valid = await Classroom.countDocuments({
          _id: { $in: classroomIds },
          vendorId: req.vendorId,
          isActive: true
        });
        if (valid !== classroomIds.length) {
          return res.status(400).json({ success: false, message: 'Invalid classroom selection' });
        }
        announcement.targetClassroomIds = classroomIds;
      }
    }

    if (status === 'published' && announcement.status !== 'published') {
      announcement.status = 'published';
      announcement.publishedAt = new Date();
    } else if (status === 'draft' && announcement.status === 'published') {
      return res.status(400).json({
        success: false,
        message: 'Published announcements cannot be reverted to draft. Archive instead.'
      });
    } else if (status === 'archived') {
      announcement.status = 'archived';
    }

    await announcement.save();
    await announcement.populate([
      { path: 'createdBy', select: 'name email' },
      { path: 'targetClassroomIds', select: 'name' }
    ]);

    res.json({ success: true, message: 'Announcement updated', announcement });
  } catch (error) {
    console.error('Update announcement error:', error);
    res.status(500).json({ success: false, message: 'Failed to update announcement', error: error.message });
  }
});

router.post('/:id/publish', async (req, res) => {
  try {
    const announcement = await Announcement.findOne({
      _id: req.params.id,
      vendorId: req.vendorId
    });

    if (!announcement) {
      return res.status(404).json({ success: false, message: 'Announcement not found' });
    }

    if (announcement.targetType === 'classrooms' && !announcement.targetClassroomIds?.length) {
      return res.status(400).json({ success: false, message: 'Assign at least one classroom before publishing' });
    }

    announcement.status = 'published';
    announcement.publishedAt = new Date();
    await announcement.save();

    const audienceSize = (await resolveAudienceStudentIds(
      announcement.vendorId,
      announcement.targetType,
      announcement.targetClassroomIds,
      announcement.publishedAt
    )).length;

    res.json({
      success: true,
      message: 'Announcement published',
      announcement,
      audienceSize
    });
  } catch (error) {
    console.error('Publish announcement error:', error);
    res.status(500).json({ success: false, message: 'Failed to publish', error: error.message });
  }
});

router.post('/:id/archive', async (req, res) => {
  try {
    const announcement = await Announcement.findOne({
      _id: req.params.id,
      vendorId: req.vendorId
    });

    if (!announcement) {
      return res.status(404).json({ success: false, message: 'Announcement not found' });
    }

    announcement.status = 'archived';
    await announcement.save();

    res.json({ success: true, message: 'Announcement archived', announcement });
  } catch (error) {
    console.error('Archive announcement error:', error);
    res.status(500).json({ success: false, message: 'Failed to archive', error: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const announcement = await Announcement.findOne({
      _id: req.params.id,
      vendorId: req.vendorId
    });

    if (!announcement) {
      return res.status(404).json({ success: false, message: 'Announcement not found' });
    }

    await AnnouncementRead.deleteMany({ announcementId: announcement._id });
    await announcement.deleteOne();

    res.json({ success: true, message: 'Announcement deleted' });
  } catch (error) {
    console.error('Delete announcement error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete', error: error.message });
  }
});

module.exports = router;
