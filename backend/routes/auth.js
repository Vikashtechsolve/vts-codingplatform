const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const Vendor = require('../models/Vendor');
const { auth } = require('../middleware/auth');
const generateToken = require('../utils/generateToken');
const {
  loadBrandingForUser,
  loadBrandingForVendorId,
  resolveVendorIdForUser,
  attachBrandingToUser,
} = require('../utils/vendorBranding');
const { rateLimit } = require('../middleware/rateLimit');
const {
  generateResetToken,
  isResetTokenValid,
  clearResetFields,
  hashToken,
  getExpireMinutes,
} = require('../utils/passwordReset');
const { sendPasswordResetEmail, isEmailConfigured } = require('../utils/emailService');

const FORGOT_PASSWORD_MESSAGE =
  'If an account exists with that email, you will receive a password reset link shortly.';

const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  keyPrefix: 'forgot-password',
});

const resetPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyPrefix: 'reset-password',
});

// Register (for students and vendor admins)
router.post('/register', [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Please provide a valid email'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('role').isIn(['vendor_admin', 'student']).withMessage('Invalid role')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, email, password, role, vendorId } = req.body;

    if (role === 'student') {
      return res.status(403).json({
        message: 'Student self-registration is disabled. Use a contest link to register for contests, or contact your organization for account access.',
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // If vendor_admin, verify vendor exists
    if (role === 'vendor_admin' && vendorId) {
      const vendor = await Vendor.findById(vendorId);
      if (!vendor) {
        return res.status(400).json({ message: 'Vendor not found' });
      }
    }

    const user = new User({
      name,
      email: email.toLowerCase().trim(),
      password,
      role,
      vendorId: role === 'student' || role === 'vendor_admin' ? vendorId : null
    });

    await user.save();

    const token = generateToken(user._id);

    const userPayload = await attachBrandingToUser({
      id: user._id,
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      vendorId: user.vendorId,
    });

    res.status(201).json({ token, user: userPayload });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Login
router.post('/login', [
  body('email').isEmail().withMessage('Please provide a valid email'),
  body('password').notEmpty().withMessage('Password is required')
], async (req, res) => {
  try {
    console.log('🔐 Login attempt received');
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('❌ Validation errors:', errors.array());
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;
    console.log('📧 Login attempt for email:', email);

    // Normalize email to lowercase and trim
    const normalizedEmail = email.toLowerCase().trim();
    console.log('📧 Normalized email:', normalizedEmail);

    let user = await User.findOne({ email: normalizedEmail });
    
    // If not found, try case-insensitive search (for debugging)
    if (!user) {
      console.log('❌ User not found with normalized email:', normalizedEmail);
      user = await User.findOne({ 
        $expr: { $eq: [{ $toLower: "$email" }, normalizedEmail] }
      });
      if (user) {
        console.log('⚠️  Found user with different case, updating email...');
        user.email = normalizedEmail;
        await user.save();
        console.log('✅ Email normalized and saved');
      }
    }

    if (!user) {
      console.log('❌ User not found for email:', normalizedEmail);
      // List all vendor admin users for debugging
      const vendorAdmins = await User.find({ role: 'vendor_admin' }, 'email role isActive vendorId');
      if (vendorAdmins.length > 0) {
        console.log('📋 Existing vendor admin users:');
        vendorAdmins.forEach(va => {
          console.log(`   - ${va.email} (Active: ${va.isActive}, VendorID: ${va.vendorId})`);
        });
      }
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    console.log('✅ User found:', user.email);
    console.log('   Role:', user.role);
    console.log('   Is Active:', user.isActive);
    console.log('   Vendor ID:', user.vendorId);

    if (!user.isActive) {
      console.log('❌ Account is inactive for user:', user.email);
      return res.status(401).json({ message: 'Account is inactive' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      console.log('❌ Password mismatch for user:', user.email);
      console.log('   Attempted password:', password);
      console.log('   User role:', user.role);
      
      // For vendor_admin, provide helpful message
      if (user.role === 'vendor_admin') {
        console.log('💡 Vendor admin password reset may be needed');
        console.log('   Run: node scripts/fixVendorAdmin.js', user.email);
      }
      
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    console.log('✅ Password verified successfully');
    const token = generateToken(user._id);
    console.log('🎫 Token generated for user:', user.email);

    const userPayload = await attachBrandingToUser({
      id: user._id,
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      vendorId: user.vendorId,
    });

    console.log('   Resolved vendorId:', userPayload.vendorId || '(none)');
    console.log('   Branding logo:', userPayload.branding?.logo ? 'attached' : 'missing');

    res.json({ token, user: userPayload });
  } catch (error) {
    console.error('❌ Login error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Request password reset email
router.post(
  '/forgot-password',
  forgotPasswordLimiter,
  [body('email').isEmail().withMessage('Please provide a valid email')],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ message: errors.array()[0].msg });
      }

      const normalizedEmail = req.body.email.toLowerCase().trim();

      const user = await User.findOne({ email: normalizedEmail }).select(
        '+passwordResetTokenHash +passwordResetExpires name email isActive'
      );

      if (user && user.isActive) {
        const { token, tokenHash, expiresAt } = generateResetToken();
        user.passwordResetTokenHash = tokenHash;
        user.passwordResetExpires = expiresAt;
        await user.save({ validateBeforeSave: false });

        if (isEmailConfigured()) {
          await sendPasswordResetEmail({
            to: user.email,
            name: user.name,
            resetToken: token,
            expireMinutes: getExpireMinutes(),
          });
        } else if (process.env.NODE_ENV === 'development') {
          const resetUrl = `${(process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '')}/reset-password?token=${token}`;
          console.log('📧 [dev] Password reset link (Resend not configured):', resetUrl);
        }
      }

      res.json({ message: FORGOT_PASSWORD_MESSAGE });
    } catch (error) {
      console.error('Forgot password error:', error);
      res.json({ message: FORGOT_PASSWORD_MESSAGE });
    }
  }
);

// Verify reset token is valid (for reset form page)
router.get('/reset-password/verify', async (req, res) => {
  try {
    const rawToken = req.query.token;
    if (!rawToken || typeof rawToken !== 'string') {
      return res.status(400).json({ valid: false, message: 'Reset link is invalid.' });
    }

    const tokenHash = hashToken(rawToken);
    const user = await User.findOne({
      passwordResetTokenHash: tokenHash,
      passwordResetExpires: { $gt: new Date() },
    }).select('+passwordResetTokenHash +passwordResetExpires');

    if (!user || !isResetTokenValid(user, rawToken)) {
      return res.status(400).json({
        valid: false,
        message: 'This reset link is invalid or has expired. Please request a new one.',
      });
    }

    res.json({ valid: true, email: user.email.replace(/(.{2}).+(@.+)/, '$1***$2') });
  } catch (error) {
    res.status(500).json({ valid: false, message: 'Server error' });
  }
});

// Set new password with reset token
router.post(
  '/reset-password',
  resetPasswordLimiter,
  [
    body('token').notEmpty().withMessage('Reset token is required'),
    body('password')
      .isLength({ min: 6 })
      .withMessage('Password must be at least 6 characters'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ message: errors.array()[0].msg });
      }

      const { token, password } = req.body;
      const tokenHash = hashToken(token);

      const user = await User.findOne({
        passwordResetTokenHash: tokenHash,
        passwordResetExpires: { $gt: new Date() },
      }).select('+password +passwordResetTokenHash +passwordResetExpires');

      if (!user || !isResetTokenValid(user, token)) {
        return res.status(400).json({
          message: 'This reset link is invalid or has expired. Please request a new one.',
        });
      }

      if (!user.isActive) {
        return res.status(403).json({ message: 'This account is inactive. Contact support.' });
      }

      user.password = password;
      clearResetFields(user);
      await user.save();

      res.json({ message: 'Password updated successfully. You can now sign in with your new password.' });
    } catch (error) {
      console.error('Reset password error:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);

// Get current user (includes branding when user belongs to a vendor)
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    const userObj = user.toObject();
    userObj.id = userObj._id;
    res.json(await attachBrandingToUser(userObj));
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Vendor branding for white-label UI (students + vendor admins)
router.get('/branding', auth, async (req, res) => {
  try {
    if (req.user.role === 'super_admin') {
      return res.json({ logo: null, companyName: null, settings: null });
    }

    if (req.user.role !== 'student' && req.user.role !== 'vendor_admin') {
      return res.json({ logo: null, companyName: null, settings: null });
    }

    const vendorId = await resolveVendorIdForUser(req.user);
    if (!vendorId) {
      return res.json({ logo: null, companyName: null, settings: null });
    }

    const branding = await loadBrandingForVendorId(vendorId);
    res.json({
      vendorId,
      ...(branding || { logo: null, companyName: null, settings: null }),
    });
  } catch (error) {
    console.error('GET /auth/branding error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
