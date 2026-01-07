const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('../models/User');

dotenv.config();

const resetSuperAdmin = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/coding-platform');
    console.log('MongoDB Connected');

    const superAdminEmail = process.env.SUPER_ADMIN_EMAIL || 'admin@platform.com';
    const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD || 'admin123';

    console.log('Looking for super admin with email:', superAdminEmail);

    // Find existing admin
    const existingAdmin = await User.findOne({ email: superAdminEmail });
    
    if (existingAdmin) {
      console.log('Found existing super admin');
      console.log('Email:', existingAdmin.email);
      console.log('Role:', existingAdmin.role);
      console.log('Is Active:', existingAdmin.isActive);
      
      // Update password
      existingAdmin.password = superAdminPassword;
      await existingAdmin.save();
      console.log('Password reset successfully!');
      console.log('New password:', superAdminPassword);
    } else {
      console.log('No existing admin found. Creating new one...');
      const superAdmin = new User({
        name: 'Super Admin',
        email: superAdminEmail,
        password: superAdminPassword,
        role: 'super_admin'
      });
      
      await superAdmin.save();
      console.log('Super admin created successfully!');
      console.log('Email:', superAdminEmail);
      console.log('Password:', superAdminPassword);
    }

    // Verify the user exists
    const verifyUser = await User.findOne({ email: superAdminEmail });
    if (verifyUser) {
      console.log('\n=== Verification ===');
      console.log('User found:', verifyUser.email);
      console.log('Role:', verifyUser.role);
      console.log('Is Active:', verifyUser.isActive);
      
      // Test password comparison
      const isMatch = await verifyUser.comparePassword(superAdminPassword);
      console.log('Password match:', isMatch);
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};

resetSuperAdmin();

