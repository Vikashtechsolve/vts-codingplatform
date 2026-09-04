const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const multer = require('multer');
const path = require('path');
const { auth, authorize } = require('../middleware/auth');
const { uploadToR2, deleteFromR2, getKeyFromUrl } = require('../utils/r2Storage');
const Vendor = require('../models/Vendor');
const User = require('../models/User');
const Test = require('../models/Test');
const Result = require('../models/Result');
const InterviewSession = require('../models/InterviewSession');
const {
  resolveContactEmail,
  assertEmailAvailable,
  applyContactIdentity,
} = require('../utils/vendorIdentitySync');

router.use(auth);
router.use(authorize('super_admin'));

const LOGO_ALLOWED_EXT = /\.(jpe?g|png|gif|webp)$/i;
const LOGO_ALLOWED_MIME = /^image\/(jpeg|png|gif|webp)$/i;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (LOGO_ALLOWED_EXT.test(ext) && LOGO_ALLOWED_MIME.test(file.mimetype)) {
      return cb(null, true);
    }
    cb(new Error('Only PNG, JPG, GIF, or WebP images are allowed (max 5 MB)'));
  },
});

function normalizeInterviewCredits(doc) {
  const out = { ...doc };
  if (typeof out.interviewCredits === 'number' && Number.isFinite(out.interviewCredits)) {
    out.interviewCredits = { allocated: out.interviewCredits, used: 0, remaining: out.interviewCredits };
  } else if (typeof out.interviewCredits !== 'object' || out.interviewCredits === null) {
    out.interviewCredits = { allocated: 0, used: 0, remaining: 0 };
  } else {
    const alloc = Number(out.interviewCredits.allocated) || 0;
    const used = Number(out.interviewCredits.used) || 0;
    out.interviewCredits = { allocated: alloc, used, remaining: Math.max(0, alloc - used) };
  }
  return out;
}

function mergeVendorSettings(current, incoming) {
  const base = current?.toObject?.() || current || {};
  let leetcodeAnalyticsUrl =
    incoming?.leetcodeAnalyticsUrl !== undefined
      ? String(incoming.leetcodeAnalyticsUrl || '').trim()
      : (base.leetcodeAnalyticsUrl || '');

  if (leetcodeAnalyticsUrl) {
    const parsed = new URL(leetcodeAnalyticsUrl);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      const err = new Error('LeetCode Analytics URL must start with http:// or https://');
      err.status = 400;
      throw err;
    }
    leetcodeAnalyticsUrl = parsed.toString();
  }

  return {
    primaryColor: incoming?.primaryColor ?? base.primaryColor ?? '#ED0331',
    secondaryColor: incoming?.secondaryColor ?? base.secondaryColor ?? '#87021C',
    theme: incoming?.theme ?? base.theme ?? 'light',
    leetcodeAnalyticsUrl,
  };
}

async function findVendorAdmin(vendorId) {
  return User.findOne({ vendorId, role: 'vendor_admin' }).select('name email isActive createdAt');
}

