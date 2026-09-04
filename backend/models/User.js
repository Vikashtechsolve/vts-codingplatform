const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  enrollmentNumber: {
    type: String,
    trim: true,
    default: null,
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  role: {
    type: String,
    enum: ['super_admin', 'vendor_admin', 'student'],
    required: true
  },
  vendorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vendor',
    default: null
  },
  accountOrigin: {
    type: String,
    enum: ['vendor_enrolled', 'contest'],
    default: 'vendor_enrolled',
  },
  isActive: {
    type: Boolean,
    default: true
  },
  passwordResetTokenHash: {
    type: String,
    select: false,
  },
  passwordResetExpires: {
    type: Date,
    select: false,
  },
  enrolledTests: [{
    testId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Test'
    },
    assignedAt: {
      type: Date,
      default: Date.now
    },
    status: {
      type: String,
      enum: ['assigned', 'in_progress', 'completed'],
      default: 'assigned'
    },
    // 'course' = auto-enrolled by a course module; hidden from normal student lists
    origin: {
      type: String,
      enum: ['direct', 'course'],
      default: 'direct'
    },
    startedAt: Date,
    completedAt: Date
  }],
  enrolledInterviews: [{
    interviewId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Interview'
    },
    assignedAt: {
      type: Date,
      default: Date.now
    },
    status: {
      type: String,
      enum: ['assigned', 'in_progress', 'completed'],
      default: 'assigned'
    },
    origin: {
      type: String,
      enum: ['direct', 'course'],
      default: 'direct'
    },
    startedAt: Date,
    completedAt: Date
  }],
  enrolledAssignments: [{
    assignmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Assignment'
    },
    assignedAt: {
      type: Date,
      default: Date.now
    },
    status: {
      type: String,
      enum: ['assigned', 'in_progress', 'submitted', 'evaluated'],
      default: 'assigned'
    },
    origin: {
      type: String,
      enum: ['direct', 'course'],
      default: 'direct'
    },
    startedAt: Date,
    submittedAt: Date,
    deadline: Date,
    submissionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ProjectSubmission'
    }
  }]
}, {
  timestamps: true
});

userSchema.index(
  { vendorId: 1, enrollmentNumber: 1 },
  {
    unique: true,
    sparse: true,
    collation: { locale: 'en', strength: 2 },
  }
);

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);

