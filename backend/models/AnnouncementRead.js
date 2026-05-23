const mongoose = require('mongoose');

const announcementReadSchema = new mongoose.Schema({
  announcementId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Announcement',
    required: true,
    index: true
  },
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  vendorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vendor',
    required: true,
    index: true
  },
  readAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: false
});

announcementReadSchema.index({ announcementId: 1, studentId: 1 }, { unique: true });
announcementReadSchema.index({ studentId: 1, vendorId: 1 });

module.exports = mongoose.model('AnnouncementRead', announcementReadSchema);
