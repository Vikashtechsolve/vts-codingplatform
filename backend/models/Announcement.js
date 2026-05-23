const mongoose = require('mongoose');

const announcementSchema = new mongoose.Schema({
  vendorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vendor',
    required: true,
    index: true
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  body: {
    type: String,
    required: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  targetType: {
    type: String,
    enum: ['all', 'classrooms'],
    default: 'all'
  },
  targetClassroomIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Classroom'
  }],
  priority: {
    type: String,
    enum: ['normal', 'important'],
    default: 'normal'
  },
  status: {
    type: String,
    enum: ['draft', 'published', 'archived'],
    default: 'draft',
    index: true
  },
  publishedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

announcementSchema.index({ vendorId: 1, status: 1, publishedAt: -1 });
announcementSchema.index({ vendorId: 1, targetType: 1, targetClassroomIds: 1 });

module.exports = mongoose.model('Announcement', announcementSchema);
