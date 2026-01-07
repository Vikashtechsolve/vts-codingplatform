const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const Vendor = require('../models/Vendor');
const { auth } = require('../middleware/auth');
const generateToken = require('../utils/generateToken');

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

    res.status(201).json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        vendorId: user.vendorId
      }
    });
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

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        vendorId: user.vendorId
      }
    });
  } catch (error) {
    console.error('❌ Login error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get current user
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
