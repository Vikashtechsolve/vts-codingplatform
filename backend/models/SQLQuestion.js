const mongoose = require('mongoose');

const sqlQuestionSchema = new mongoose.Schema({
  testId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Test',
    required: true
  },
  vendorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vendor',
    required: true
  },
  text: {
    type: String,
    required: true
  },
  marks: {
    type: Number,
    required: true,
    default: 10
  },
  correctSql: {
    type: String,
    required: true
  },
  expectedOutputHash: {
    type: String,
    required: true
  },
  order: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('SQLQuestion', sqlQuestionSchema);
