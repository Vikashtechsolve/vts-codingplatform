const mongoose = require('mongoose');

const resultSchema = new mongoose.Schema({
  testId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Test',
    required: true
  },
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  vendorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vendor',
    required: true
  },
  startedAt: {
    type: Date,
    default: Date.now
  },
  submittedAt: Date,
  timeSpent: Number, // in seconds
  answers: [{
    questionId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true
    },
    questionType: {
      type: String,
      enum: [
        'coding', 'mcq', 'aptitude', 'theory', 'sql',
        'english_grammar', 'english_vocabulary', 'english_reading',
        'english_essay', 'english_speaking', 'english_listening'
      ],
      required: true
    },
    answer: mongoose.Schema.Types.Mixed,
    language: String,
    testCasesPassed: Number,
    totalTestCases: Number,
    isCorrect: Boolean,
    points: Number,
    maxPoints: Number,
    audioFileUrl: String,
    essayContent: String,
    wordCount: Number,
    flagged: { type: Boolean, default: false },
    note: { type: String, trim: true },
    sectionId: String,
    subAnswers: [{
      subQuestionIndex: Number,
      answer: mongoose.Schema.Types.Mixed,
      isCorrect: Boolean,
      points: Number,
      maxPoints: Number,
      feedback: String
    }],
    englishEvaluation: {
      grammarScore: Number,
      vocabularyScore: Number,
      coherenceScore: Number,
      structureScore: Number,
      toneScore: Number,
      relevanceScore: Number,
      detailedFeedback: String,
      suggestions: [String],
      pronunciationScore: Number,
      fluencyScore: Number,
      pauseAnalysis: {
        totalPauses: Number,
        avgPauseDuration: Number
      },
      speakingRate: Number,
      transcription: String,
      confidenceScore: Number,
      accentClarity: Number,
      fillerWords: Number,
      vocabularyDiversity: Number,
      plagiarism: {
        originalityScore: Number,
        suspicionLevel: { type: String, enum: ['none', 'low', 'medium', 'high'] },
        isLikelyOriginal: Boolean,
        indicators: [String],
        crossSubmissionSimilarity: Number,
        feedback: String
      }
    },
    evaluation: {
      similarityScore: Number,
      conceptScore: Number,
      depthScore: Number,
      penalty: Number,
      penaltyReasons: [String],
      missingConcepts: [String],
      strengths: [String],
      feedback: String,
      finalScore: Number,
      finalMarks: Number,
      preprocessing: {
        normalizedLength: Number,
        detectedLanguage: String
      }
    },
    manualOverride: {
      isManual: { type: Boolean, default: false },
      score: Number,
      feedback: String,
      updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      updatedAt: Date
    }
  }],
  totalScore: {
    type: Number,
    default: 0
  },
  maxScore: {
    type: Number,
    required: true
  },
  percentage: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['in_progress', 'completed', 'timeout'],
    default: 'in_progress'
  },
  violations: [{
    type: {
      type: String,
      enum: ['tab_switch', 'window_blur', 'copy_paste', 'shortcut_key', 'fullscreen_exit', 'multiple_screens', 'screen_share', 'remote_access'],
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    details: String
  }],
  violationCount: {
    type: Number,
    default: 0
  },
  autoSubmitted: {
    type: Boolean,
    default: false
  },
  sectionScores: [{
    sectionType: String,
    score: { type: Number, default: 0 },
    maxScore: { type: Number, default: 0 },
    percentage: { type: Number, default: 0 }
  }]
}, {
  timestamps: true
});

module.exports = mongoose.model('Result', resultSchema);

