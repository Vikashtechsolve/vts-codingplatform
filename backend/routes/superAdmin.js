const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { auth, authorize } = require('../middleware/auth');
const Vendor = require('../models/Vendor');
const User = require('../models/User');
const Test = require('../models/Test');
const Result = require('../models/Result');

// Apply auth and super_admin authorization to all routes
router.use(auth);
router.use(authorize('super_admin'));

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../uploads/logos');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    cb(null, `vendor-${Date.now()}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error('Only image files are allowed'));
  }
});

// Get all vendors
router.get('/vendors', async (req, res) => {
  try {
    const vendors = await Vendor.find().sort({ createdAt: -1 });
    res.json(vendors);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Create vendor
router.post('/vendors', [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Please provide a valid email'),
  body('companyName').trim().notEmpty().withMessage('Company name is required')
], async (req, res) => {
  try {
    console.log('📥 Received vendor creation request:', req.body);
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('❌ Validation errors:', errors.array());
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, email, companyName, subscriptionPlan } = req.body;

    // Normalize email to lowercase and trim
    const normalizedEmail = email.toLowerCase().trim();

    // Check if vendor already exists
    const existingVendor = await Vendor.findOne({ email: normalizedEmail });
    if (existingVendor) {
      return res.status(400).json({ message: 'Vendor already exists' });
    }

    // Check if vendor admin user already exists
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(400).json({ message: 'Vendor admin user already exists with this email' });
    }

    const vendor = new Vendor({
      name,
      email: normalizedEmail,
      companyName,
      subscriptionPlan: subscriptionPlan || 'free'
    });

    await vendor.save();

    // Create vendor admin user
    const vendorAdmin = new User({
      name,
      email: normalizedEmail, // Use normalized email
      password: 'vendor123', // Default password, should be changed
      role: 'vendor_admin',
      vendorId: vendor._id,
      isActive: true // Explicitly set to active
    });

    await vendorAdmin.save();

    // Verify password was hashed correctly
    const passwordCheck = await vendorAdmin.comparePassword('vendor123');
    console.log('✅ Vendor created:', vendor.companyName);
    console.log('✅ Vendor admin user created:', vendorAdmin.email);
    console.log('   Role:', vendorAdmin.role);
    console.log('   Vendor ID:', vendorAdmin.vendorId);
    console.log('   Is Active:', vendorAdmin.isActive);
    console.log('   Password verified:', passwordCheck ? '✅' : '❌');
    
    if (!passwordCheck) {
      console.error('⚠️  WARNING: Password verification failed! Resetting...');
      vendorAdmin.password = 'vendor123';
      await vendorAdmin.save();
      const recheck = await vendorAdmin.comparePassword('vendor123');
      console.log('   Password re-verified:', recheck ? '✅' : '❌');
    }

    res.status(201).json({
      vendor,
      adminUser: {
        id: vendorAdmin._id,
        email: vendorAdmin.email,
        password: 'vendor123' // Return default password
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update vendor
router.put('/vendors/:id', async (req, res) => {
  try {
    const { name, companyName, isActive, subscriptionPlan } = req.body;
    const vendor = await Vendor.findByIdAndUpdate(
      req.params.id,
      { name, companyName, isActive, subscriptionPlan },
      { new: true, runValidators: true }
    );

    if (!vendor) {
      return res.status(404).json({ message: 'Vendor not found' });
    }

    res.json(vendor);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Upload vendor logo
router.post('/vendors/:id/logo', upload.single('logo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const vendor = await Vendor.findById(req.params.id);
    if (!vendor) {
      // Delete uploaded file if vendor not found
      fs.unlinkSync(req.file.path);
      return res.status(404).json({ message: 'Vendor not found' });
    }

    // Delete old logo if exists
    if (vendor.logo) {
      const oldLogoPath = path.join(__dirname, '../uploads/logos', path.basename(vendor.logo));
      if (fs.existsSync(oldLogoPath)) {
        fs.unlinkSync(oldLogoPath);
      }
    }

    vendor.logo = `/uploads/logos/${req.file.filename}`;
    await vendor.save();

    res.json({ logo: vendor.logo });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete vendor
router.delete('/vendors/:id', async (req, res) => {
  try {
    const vendor = await Vendor.findById(req.params.id);
    if (!vendor) {
      return res.status(404).json({ message: 'Vendor not found' });
    }

    // Delete associated users
    await User.deleteMany({ vendorId: vendor._id });

    // Delete associated tests and results
    const tests = await Test.find({ vendorId: vendor._id });
    await Result.deleteMany({ vendorId: vendor._id });
    await Test.deleteMany({ vendorId: vendor._id });

    await Vendor.findByIdAndDelete(req.params.id);

    res.json({ message: 'Vendor deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get platform statistics
router.get('/stats', async (req, res) => {
  try {
    const totalVendors = await Vendor.countDocuments();
    const activeVendors = await Vendor.countDocuments({ isActive: true });
    const totalUsers = await User.countDocuments();
    const totalTests = await Test.countDocuments();
    const totalResults = await Result.countDocuments();

    res.json({
      totalVendors,
      activeVendors,
      totalUsers,
      totalTests,
      totalResults
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;

