const mongoose = require('mongoose');

const testSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  vendorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vendor',
    default: null
  },
  /** vendor = normal vendor test; course_module = course quiz; platform = super admin test allocatable to vendors */
  source: {
    type: String,
    enum: ['vendor', 'course_module', 'platform'],
    default: 'vendor'
  },
  courseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    default: null
  },
  courseModuleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CourseModule',
    default: null
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['coding', 'mcq', 'aptitude', 'theory', 'mixed', 'sql', 'english'],
    required: true
  },
  datasetTemplateId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DatasetTemplate',
    default: null
  },
  duration: {
    type: Number, // in minutes
    required: true
  },
  questions: [{
    type: {
      type: String,
      enum: [
        'coding', 'mcq', 'aptitude', 'theory', 'sql',
        'english_grammar', 'english_vocabulary', 'english_reading',
        'english_essay', 'english_speaking', 'english_listening'
      ],
      required: true
    },
    questionId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: 'questions.questionType'
    },
    questionType: {
      type: String,
      enum: [
        'CodingQuestion', 'MCQQuestion', 'AptitudeQuestion', 'TheoryQuestion', 'SQLQuestion',
        'EnglishGrammarQuestion', 'EnglishVocabularyQuestion', 'EnglishReadingQuestion',
        'EnglishEssayQuestion', 'EnglishSpeakingQuestion', 'EnglishListeningQuestion'
      ]
    },
    points: {
      type: Number,
      default: 10
    },
    order: {
      type: Number,
      required: true
    },
    sectionId: {
      type: String
    }
  }],
  englishSections: [{
    sectionType: {
      type: String,
      enum: ['grammar', 'vocabulary', 'reading', 'writing', 'speaking', 'listening']
    },
    sectionTitle: {
      type: String,
      trim: true
    },
    duration: {
      type: Number
    },
    order: {
      type: Number
    },
    instructions: {
      type: String,
      trim: true
    }
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  startDate: Date,
  endDate: Date,
  settings: {
    allowMultipleAttempts: {
      type: Boolean,
      default: false
    },
    autoSubmitAtWindowEnd: {
      type: Boolean,
      default: true,
    },
    showResults: {
      type: Boolean,
      default: true
    },
    resultDisplay: {
      type: String,
      enum: ['detailed', 'score_only'],
      default: 'detailed'
    },
    shuffleQuestions: {
      type: Boolean,
      default: false
    },
    practiceMode: {
      type: Boolean,
      default: false
    }
  }
}, {
  timestamps: true
});

testSchema.pre('validate', function validateVendorOrCourse(next) {
  if (this.source === 'course_module') {
    if (!this.courseId || !this.courseModuleId) {
      return next(new Error('course_module tests require courseId and courseModuleId'));
    }
    return next();
  }
  if (this.source === 'platform') {
    if (this.vendorId) {
      return next(new Error('platform tests cannot have vendorId'));
    }
    return next();
  }
  if (!this.vendorId) {
    return next(new Error('vendorId is required for vendor tests'));
  }
  return next();
});

module.exports = mongoose.model('Test', testSchema);

