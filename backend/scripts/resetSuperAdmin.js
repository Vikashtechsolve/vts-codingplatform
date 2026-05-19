const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('../models/User');

dotenv.config({ path: require('path').join(__dirname, '../.env') });

const resetSuperAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/coding-platform');
    console.log('MongoDB Connected');

    const superAdminEmail = (process.env.SUPER_ADMIN_EMAIL || 'admin@platform.com').toLowerCase().trim();
    const superAdminPassword = (process.env.SUPER_ADMIN_PASSWORD || 'admin123').trim();

    if (!superAdminPassword || superAdminPassword.length < 6) {
      console.error('SUPER_ADMIN_PASSWORD must be at least 6 characters');
      process.exit(1);
    }

    console.log('Syncing super admin for email:', superAdminEmail);

    let existingAdmin =
      (await User.findOne({ email: superAdminEmail })) ||
      (await User.findOne({ role: 'super_admin' }));

    if (existingAdmin) {
      if (existingAdmin.email !== superAdminEmail) {
        const emailTaken = await User.findOne({
          email: superAdminEmail,
          _id: { $ne: existingAdmin._id },
        });
        if (emailTaken) {
          console.error(`Email ${superAdminEmail} is already used by another account`);
          process.exit(1);
        }
        existingAdmin.email = superAdminEmail;
      }
      existingAdmin.role = 'super_admin';
      existingAdmin.isActive = true;
      existingAdmin.password = superAdminPassword;
      await existingAdmin.save();
      console.log('Super admin synced successfully');
    } else {
      const superAdmin = new User({
        name: 'Super Admin',
        email: superAdminEmail,
        password: superAdminPassword,
        role: 'super_admin',
      });
      await superAdmin.save();
      console.log('Super admin created successfully');
    }

    const verifyUser = await User.findOne({ email: superAdminEmail });
    const isMatch = await verifyUser.comparePassword(superAdminPassword);
    console.log('\n=== Verification ===');
    console.log('Email:', verifyUser.email);
    console.log('Role:', verifyUser.role);
    console.log('Is Active:', verifyUser.isActive);
    console.log('Password match:', isMatch);

    process.exit(isMatch ? 0 : 1);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};

resetSuperAdmin();