// Get all vendors (with normalized interviewCredits — handle legacy number or object)
router.get('/vendors', async (req, res) => {
  try {
    const vendors = await Vendor.find().sort({ createdAt: -1 }).lean();
    res.json(vendors.map((v) => normalizeInterviewCredits(v)));
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.get('/vendors/:id', async (req, res) => {
  try {
    const vendor = await Vendor.findById(req.params.id).lean();
    if (!vendor) return res.status(404).json({ message: 'Vendor not found' });

    const [adminUser, studentCount, testCount, resultCount] = await Promise.all([
      findVendorAdmin(vendor._id),
      User.countDocuments({ vendorId: vendor._id, role: 'student' }),
      Test.countDocuments({ vendorId: vendor._id }),
      Result.countDocuments({ vendorId: vendor._id }),
    ]);

    res.json({
      ...normalizeInterviewCredits(vendor),
      adminUser: adminUser
        ? {
            _id: adminUser._id,
            name: adminUser.name,
            email: adminUser.email,
            isActive: adminUser.isActive,
            createdAt: adminUser.createdAt,
          }
        : null,
      usage: { students: studentCount, tests: testCount, results: resultCount },
    });
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
      subscriptionPlan: subscriptionPlan || 'free',
      interviewCredits: { allocated: 0, used: 0, remaining: 0 }
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

// Update vendor (profile, subscription, branding, admin account)
router.put(
  '/vendors/:id',
  [
    body('name').optional().trim().notEmpty().withMessage('Admin name is required'),
    body('email').optional().isEmail().withMessage('Valid email is required'),
    body('companyName').optional().trim().notEmpty().withMessage('Company name is required'),
    body('subscriptionPlan').optional().isIn(['free', 'basic', 'premium']),
    body('adminPassword').optional().isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ message: 'Validation failed', errors: errors.array() });
      }

      const vendor = await Vendor.findById(req.params.id);
      if (!vendor) return res.status(404).json({ message: 'Vendor not found' });

      const adminUser = await findVendorAdmin(vendor._id);

      const {
        name,
        email,
        companyName,
        isActive,
        subscriptionPlan,
        subscriptionExpiresAt,
        settings,
        adminName,
        adminEmail,
        adminPassword,
        adminIsActive,
      } = req.body;

      if (companyName != null) vendor.companyName = String(companyName).trim();
      if (isActive != null) vendor.isActive = !!isActive;
      if (subscriptionPlan != null) vendor.subscriptionPlan = subscriptionPlan;
      if (subscriptionExpiresAt !== undefined) {
        vendor.subscriptionExpiresAt = subscriptionExpiresAt
          ? new Date(subscriptionExpiresAt)
          : null;
      }

      const identityTouched =
        name != null || adminName != null || email != null || adminEmail != null;
      if (identityTouched) {
        const contactEmail = resolveContactEmail(email, adminEmail);
        if (contactEmail) {
          await assertEmailAvailable(contactEmail, {
            vendorId: vendor._id,
            userId: adminUser?._id,
          });
        }
        applyContactIdentity(vendor, adminUser, { name, adminName, email, adminEmail });
      }

      if (settings && typeof settings === 'object') {
        vendor.settings = mergeVendorSettings(vendor.settings, settings);
        vendor.markModified('settings');
      }

      await vendor.save();

      if (adminUser) {
        // Explicit adminIsActive wins; only mirror the org status when the
        // admin toggle wasn't provided (legacy behavior)
        if (adminIsActive != null) {
          adminUser.isActive = !!adminIsActive;
        } else if (isActive != null) {
          adminUser.isActive = !!isActive;
        }
        if (adminPassword) adminUser.password = adminPassword;
        await adminUser.save();
      }

      const [studentCount, testCount, resultCount] = await Promise.all([
        User.countDocuments({ vendorId: vendor._id, role: 'student' }),
        Test.countDocuments({ vendorId: vendor._id }),
        Result.countDocuments({ vendorId: vendor._id }),
      ]);

      const freshAdmin = await findVendorAdmin(vendor._id);
      res.json({
        ...normalizeInterviewCredits(vendor.toObject()),
        adminUser: freshAdmin
          ? {
              _id: freshAdmin._id,
              name: freshAdmin.name,
              email: freshAdmin.email,
              isActive: freshAdmin.isActive,
              createdAt: freshAdmin.createdAt,
            }
          : null,
        usage: { students: studentCount, tests: testCount, results: resultCount },
      });
    } catch (error) {
      res.status(error.status || 500).json({ message: error.message || 'Server error' });
    }
  }
);

// Allocate interview credits to vendor (super admin assigns; consumed when student attempts > 5 min)
router.post('/vendors/:id/interview-credits', async (req, res) => {
  try {
    const { credits } = req.body;
    const creditValue = parseInt(credits, 10);
    if (Number.isNaN(creditValue) || creditValue < 0) {
      return res.status(400).json({ message: 'Credits must be a non-negative number' });
    }

    const vendor = await Vendor.findById(req.params.id);
    if (!vendor) {
      return res.status(404).json({ message: 'Vendor not found' });
    }

    // Normalize: DB may have interviewCredits as a number (legacy) or as object
    let allocated = 0;
    let used = 0;
    if (typeof vendor.interviewCredits === 'number' && Number.isFinite(vendor.interviewCredits)) {
      allocated = vendor.interviewCredits;
      used = 0;
    } else if (vendor.interviewCredits && typeof vendor.interviewCredits === 'object') {
      allocated = Number(vendor.interviewCredits.allocated) || 0;
      used = Number(vendor.interviewCredits.used) || 0;
    }
    allocated += creditValue;
    const remaining = Math.max(0, allocated - used);

    vendor.interviewCredits = { allocated, used, remaining };
    await vendor.save();

    res.json({ message: 'Interview credits updated', interviewCredits: vendor.interviewCredits });
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
      return res.status(404).json({ message: 'Vendor not found' });
    }

    if (vendor.logo) {
      const oldKey = getKeyFromUrl(vendor.logo);
      if (oldKey) await deleteFromR2(oldKey);
    }

    const filename = `vendor-${Date.now()}${path.extname(req.file.originalname)}`;
    const r2Key = `uploads/logos/${filename}`;
    console.log(`📤 Uploading vendor logo to R2: ${r2Key}`);
    const publicUrl = await uploadToR2(req.file.buffer, r2Key, req.file.originalname);
    console.log(`✅ Vendor logo uploaded: ${publicUrl}`);

    vendor.logo = publicUrl;
    await vendor.save();

    res.json({
      logo: vendor.logo,
      companyName: vendor.companyName,
      settings: vendor.settings,
    });
  } catch (error) {
    console.error('❌ Logo upload error:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.delete('/vendors/:id/logo', async (req, res) => {
  try {
    const vendor = await Vendor.findById(req.params.id);
    if (!vendor) return res.status(404).json({ message: 'Vendor not found' });

    if (vendor.logo) {
      const oldKey = getKeyFromUrl(vendor.logo);
      if (oldKey) await deleteFromR2(oldKey);
      vendor.logo = null;
      await vendor.save();
    }

    res.json({ logo: null, message: 'Logo removed' });
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

// Get platform statistics (including interview stats)
router.get('/stats', async (req, res) => {
  try {
    const totalVendors = await Vendor.countDocuments();
    const activeVendors = await Vendor.countDocuments({ isActive: true });
    const totalUsers = await User.countDocuments();
    const totalTests = await Test.countDocuments();
    const totalResults = await Result.countDocuments();
    const totalInterviewSessions = await InterviewSession.countDocuments();
    const completedInterviewSessions = await InterviewSession.countDocuments({ status: 'completed' });

    res.json({
      totalVendors,
      activeVendors,
      totalUsers,
      totalTests,
      totalResults,
      totalInterviewSessions,
      completedInterviewSessions
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;

