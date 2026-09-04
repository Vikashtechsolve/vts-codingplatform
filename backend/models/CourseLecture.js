const mongoose = require('mongoose');

const courseLectureSchema = new mongoose.Schema(
  {
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      required: true,
      index: true,
    },
    moduleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CourseModule',
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: '' },
    order: { type: Number, required: true, min: 0 },
    video: {
      originalKey: { type: String, default: null },
      hlsPrefix: { type: String, default: null },
      durationSec: { type: Number, default: 0, min: 0 },
      status: {
        type: String,
        enum: ['none', 'uploading', 'processing', 'ready', 'failed'],
        default: 'none',
      },
      errorMessage: { type: String, default: null },
      originalFileName: { type: String, default: null },
      contentType: { type: String, default: null },
    },
    notesPdfKey: { type: String, default: null },
    notesPdfFileName: { type: String, default: null },
    notesHtml: { type: String, default: '' },
  },
  { timestamps: true }
);

courseLectureSchema.index({ moduleId: 1, order: 1 });
courseLectureSchema.index({ courseId: 1, moduleId: 1 });

courseLectureSchema.virtual('hasVideo').get(function hasVideo() {
  return this.video && this.video.status === 'ready' && !!this.video.hlsPrefix;
});

courseLectureSchema.virtual('hasNotesPdf').get(function hasNotesPdf() {
  return !!this.notesPdfKey;
});

courseLectureSchema.virtual('hasNotesHtml').get(function hasNotesHtml() {
  return !!(this.notesHtml && String(this.notesHtml).trim());
});

courseLectureSchema.set('toJSON', { virtuals: true });
courseLectureSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('CourseLecture', courseLectureSchema);
