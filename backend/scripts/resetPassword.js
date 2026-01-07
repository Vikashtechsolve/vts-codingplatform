const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('../models/User');

dotenv.config();

const resetPassword = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/coding-platform');
    console.log('MongoDB Connected');

    const email = process.argv[2] || process.env.SUPER_ADMIN_EMAIL || 'admin@platform.com';
    const newPassword = process.argv[3] || 'admin@123';

    console.log('Resetting password for:', email);
    console.log('New password:', newPassword);

    // Find existing admin
    const user = await User.findOne({ email });
    
    if (!user) {
      console.log('❌ User not found');
      process.exit(1);
    }

    console.log('✅ User found:', user.email);
    console.log('Role:', user.role);
    
    // Update password
    user.password = newPassword;
    await user.save();
    console.log('✅ Password updated successfully!');
    
    // Verify password
    const verifyUser = await User.findOne({ email });
    const isMatch = await verifyUser.comparePassword(newPassword);
    console.log('Password verification:', isMatch ? '✅ Success' : '❌ Failed');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

resetPassword();

