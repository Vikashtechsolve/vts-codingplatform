const User = require('../models/User');

const initSuperAdmin = async () => {
  try {
    const superAdminEmail = process.env.SUPER_ADMIN_EMAIL || 'admin@platform.com';
    const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD || 'admin123';

    console.log('👤 Checking for super admin...');
    console.log('📧 Email:', superAdminEmail);

    const existingAdmin = await User.findOne({ email: superAdminEmail });
    
    if (!existingAdmin) {
      console.log('➕ Creating new super admin...');
      const superAdmin = new User({
        name: 'Super Admin',
        email: superAdminEmail,
        password: superAdminPassword,
        role: 'super_admin'
      });
      
      await superAdmin.save();
      console.log('✅ Super admin created successfully');
      console.log('   Email:', superAdminEmail);
      console.log('   Password:', superAdminPassword);
    } else {
      console.log('✅ Super admin already exists');
      console.log('   Email:', existingAdmin.email);
      console.log('   Role:', existingAdmin.role);
      console.log('   Is Active:', existingAdmin.isActive);
    }
  } catch (error) {
    console.error('❌ Error initializing super admin:', error);
  }
};

module.exports = initSuperAdmin;

