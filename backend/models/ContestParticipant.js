const mongoose = require('mongoose');

const contestParticipantSchema = new mongoose.Schema({
  contestId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Contest',
    required: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
  },
  registeredAt: {
    type: Date,
    default: Date.now,
  },
  registrationMeta: {
    phone: { type: String, trim: true },
    college: { type: String, trim: true },
    rollNumber: { type: String, trim: true },
  },
  status: {
    type: String,
    enum: ['registered', 'in_progress', 'completed', 'disqualified'],
    default: 'registered',
  },
  attemptRef: {
    model: {
      type: String,
      enum: ['Result', 'InterviewSession', 'ProjectSubmission', 'SystemDesignSubmission', null],
      default: null,
    },
    id: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
  },
}, {
  timestamps: true,
});

contestParticipantSchema.index({ contestId: 1, userId: 1 }, { unique: true });
contestParticipantSchema.index({ contestId: 1, email: 1 }, { unique: true });

module.exports = mongoose.model('ContestParticipant', contestParticipantSchema);
