const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('../models/User');
const Vendor = require('../models/Vendor');

dotenv.config();

const checkVendorAdmins = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/coding-platform');
    console.log('✅ MongoDB Connected\n');

    console.log('🔍 Checking all vendor admin users...\n');

    const vendorAdmins = await User.find({ role: 'vendor_admin' });

    if (vendorAdmins.length === 0) {
      console.log('❌ No vendor admin users found in database');
      process.exit(0);
    }

    console.log(`📊 Found ${vendorAdmins.length} vendor admin user(s):\n`);

    for (const admin of vendorAdmins) {
      console.log('─'.repeat(50));
      console.log('👤 User Details:');
      console.log('   ID:', admin._id);
      console.log('   Name:', admin.name);
      console.log('   Email:', admin.email);
      console.log('   Role:', admin.role);
      console.log('   Is Active:', admin.isActive);
      console.log('   Vendor ID:', admin.vendorId);

      // Check if vendor exists
      if (admin.vendorId) {
        const vendor = await Vendor.findById(admin.vendorId);
        if (vendor) {
          console.log('   ✅ Vendor exists:', vendor.companyName);
        } else {
          console.log('   ❌ Vendor NOT found (orphaned user)');
        }
      } else {
        console.log('   ⚠️  No Vendor ID assigned');
      }

      // Check email normalization
      const normalizedEmail = admin.email.toLowerCase().trim();
      if (admin.email !== normalizedEmail) {
        console.log('   ⚠️  Email not normalized:', admin.email, '→', normalizedEmail);
      } else {
        console.log('   ✅ Email is normalized');
      }

      console.log('');
    }

    console.log('─'.repeat(50));
    console.log('\n💡 To fix issues:');
    console.log('   1. If email not normalized, update it');
    console.log('   2. If isActive is false, set it to true');
    console.log('   3. If vendorId is missing, assign correct vendor ID');
    console.log('\n📝 Use resetPassword.js to reset password if needed\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    mongoose.disconnect();
  }
};

checkVendorAdmins();

