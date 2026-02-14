const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { auth, authorize } = require('../middleware/auth');
const tenantMiddleware = require('../middleware/tenant');
const DatasetTemplate = require('../models/DatasetTemplate');
const Test = require('../models/Test');

router.use(auth, authorize('vendor_admin'), tenantMiddleware);

// List all dataset templates for vendor
router.get('/', async (req, res) => {
  try {
    const templates = await DatasetTemplate.find({ vendorId: req.vendorId })
      .sort({ updatedAt: -1 })
      .select('-schemaSql -dataSql');
    res.json(templates);
  } catch (error) {
    console.error('Error listing dataset templates:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get one template (full, for edit or for running SQL)
router.get('/:id', async (req, res) => {
  try {
    const template = await DatasetTemplate.findOne({
      _id: req.params.id,
      vendorId: req.vendorId
    });
    if (!template) {
      return res.status(404).json({ message: 'Dataset template not found' });
    }
    res.json(template);
  } catch (error) {
    console.error('Error fetching dataset template:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Create dataset template
router.post('/', [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('schemaSql').notEmpty().withMessage('Schema SQL is required'),
  body('dataSql').optional().default(''),
  body('description').optional().trim(),
  body('domain').optional().isIn(['HR', 'Banking', 'Sales', 'E-commerce', 'General']).withMessage('Invalid domain')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { name, description, domain, schemaSql, dataSql } = req.body;
    const template = new DatasetTemplate({
      name,
      description: description || '',
      domain: domain || 'General',
      vendorId: req.vendorId,
      schemaSql,
      dataSql: dataSql || ''
    });
    await template.save();
    res.status(201).json(template);
  } catch (error) {
    console.error('Error creating dataset template:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update dataset template (only if not used by a published test)
router.put('/:id', [
  body('name').optional().trim().notEmpty(),
  body('schemaSql').optional(),
  body('dataSql').optional(),
  body('description').optional().trim(),
  body('domain').optional().isIn(['HR', 'Banking', 'Sales', 'E-commerce', 'General'])
], async (req, res) => {
  try {
    const template = await DatasetTemplate.findOne({
      _id: req.params.id,
      vendorId: req.vendorId
    });
    if (!template) {
      return res.status(404).json({ message: 'Dataset template not found' });
    }
    const { name, description, domain, schemaSql, dataSql } = req.body;
    if (name !== undefined) template.name = name;
    if (description !== undefined) template.description = description;
    if (domain !== undefined) template.domain = domain;
    if (schemaSql !== undefined) template.schemaSql = schemaSql;
    if (dataSql !== undefined) template.dataSql = dataSql;
    await template.save();
    res.json(template);
  } catch (error) {
    console.error('Error updating dataset template:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete dataset template (only if not referenced by any test)
router.delete('/:id', async (req, res) => {
  try {
    const template = await DatasetTemplate.findOne({
      _id: req.params.id,
      vendorId: req.vendorId
    });
    if (!template) {
      return res.status(404).json({ message: 'Dataset template not found' });
    }
    const inUse = await Test.findOne({ datasetTemplateId: template._id });
    if (inUse) {
      return res.status(400).json({ message: 'Template is in use by one or more tests. Remove it from tests first.' });
    }
    await DatasetTemplate.findByIdAndDelete(req.params.id);
    res.json({ message: 'Dataset template deleted' });
  } catch (error) {
    console.error('Error deleting dataset template:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
