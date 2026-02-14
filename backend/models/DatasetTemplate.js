const mongoose = require('mongoose');

const datasetTemplateSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true,
    default: ''
  },
  domain: {
    type: String,
    trim: true,
    default: 'General',
    enum: ['HR', 'Banking', 'Sales', 'E-commerce', 'General']
  },
  vendorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vendor',
    required: true
  },
  schemaSql: {
    type: String,
    required: true
  },
  dataSql: {
    type: String,
    default: ''
  },
  schemaJson: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  version: {
    type: Number,
    default: 1
  },
  isPublished: {
    type: Boolean,
    default: false
  },
  publishedAt: Date
}, {
  timestamps: true
});

module.exports = mongoose.model('DatasetTemplate', datasetTemplateSchema);
